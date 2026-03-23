#!/bin/bash
echo "=== CodeFest Launcher ==="

# Stop all running containers
running=$(docker ps -q)
if [ -n "$running" ]; then
  echo "Stopping all running containers..."
  docker stop $running
  echo "Done."
else
  echo "No other containers running."
fi

# Start CodeFest
echo "Starting CodeFest..."
cd "$(dirname "$0")"
docker compose up -d --build

# Wait for API to be ready
echo "Waiting for API..."
for i in $(seq 1 30); do
  if curl -s http://localhost:5050/api/health | grep -q healthy; then
    echo "API is ready!"
    break
  fi
  sleep 2
done

# Seed challenges
echo "Seeding challenges..."
curl -s -X POST http://localhost:5050/api/challenges/seed
echo ""

echo ""
echo "=== CodeFest is running ==="
echo "  Student:  http://localhost:4200/join"
echo "  Teacher:  http://localhost:4200/teacher"
echo "  API Docs: http://localhost:5050/swagger"
