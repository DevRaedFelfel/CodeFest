# CodeFest — Production Deployment (Linux Server)

Production setup using lightweight Alpine-based images for minimal footprint.

## Images Used

| Service | Image | Size |
|---------|-------|------|
| API build | `mcr.microsoft.com/dotnet/sdk:8.0-alpine` | build only |
| API runtime | `mcr.microsoft.com/dotnet/aspnet:8.0-alpine` | ~85 MB |
| PostgreSQL | `postgres:17-alpine` | ~80 MB |
| Client build | `node:22-alpine` | build only |
| Client runtime | `nginx:1.27-alpine` | ~20 MB |

---

## Prerequisites

On the production Linux server:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version

# Install Git
sudo apt install -y git
```

---

## Step 1: Clone Repository

```bash
cd ~
git clone https://github.com/DevRaedFelfel/CodeFest.git codefest
cd codefest
```

---

## Step 2: Configure Environment

```bash
# Generate a strong password
PASS=$(openssl rand -base64 24)
echo "Generated password: $PASS"

cat > .env << EOF
POSTGRES_PASSWORD=$PASS
EOF

# Restrict permissions
chmod 600 .env
```

---

## Step 3: Build and Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds and starts:
- **api** — .NET 8 API (Alpine, internal only — no exposed port)
- **postgres** — PostgreSQL 17 Alpine (internal only — no exposed port)
- **client** — Nginx 1.27 Alpine on ports `80` and `443`

> Note: In production, only the client (nginx) is exposed. It reverse-proxies `/api/` and `/hubs/` to the API container internally.

---

## Step 4: Seed Challenges

```bash
# Wait for startup
sleep 15

# Seed via the internal docker network
docker compose -f docker-compose.prod.yml exec client \
  wget -qO- --post-data='' http://api:8080/api/challenges/seed

# Or from the host (if api port is exposed):
# curl -X POST http://localhost:5050/api/challenges/seed
```

Alternative — exec into the api container:
```bash
docker compose -f docker-compose.prod.yml exec api \
  wget -qO- --post-data='' http://localhost:8080/api/challenges/seed
```

---

## Step 5: Verify

```bash
# Check containers are running
docker compose -f docker-compose.prod.yml ps

# Check API health via nginx proxy
curl http://localhost/api/health

# Check challenges loaded
curl http://localhost/api/challenges | head -c 200
```

---

## Step 6: HTTPS with Caddy (Recommended)

For automatic HTTPS with Let's Encrypt:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Configure Caddy:
```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
codefest.yourdomain.com {
    reverse_proxy localhost:80
}
EOF

sudo systemctl restart caddy
```

Replace `codefest.yourdomain.com` with your actual domain. Make sure:
- DNS A record points to your server IP
- Ports 80 and 443 are open in your firewall

If using Caddy, change the client port in `docker-compose.prod.yml`:
```yaml
  client:
    ports:
      - "8080:80"   # Caddy handles 80/443
```

Then:
```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
codefest.yourdomain.com {
    reverse_proxy localhost:8080
}
EOF

sudo systemctl restart caddy
docker compose -f docker-compose.prod.yml up -d
```

---

## Operations

### Start / Stop
```bash
cd ~/codefest
docker compose -f docker-compose.prod.yml up -d       # start
docker compose -f docker-compose.prod.yml down         # stop
docker compose -f docker-compose.prod.yml restart      # restart all
docker compose -f docker-compose.prod.yml restart api  # restart API only
```

### Update to latest code
```bash
cd ~/codefest
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f           # all
docker compose -f docker-compose.prod.yml logs -f api       # API
docker compose -f docker-compose.prod.yml logs -f client    # nginx
docker compose -f docker-compose.prod.yml logs -f postgres  # database
```

### Clear all sessions
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d codefest -c \
  "DELETE FROM \"ActivityLogs\"; DELETE FROM \"Submissions\"; DELETE FROM \"Students\"; DELETE FROM \"Sessions\";"
```

### Full reset (delete all data including challenges)
```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
sleep 15
docker compose -f docker-compose.prod.yml exec api \
  wget -qO- --post-data='' http://localhost:8080/api/challenges/seed
```

### Database backup
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres codefest > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database restore
```bash
cat backup_file.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres codefest
```

---

## Firewall Setup

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Do NOT expose postgres (5432) or api (5050) directly
```

---

## Access URLs

| URL | Purpose |
|-----|---------|
| `http://your-server-ip/join` | Student join page |
| `http://your-server-ip/teacher` | Teacher dashboard |
| `https://codefest.yourdomain.com/join` | Student (with HTTPS/Caddy) |
| `https://codefest.yourdomain.com/teacher` | Teacher (with HTTPS/Caddy) |

---

## Android Kiosk Devices

When connecting Android devices to your production server, update the Capacitor config before building the APK:

```bash
# On your dev machine
cd codefest-client
```

Edit `capacitor.config.ts`:
```typescript
server: {
  url: 'https://codefest.yourdomain.com',  // your production URL
  androidScheme: 'https',
}
```

Then build:
```bash
npm run build:android
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Monitoring

### Quick health check script
```bash
#!/bin/bash
# Save as ~/codefest/healthcheck.sh
API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
if [ "$API" = "200" ]; then
  echo "$(date): API OK"
else
  echo "$(date): API DOWN (HTTP $API) — restarting..."
  cd ~/codefest
  docker compose -f docker-compose.prod.yml restart api
fi
```

Add to crontab for automatic monitoring:
```bash
chmod +x ~/codefest/healthcheck.sh
crontab -e
# Add: */5 * * * * ~/codefest/healthcheck.sh >> ~/codefest/health.log 2>&1
```
