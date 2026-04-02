from __future__ import annotations

import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime

import structlog
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from database import engine, init_db
from websocket_manager import manager
from routes import delivery, hubs, driver, dashboard
from routes import auth as auth_router
from routes import voice as voice_router
from routes import dispatcher as dispatcher_router
from routes import tts as tts_router
from routes import navigation as navigation_router
from routes import calling as calling_router
from limiter import limiter

logger = logging.getLogger(__name__)

# Paths that bypass JWT validation
_OPEN_PREFIXES = (
    "/health",
    "/auth/",
    "/docs",
    "/redoc",
    "/openapi.json",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Configure structlog JSON logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

    await init_db()
    yield


app = FastAPI(
    title="NearDrop API",
    description="Intelligent last-mile delivery recovery platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    path = request.url.path

    if request.method == "OPTIONS" or any(path.startswith(p) for p in _OPEN_PREFIXES) or path.startswith("/ws"):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Not authenticated"},
        )

    token = auth_header[7:]
    try:
        from auth import decode_token
        decode_token(token)
    except Exception:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or expired token"},
        )

    return await call_next(request)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000)
    logger.info(
        "request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        }
    )
    return response


# CORSMiddleware must be added AFTER jwt_middleware so it becomes the outermost
# layer. Starlette applies middlewares last-in = outermost, meaning this one
# processes every request first (sets CORS headers) and every response last
# (including 401s from jwt_middleware).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="http://localhost:.*|http://127.0.0.1:.*|http://192.168.1.7:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth and voice first (open or semi-open)
app.include_router(auth_router.router)
app.include_router(voice_router.router)

# Core business routes (all protected by middleware above)
app.include_router(delivery.router)
app.include_router(hubs.router)
app.include_router(driver.router)
app.include_router(dashboard.router)

# Dispatcher portal routes (additionally protected by require_dispatcher dependency)
app.include_router(dispatcher_router.router)

# Azure service routes
app.include_router(tts_router.router)
app.include_router(navigation_router.router)
app.include_router(calling_router.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(
                json.dumps({"type": "pong", "data": {}}), websocket
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
async def health():
    db_ok = False
    try:
        from sqlalchemy.ext.asyncio import AsyncSession
        async with AsyncSession(engine) as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "error",
        "timestamp": datetime.utcnow().isoformat(),
    }
