#!/bin/bash
set -e

echo "============================================"
echo "  NearDrop - Starting Development Servers"
echo "============================================"
echo

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found. Please install Python 3.11+"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt -q

# Copy .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "Creating backend .env file..."
    cp backend/.env.example backend/.env
fi

# Seed the database
echo "Seeding database..."
python -m backend.seed

# Install frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

# Start backend in background
echo "Starting backend server..."
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend in background
echo "Starting frontend server..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo
echo "============================================"
echo "  NearDrop is running!"
echo "============================================"
echo
echo "  Driver PWA:   http://localhost:5173/driver"
echo "  Hub App:      http://localhost:5173/hub"
echo "  Dashboard:    http://localhost:5173/dashboard"
echo "  API Docs:     http://localhost:8000/docs"
echo
echo "Press Ctrl+C to stop all servers."
echo

# Stop both servers on Ctrl+C
trap "echo; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait $BACKEND_PID $FRONTEND_PID
