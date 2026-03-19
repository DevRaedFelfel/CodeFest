# CodeFest — WSL Setup Guide

Pull and run the CodeFest backend on WSL (Windows Subsystem for Linux).

## Prerequisites

- **WSL 2** with Ubuntu (or any Debian-based distro)
- **Docker** installed inside WSL

### Install Docker in WSL (if not already installed)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

Log out and back in (or run `newgrp docker`) for the group change to take effect.

Verify:

```bash
docker --version
docker compose version
```

## Clone and Run

```bash
# 1. Clone the repo
git clone https://github.com/DevRaedFelfel/CodeFest.git
cd CodeFest

# 2. Create the .env file
cat > .env << 'EOF'
POSTGRES_PASSWORD=codefest_pass_2024
EOF

# 3. Start PostgreSQL first (wait for it to be healthy)
docker compose up -d postgres

# 4. Check PostgreSQL is ready
docker compose ps

# 5. Start the API
docker compose up -d --build api

# 6. Verify everything is running
docker compose ps
```

## Verify

```bash
# Health check
curl http://localhost:5000/api/health

# Seed the challenges
curl -X POST http://localhost:5000/api/challenges/seed

# List challenges
curl http://localhost:5000/api/challenges
```

## Access from Other Devices on the Network

```bash
# Find your WSL IP
hostname -I

# Students/teacher connect to:
# API:         http://<WSL_IP>:5000
# SignalR Hub: http://<WSL_IP>:5000/hubs/codefest
# Swagger:     http://<WSL_IP>:5000/swagger
```

## Useful Commands

```bash
# View API logs
docker compose logs -f api

# Restart everything
docker compose down && docker compose up -d --build

# Stop everything (data is preserved in PostgreSQL volume)
docker compose down

# Stop everything AND delete data
docker compose down -v

# Open PostgreSQL shell
docker compose exec postgres psql -U codefest -d codefest
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker: permission denied` | Run `sudo usermod -aG docker $USER` then log out/in |
| PostgreSQL not starting | Check logs: `docker compose logs postgres` |
| API can't connect to PostgreSQL | Wait for health check: `docker compose ps` should show `healthy` |
| Port 5000 already in use | Change the port in `docker-compose.yml` under `api.ports` |
| Port 5433 already in use | Change the port mapping in `docker-compose.yml` under `postgres.ports` |
