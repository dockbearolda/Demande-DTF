#!/bin/bash

set -e

echo "🛑 Stopping OMS development environment..."
echo ""

# Stop frontend (kill all npm dev processes)
echo "Stopping frontend..."
pkill -f "npm run dev" || echo "Frontend already stopped"

# Stop backend
echo "Stopping backend..."
cd oms-api
docker-compose down
cd ..

echo "✅ All services stopped"
