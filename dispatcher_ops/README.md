# NearDrop Dispatcher Operations Portal

A next-generation logistics and intelligence dispatch platform built dynamically for high-scale order fulfillment. The portal incorporates automated deterministic business logic engines for Trust Scores, Sustainability (Carbon Reduction), and Operator Cost optimization.

## 🚀 Quick Start (Zero Config)

The architecture is built cleanly to spin up out of the box with zero external configuration. 

### 1. Backend Setup (FastAPI & Database)

The backend utilizes SQLite natively for rapid local environments, so no containerization or external PostgreSQL setup is strictly needed out of the box.

```bash
cd backend
python -m venv venv

# On Windows: 
venv\Scripts\activate
# On Mac/Linux: 
source venv/bin/activate

# Install strictly verified dependencies
pip install -r requirements.txt

# Populate realistic deterministic operations data across 7 cities
python seed.py

# Launch the FastAPI engine on localhost:8000
uvicorn main:app --reload
```

### 2. Frontend Setup (React & Vite)
The frontend utilizes a zero-config proxy out of the box (`vite.config.ts` natively proxies `/api` to `localhost:8000`). No manual `.env` file is required to connect to the local python engine.

```bash
# Return to the project root and install
npm install

# Start the Vite server
npm run dev
```

Navigate to `http://localhost:5173`. 
The default operations portal login credentials are automatically generated via `seed.py`:
- **Email:** `dispatcher@neardrop.in`
- **Password:** `dispatch123`
