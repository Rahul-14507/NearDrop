from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db
from websocket_manager import manager
from routes import delivery, hubs, driver, dashboard
from routes import auth as auth_router
from routes import voice as voice_router
from routes import dispatcher as dispatcher_router

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
    await init_db()
    yield


app = FastAPI(
    title="NearDrop API",
    description="Intelligent last-mile delivery recovery platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"status": "ok", "service": "NearDrop API", "version": "2.0.0"}
