from contextlib import asynccontextmanager
import os
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api.api_v1.api import api_router
from app.core.config import settings
from app.ws.manager import manager

# --- Structured logging setup ---
LOG_FORMAT = os.getenv("LOG_FORMAT", "text")  # Set to "json" in production

if LOG_FORMAT == "json":
    import json as _json

    class JSONFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            log_obj = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info and record.exc_info[1]:
                log_obj["exception"] = self.formatException(record.exc_info)
            return _json.dumps(log_obj, ensure_ascii=False)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
else:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

logger = logging.getLogger("fastsock")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastSock starting up")
    os.makedirs("app/static/uploads", exist_ok=True)
    await manager.start_redis()

    # Start background job scheduler
    from app.workers.scheduler import scheduler, setup_jobs
    setup_jobs()
    scheduler.start()
    logger.info("APScheduler started with %d job(s)", len(scheduler.get_jobs()))

    yield

    logger.info("FastSock shutting down")
    scheduler.shutdown(wait=False)
    if manager.redis:
        await manager.redis.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mount Static Files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# CORS - allow dev origins + wildcard fallback for production behind reverse proxy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request logging middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    # Skip noisy health checks in logs
    if not request.url.path.startswith("/health"):
        logger.info(
            "request %s %s -> %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    return response


# --- Health check endpoint ---
@app.get("/health", tags=["ops"])
async def health_check():
    """
    Health check for load balancers and Kubernetes probes.
    Reports status of backend, database, and Redis connectivity.
    """
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import text

    checks = {"backend": "ok", "database": "unknown", "redis": "unknown"}

    # Database connectivity check
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"

    # Redis connectivity check
    try:
        if manager.redis:
            await manager.redis.ping()
            checks["redis"] = "ok"
        else:
            checks["redis"] = "not_configured"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:100]}"

    healthy = checks["backend"] == "ok" and checks["database"] == "ok"
    return {"status": "healthy" if healthy else "degraded", "checks": checks}


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Welcome to FastSock Real-time Chat API"}
