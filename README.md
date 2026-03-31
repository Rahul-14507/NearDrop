# NearDrop — Intelligent Last-Mile Delivery Recovery

NearDrop intercepts failed deliveries in real time and broadcasts them to a geo-proximate network of community micro-hubs (kirana stores, pharmacies, apartment receptions). When a driver marks a delivery as failed, the DeadMile Engine finds available hubs within 2 km, broadcasts the package offer over WebSocket, and reroutes the driver to the first accepting hub — eliminating retry trips and building a verifiable trust record for every actor in the chain.

---

## Project Structure

```
NearDrop/
├── backend/                        # FastAPI backend
│   ├── routes/                     # Auth, delivery, hubs, driver, dashboard, voice
│   ├── services/                   # Azure Maps, Azure SMS, Firebase FCM
│   ├── models.py                   # SQLAlchemy ORM models
│   ├── schemas.py                  # Pydantic v2 request/response schemas
│   ├── database.py                 # Async SQLAlchemy engine + session
│   ├── auth.py                     # JWT creation/validation, bcrypt hashing
│   ├── websocket_manager.py        # In-memory WebSocket connection registry
│   ├── main.py                     # FastAPI app factory, middleware, routers
│   ├── seed.py                     # Hyderabad mock data (5 drivers, 8 hubs, 50 deliveries)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── startup.sh
├── mobile/                         # Flutter mobile app (BLoC + feature-first)
│   ├── lib/
│   │   ├── core/                   # Config, theme, network, DI, storage
│   │   ├── features/               # auth/, driver/, hub/
│   │   └── shared/                 # Widgets, models
│   ├── android/
│   ├── assets/
│   ├── pubspec.yaml
│   └── pubspec.lock
├── .env.example                    # All environment variables with comments
├── .gitignore
├── docker-compose.yml              # Backend + PostgreSQL for local Docker dev
└── README.md
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Flutter | 3.19.0+ |
| Dart SDK | 3.3.0+ |
| Docker + Docker Compose | Latest stable |
| Android SDK | API 21+ (for mobile) |

---

## Quick Start — Local Development

### 1. Clone and configure environment

```bash
git clone https://github.com/your-org/neardrop.git
cd NearDrop
cp .env.example .env
```

Open `.env` and fill in at minimum:
```
JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
```
All other values are optional for local dev — Azure and Firebase services degrade gracefully if keys are missing.

---

### 2. Backend setup

#### Option A: Docker (recommended — includes PostgreSQL)

```bash
docker compose up --build
```

The API will be available at `http://localhost:8000`.
API docs (Swagger UI) at `http://localhost:8000/docs`.

To seed mock data into the running container:
```bash
docker compose exec backend python seed.py
```

#### Option B: Manual (SQLite, no Docker required)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example ../.env

# Seed Hyderabad mock data
python seed.py

# Start dev server
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`. Swagger UI at `http://localhost:8000/docs`.

---

### 3. Azure credentials — where to get them

All Azure keys go in your root `.env` file. Every service degrades gracefully if the key is missing, so you only need to configure what you actually use.

| Variable | Service | Where to find it |
|---|---|---|
| `AZURE_SPEECH_KEY` | Azure Cognitive Services — Speech | portal.azure.com → your Speech resource → **Keys and Endpoint** |
| `AZURE_SPEECH_REGION` | Azure Cognitive Services — Speech | Same page, e.g. `eastus` or `centralindia` |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Azure Maps | portal.azure.com → your Maps account → **Authentication** tab |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Azure Communication Services (SMS) | portal.azure.com → your ACS resource → **Keys** |
| `AZURE_COMMUNICATION_SENDER_PHONE` | Azure Communication Services (SMS) | portal.azure.com → your ACS resource → **Phone numbers** |

---

### 4. Firebase setup (push notifications)

Push notifications are optional. The app works without Firebase — FCM calls are fire-and-forget.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Add an **Android app** with package name `com.neardrop.app`.
3. Download `google-services.json` and place it at `mobile/android/app/google-services.json`.
4. In Project Settings → **Service Accounts** → click **Generate new private key**.
5. Open the downloaded JSON file, copy the entire contents, and paste it as a single-line string into `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   ```

---

### 5. Flutter mobile app setup

```bash
cd mobile
flutter pub get
```

