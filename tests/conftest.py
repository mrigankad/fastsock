import pytest
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.core.config import settings

# Use SQLite for testing to avoid needing a running Postgres instance
# Note: SQLite async support requires aiosqlite
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine_test = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
async def prepare_db():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(prepare_db) -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session

@pytest.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    # Mock Redis manager to avoid connection errors during tests
    from app.ws.manager import manager
    from unittest.mock import AsyncMock
    
    manager.start_redis = AsyncMock()
    manager.redis = AsyncMock()
    manager.broadcast = AsyncMock()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
