# NearDrop: Intelligent Last-Mile Delivery Recovery

![NearDrop Hero](file:///home/pandu/.gemini/antigravity/brain/348c7da6-7bea-43e4-b4f0-9f03430a58b0/neardrop_hero_1774617764734.png)

NearDrop is a full-stack last-mile delivery recovery platform designed to minimize failed deliveries and optimize urban logistics. Instead of returning failed packages to distant redistribution centers, NearDrop empowers drivers to securely drop packages at local **Hubs** (Kirana stores, pharmacies, or apartment receptions), ensuring faster secondary delivery and reduced operational costs.

## 🚀 Vision
In the current logistics landscape, a 'failed delivery' (recipient not available) costs companies significant time, fuel, and customer satisfaction. NearDrop creates a decentralized network of neighborhood hubs that act as intermediate drop-off points, turning every street corner into a potential micro-warehouse.

## 🛠️ Tech Stack
NearDrop is built with a modern, high-performance stack:
- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL/PostGIS (Support for SQLite included), WebSockets.
- **Frontend**: React (Vite), Tailwind CSS, Leaflet.js (Mapping), Recharts (Analytics).
- **Communication**: Real-time fleet tracking via WebSockets.
- **Interaction**: Voice-activated driver actions for hands-free delivery management.

## 📱 Core Interfaces
The platform consists of three distinct applications served from a single codebase:
- **🚐 Driver PWA**: Hands-free interface for delivery tracking, navigation, and one-tap 'Hub-Drop' for failed deliveries.
- **🏪 Hub Owner App**: For local shop owners to manage incoming packages, verify pickups with secure codes, and track their daily earnings.
- **📊 Operator Dashboard**: Comprehensive real-time tracking of the entire fleet, failed delivery hotspots, and system-wide performance metrics.

## 📂 Project Structure
```text
NearDrop/
├── backend/            # FastAPI application
│   ├── routes/         # Modular API endpoints (delivery, hubs, etc.)
│   ├── models.py       # Database schema (SQLAlchemy)
│   ├── websocket_manager.py # Real-time communication orchestrator
│   └── seed.py         # Mock data generator (Hyderabad context)
├── frontend/           # React dashboard & PWAs
│   ├── src/pages/      # Feature-specific pages (driver, hub, dashboard)
│   ├── src/hooks/      # Shared logic (useVoice, useSocket)
│   └── src/components/ # Reusable UI components (LeafletMap, MicButton)
└── neardrop.db         # Local SQLite database (for quick setup)
```

## 🚥 Getting Started

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Run the development server: `uvicorn main:app --reload`
4. (Optional) Seed the database: `python -m seed`

### Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

## 💎 Features
- **Intelligent Routing**: Real-time maps with dynamic route updates.
- **Trust Scores**: Proprietary trust-scoring system for both drivers and hub owners.
- **Earnings Tracking**: Real-time payout calculation for neighborhood hubs.
- **Voice Intelligence**: NLP-powered voice commands for drivers to report delivery status.

## 📝 License
This project is licensed under the MIT License.