**Configure the backend URL** in `mobile/lib/core/config/app_config.dart`:

| Scenario | Value for `baseUrl` |
|---|---|
| Android emulator (default) | `http://10.0.2.2:8000` |
| Physical device on same WiFi | `http://192.168.X.X:8000` (your machine's LAN IP) |
| Production | `https://neardrop-api.azurewebsites.net` |

Run on a connected device or emulator:
```bash
flutter run
```

---

### 6. Test credentials (seeded)

Run `python seed.py` (or `docker compose exec backend python seed.py`) to populate the database, then log in with:

| Role | Phone | Password |
|---|---|---|
| Driver | 9000000001 | driver123 |
| Driver | 9000000002 | driver123 |
| Driver | 9000000003 | driver123 |
| Hub Owner | 9000000004 | hub123 |
| Hub Owner | 9000000005 | hub123 |
| Hub Owner | 9000000006 | hub123 |

Hub owner `9000000004` (Sri Ram Kirana Store) has a pre-accepted broadcast with pickup code **847291**.

---

## Deployment — Azure App Service

### 1. Build and push the Docker image

```bash
# Log in to Azure Container Registry
az acr login --name <your-registry-name>

# Build and tag
docker build -t <your-registry-name>.azurecr.io/neardrop-backend:latest ./backend

# Push
docker push <your-registry-name>.azurecr.io/neardrop-backend:latest
```

### 2. Deploy to App Service

```bash
az webapp create \
  --resource-group <your-rg> \
  --plan <your-plan> \
  --name neardrop-api \
  --deployment-container-image-name <your-registry-name>.azurecr.io/neardrop-backend:latest
```

### 3. Set environment variables

In the Azure Portal: **App Service → Configuration → Application settings**, add every variable from `.env.example` with your production values.

Or via CLI:
```bash
az webapp config appsettings set \
  --resource-group <your-rg> \
  --name neardrop-api \
  --settings DATABASE_URL="postgresql+asyncpg://..." JWT_SECRET_KEY="..." ...
```

---

## Architecture

```mermaid
graph TD
    A[Flutter Mobile App] -->|REST + JWT| B[FastAPI Backend]
    A -->|WebSocket /ws| B
    B --> C[(SQLite / PostgreSQL)]
    B --> D[Azure Speech Services]
    B --> E[Azure Maps]
    B --> F[Azure Communication Services]
    B --> G[Firebase FCM]
    B --> H[WebSocket Manager\nin-memory broadcast]
```

### Key design decisions

| Decision | Current implementation | Production path |
|---|---|---|
| Database | SQLite (dev) / PostgreSQL (prod) | Azure PostgreSQL Flexible Server |
| Geosearch | Haversine in Python, loads all hubs | PostGIS `ST_DWithin` with GIST index |
| WebSocket | In-memory `ConnectionManager` | Redis pub/sub (multi-worker safe) |
| Auth | JWT, 30-day expiry, bcrypt passwords | Same — no changes needed |
| Push notifications | Firebase FCM, fire-and-forget | Same |

### API routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Phone + password login, returns JWT |
| `GET` | `/auth/me` | Current user profile |
| `GET` | `/driver/{id}/score` | Trust score + recent delivery history |
| `GET` | `/driver/{id}/active_delivery` | Current active delivery |
| `POST` | `/driver/fcm-token` | Register device push token |
| `POST` | `/delivery/fail` | Mark delivery failed, trigger hub broadcast |
| `POST` | `/delivery/{id}/complete` | Mark delivery as delivered |
| `GET` | `/hubs/nearby` | Hubs within radius of coordinates |
| `GET` | `/hubs/{id}/active_broadcasts` | Pending broadcasts for a hub |
| `POST` | `/hub/accept` | Accept a broadcast, receive pickup code |
| `GET` | `/dashboard/stats` | Fleet-wide stats and CO₂ saved |
| `GET` | `/dashboard/fleet` | All driver positions and statuses |
| `GET` | `/dashboard/hourly` | Hourly delivery/failure counts |
| `GET` | `/dashboard/leaderboard` | Drivers ranked by completions + trust |
| `POST` | `/voice/azure-token` | Short-lived Azure Speech token for Flutter |
| `WS` | `/ws` | Real-time delivery events |
| `GET` | `/health` | Health check |
