# CodeFest — Local Deployment (WSL)

## Prerequisites

- Windows 11 with WSL2 enabled
- Docker installed in WSL (`docker --version` and `docker compose version`)
- Git installed

If Docker is not installed in WSL:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

---

## First-Time Setup

### 1. Clone the repository
```bash
cd ~
git clone https://github.com/DevRaedFelfel/CodeFest.git codefest
cd codefest
```

### 2. Create environment file
```bash
cat > .env << 'EOF'
POSTGRES_PASSWORD=codefest_pass_2024
EOF
```

### 3. Build and start everything
```bash
docker compose up -d --build
```

This starts 3 containers:
- **api** — .NET 8 backend on port `5050`
- **postgres** — PostgreSQL database on port `5432`
- **client** — Angular frontend (nginx) on port `4200`

### 4. Wait for startup and seed challenges
```bash
# Wait for API to be ready
sleep 10

# Seed the 5 default challenges
curl -X POST http://localhost:5050/api/challenges/seed

# Verify
curl http://localhost:5050/api/health
```

### 5. Access the app
| URL | Purpose |
|-----|---------|
| http://localhost:4200/join | Student join page |
| http://localhost:4200/teacher | Teacher dashboard |
| http://localhost:5050/swagger | API documentation |

### 6. Access from other devices on the same network
```bash
# Find your WSL IP
hostname -I
```
Students connect to: `http://<WSL_IP>:4200/join`
Teacher dashboard: `http://<WSL_IP>:4200/teacher`

---

## Daily Usage

### Start
```bash
cd ~/codefest
docker compose up -d
```

### Stop
```bash
docker compose down
```

### Rebuild after code changes
```bash
cd ~/codefest
git pull
docker compose up -d --build
```

### Rebuild only one service
```bash
docker compose up -d --build client   # frontend only
docker compose up -d --build api      # backend only
```

### View logs
```bash
docker compose logs -f           # all services
docker compose logs -f api       # API only
docker compose logs -f client    # client only
```

### Seed challenges (after fresh database)
```bash
curl -X POST http://localhost:5050/api/challenges/seed
```

### Clear all sessions (keep challenges)
```bash
docker compose exec postgres psql -U postgres -d codefest -c \
  "DELETE FROM \"ActivityLogs\"; DELETE FROM \"Submissions\"; DELETE FROM \"Students\"; DELETE FROM \"Sessions\";"
```

### Full reset (delete all data)
```bash
docker compose down -v
docker compose up -d --build
sleep 10
curl -X POST http://localhost:5050/api/challenges/seed
```

### Access PostgreSQL shell
```bash
docker compose exec postgres psql -U postgres -d codefest
```

---

## Run Backend Tests
```bash
cd ~/codefest/CodeFest.Api.Tests
dotnet test
```

---

## Troubleshooting

**Container won't start?**
```bash
docker compose logs api       # check for errors
docker compose ps             # check container status
```

**Database connection refused?**
```bash
# Wait for postgres to be healthy
docker compose ps
# If unhealthy, restart
docker compose restart postgres
sleep 10
docker compose restart api
```

**Port already in use?**
```bash
# Check what's using the port
sudo lsof -i :5050
sudo lsof -i :4200
# Kill the process or change ports in docker-compose.yml
```

**Frontend changes not showing?**
```bash
docker compose up -d --build client
# Hard refresh browser: Ctrl+Shift+R
```
