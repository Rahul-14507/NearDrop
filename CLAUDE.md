# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NearDrop is a last-mile delivery recovery platform. When a delivery fails, it broadcasts the package to nearby community micro-hubs (kirana stores, pharmacies, apartment receptions) in real time. Seeded with Hyderabad, India data.

## Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Seed mock data
python -m backend.seed

# Start dev server (from repo root)
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build
npm run preview
```

No test or lint commands exist in this project.

## Architecture

### Backend (Python/FastAPI)
- `backend/main.py` — app factory; registers CORS, mounts 4 routers and WebSocket at `/ws`, calls `init_db()` on startup
- `backend/database.py` — async SQLAlchemy engine; defaults to `sqlite+aiosqlite:///./neardrop.db`, overridable via `DATABASE_URL` env var for PostgreSQL+asyncpg
- `backend/models.py` — ORM models: `Driver`, `Hub`, `Delivery`, `HubBroadcast`; enums: `DeliveryStatus`, `PackageSize`, `HubType`
- `backend/websocket_manager.py` — in-memory `ConnectionManager`; broadcasts to all clients via a Python list (not Redis — single-process only)
- `backend/routes/delivery.py` — `POST /delivery/fail`: marks delivery failed, runs haversine hub search within 2000m (pure Python, loads all hubs into memory), creates `HubBroadcast`, broadcasts `delivery_failed` WS event
- `backend/routes/hubs.py` — hub lookup, stats, active broadcasts, `POST /hub/accept` (generates 6-digit pickup code, earns ₹25)
- `backend/routes/driver.py` — driver trust score, active delivery
- `backend/routes/dashboard.py` — stats, fleet, hourly metrics, leaderboard; CO2 = `reroutes * 0.8 kg`
- `backend/seed.py` — 5 drivers, 8 hubs, 50 deliveries; driver 1 always has an active en_route delivery; hub 1 has a pre-accepted broadcast (pickup code `847291`)

### Frontend (React/Vite)
- All API calls use axios with `baseURL: '/api'`; Vite dev proxy strips `/api` prefix and routes to `localhost:8000`
- `frontend/src/api.js` — single file exporting all named API functions
- `frontend/src/hooks/useWebSocket.js` — WebSocket to `/ws`, auto-reconnects after 3s
- `frontend/src/hooks/useVoice.js` — browser Web Speech API (`lang: 'en-IN'`), graceful fallback

### Frontend Routes
| URL | Page |
|---|---|
| `/driver` | Voice-first delivery interface — hardcoded `DRIVER_ID = 1` |
| `/hub` | Incoming broadcast accept/decline — hardcoded `HUB_ID = 1` |
| `/dashboard` | Fleet map, stats, hourly chart, leaderboard |

### Key Constraints
- **No auth**: Driver and Hub IDs are constants in the frontend pages
- **In-memory WebSocket**: Multi-worker deployments would break broadcasts — Redis pub/sub is the intended scale-out path
- **Haversine in Python**: Hub geosearch loads all hub rows; PostGIS `ST_DWithin` is the intended production path
- **Maps**: OpenStreetMap tiles via react-leaflet, no API key needed
- **Tailwind**: Custom `navy`/`teal`/`surface` design tokens, dark mode is `class`-based
