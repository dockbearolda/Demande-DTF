#!/bin/bash

set -e

echo "🚀 Starting OMS development environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start backend services
echo "📦 Starting backend (PostgreSQL + API)..."
cd oms-api
docker-compose up -d
echo "✅ Backend started (waiting for DB to be healthy)..."
sleep 5

# Check if DB is healthy
until docker-compose exec -T db pg_isready -U oms -d oms > /dev/null 2>&1; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done
echo "✅ PostgreSQL is ready"

# Run migrations
echo "🔄 Running migrations..."
docker-compose exec -T api alembic upgrade head || echo "⚠️  Migrations already applied"

cd ..

# Start frontend in background
echo ""
echo "🎨 Starting frontend (http://localhost:5173)..."
cd oms-frontend
npm install > /dev/null 2>&1
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

cd ..

echo ""
echo "✅ OMS is now running!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔌 API: http://localhost:8000"
echo "📊 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait $FRONTEND_PID
