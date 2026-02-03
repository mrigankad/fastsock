# Deployment Guide for FastSock

This guide describes how to deploy the FastSock application (Backend + Frontend + Database) using Docker Compose.

## Prerequisites

- Docker Engine (v20.10+)
- Docker Compose (v2.0+)
- Git

## Architecture

The stack consists of 4 containers:
1. **Frontend**: React/Vite app served by Nginx (Port 80)
2. **Backend**: FastAPI app (Port 8000 internal, proxy via Nginx)
3. **Database**: PostgreSQL 15
4. **Valkey**: Valkey (Redis-compatible) for WebSocket Pub/Sub

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repo_url>
   cd FastSock
   ```

2. **Set up Environment Variables**
   Create a `.env` file (or use defaults in docker-compose):
   ```bash
   # Optional: Override defaults
   SECRET_KEY=your_production_secret_key_change_this
   POSTGRES_PASSWORD=secure_password
   ```

3. **Build and Run**
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

4. **Verify Deployment**
   - Access the app at `http://localhost` (or your server IP).
   - API Docs: `http://localhost/api/docs`

## Data Persistence

- Database data is stored in the `postgres_data` Docker volume.
- Uploaded files are stored in `app/static/uploads` (mapped to container).

## Production Notes

- **SSL/TLS**: This setup uses HTTP (Port 80). For HTTPS, you should put a reverse proxy (like Traefik or Caddy) in front or configure Certbot with Nginx.
- **Security**: Change the `SECRET_KEY` and `POSTGRES_PASSWORD` in production.
- **Scaling**: The backend is stateless (except for uploads). For multiple backend instances, ensure all instances share the `REDIS_URL` for correct WebSocket broadcasting.
  - Use the Valkey service name `redis` as configured in docker-compose.
  - For TURN in WebRTC deployments, use Coturn to keep infrastructure fully open-source.
