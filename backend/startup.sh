#!/bin/bash
# Azure App Service / Docker startup script
# Runs database seed then launches the server
set -e

echo "Running database seed..."
python seed.py

echo "Starting NearDrop API..."
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
