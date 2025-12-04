# Docker & Deployment Configuration

**Last Updated:** December 3, 2025  
**Status:** Production-ready with improvements

## 🚀 Quick Start

### Local Development (with Docker)
```bash
cd server
docker-compose -f docker-compose.yml.local up -d

# Verify services
docker-compose -f docker-compose.yml.local ps
docker-compose -f docker-compose.yml.local logs app
```

### Production Deployment

#### 1. Railway (Current Deployment)
Railway automatically builds and deploys from `server/Dockerfile`:
- Reads environment variables from Railway dashboard
- Runs `start.sh` on container startup
- Health checks every 30s

**Environment Variables Required:**
```
DATABASE_URL=postgresql://user:pass@host/db
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
JWT_SECRET=long-random-string-change-in-production
SENTRY_DSN=https://key@sentry.io/project-id
ADMIN_EMAILS=admin@example.com
```

#### 2. Docker Compose (Self-Hosted)
```bash
# Create .env with all required variables
cp .env.example .env
nano .env  # Edit values

# Start services
docker-compose -f docker-compose.yml.prod up -d

# Monitor logs
docker-compose -f docker-compose.yml.prod logs -f app db

# Stop services
docker-compose -f docker-compose.yml.prod down
```

#### 3. Kubernetes (Future)
Use `docker-compose.yml.prod` as reference for:
- Resource limits (1-2 CPU, 1-2GB RAM per replica)
- Health checks (90s start period, 30s interval)
- Environment variables
- Volume persistence

## 📋 Configuration Files

### `server/Dockerfile`
**Purpose:** Build production API image  
**Key Features:**
- Node.js 20 LTS with security updates
- Prisma client generation during build
- Dev dependencies removed for smaller image (~200MB)
- Health check with 90s start period (accounts for cold starts + migrations)

**Build:** `docker build -f server/Dockerfile -t varsityhub-api:latest .`

### `start.sh` (Startup Script)
**Purpose:** Initialize database and launch API  
**Key Features:**
- ✅ Validates required env vars (DATABASE_URL, NODE_ENV)
- ✅ Masks sensitive data in logs
- ✅ Runs Prisma migrations with exponential backoff
- ✅ Logs clear error messages on failure

**Flow:**
1. Validate environment variables
2. Check database connectivity (with retries)
3. Run `npx prisma migrate deploy`
4. Start Node.js server on port 4000

**Timeout Behavior:**
- Default: 25 retries × 2s initial + exponential backoff (up to 10s)
- Total wait: ~300+ seconds before giving up
- If DB unavailable for >300s, container exits with clear error

### `docker-compose.yml.local`
**Purpose:** Local development with hot reload  
**Features:**
- PostgreSQL 15 on port 5432
- App service with volume mounts for code changes
- Environment set to `development` (debug logging, 100% Sentry sampling)
- Automatic restart on crash

**Usage:**
```bash
docker-compose -f docker-compose.yml.local up -d
# Changes to /server/src are reflected without rebuild
docker-compose -f docker-compose.yml.local down
```

### `docker-compose.yml.prod`
**Purpose:** Production-ready configuration  
**Features:**
- Resource limits: 2 CPU / 2GB RAM per container
- Health checks with 90s startup grace period
- Logging: JSON format, 50MB max per file, 10 files rotation
- Environment validation via start.sh
- No volume mounts for code (immutable images only)
- Database health checks before app starts

**Usage:**
```bash
# Create .env with DATABASE_URL and secrets
docker-compose -f docker-compose.yml.prod up -d

# Check status
docker-compose -f docker-compose.yml.prod ps
docker-compose -f docker-compose.yml.prod logs app

# Stop
docker-compose -f docker-compose.yml.prod down
```

## ⚠️ Important Configuration

### Required Environment Variables

| Variable | Example | Required | Purpose |
|----------|---------|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/varsityhub` | ✅ YES | Database connection string |
| `NODE_ENV` | `production` | ✅ YES | Runtime environment |
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ YES (prod) | Payment processing |
| `JWT_SECRET` | `long-random-string-here` | ✅ YES | Session token signing |
| `SENTRY_DSN` | `https://key@sentry.io/123` | ⚠️ RECOMMENDED | Error tracking |
| `ADMIN_EMAILS` | `admin@example.com,moderator@example.com` | Optional | Admin access |

### Optional Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 4000 | API server port |
| `HOST` | 0.0.0.0 | Bind address |
| `PRISMA_MIGRATE_RETRIES` | 25 | Max retry attempts |
| `PRISMA_MIGRATE_SLEEP_SECS` | 2 | Initial retry delay (exponential) |
| `SENTRY_PROFILING_ENABLED` | 0 | Enable performance profiling (1 = yes) |
| `SMTP_HOST`, `SMTP_PASS`, etc. | (empty) | Email notifications |

## 🔧 Health Checks

### API Health Endpoint
```bash
curl http://localhost:4000/health
# Returns: { status: 'ok' } with 200 status
```

### Docker Health Status
```bash
docker-compose ps
# STATUS column shows: Up X seconds (healthy) or Up X seconds (unhealthy)
```

### Manual Database Check
```bash
# From inside container or with psql installed
docker exec varsityhubmobile-db-1 pg_isready -U postgres
# Returns: accepting connections
```

## 🐛 Troubleshooting

### Container won't start
```bash
docker-compose logs app
# Check for:
# - DATABASE_URL not set
# - Database not reachable
# - Migrations have syntax errors
```

### Slow migrations
```bash
# If migrations take >30s:
docker-compose logs db
# Check for index creation, large data operations
# May need to optimize migration or increase start_period
```

### Out of memory
```bash
# If container killed with "OOMKilled":
# Check resource limits in docker-compose.yml.prod
# May need to increase memory: `memory: 4G`
# Or add more replicas with orchestration
```

### Port already in use
```bash
# If "port 5432 already in use":
lsof -i :5432  # Find what's using it
# Or use different port: `- "5433:5432"`
```

## 📊 Resource Allocation

### Local Development
- App: 0.5 CPU, 512MB RAM (soft limit)
- DB: Unlimited (local dev)

### Production
- App: 1-2 CPU, 1-2GB RAM (hardcoded in docker-compose.yml.prod)
- DB: 1 CPU, 1GB RAM
- **Total:** ~3-4 GB RAM needed

Adjust in `docker-compose.yml.prod` under `deploy.resources`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'        # Increase for heavy load
      memory: 4G       # Increase if OOMKilled
    reservations:
      cpus: '2'
      memory: 2G
```

## 🚨 Safety Checks Before Production

- [ ] `DATABASE_URL` is set and correct
- [ ] `JWT_SECRET` is changed (not default)
- [ ] `STRIPE_SECRET_KEY` uses production key (sk_live_)
- [ ] `SENTRY_DSN` configured for error tracking
- [ ] Health check passes: `curl http://localhost:4000/health`
- [ ] Migrations run without errors
- [ ] Database backups enabled
- [ ] Resource limits match infrastructure capacity

## 📚 References

- [Dockerfile best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Docker Compose reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docker image](https://hub.docker.com/_/postgres/)
- [Health checks in Docker](https://docs.docker.com/compose/compose-file/05-services/#healthcheck)
- [Railway deployment guide](https://docs.railway.app/)

## Next Steps

1. **Local testing:** `docker-compose -f docker-compose.yml.local up -d`
2. **Verify migrations:** `docker-compose logs app | grep "Migrations applied"`
3. **Test health check:** `curl http://localhost:4000/health`
4. **Review docker-compose.yml.prod** for production deployment
5. **Update Railway environment variables** with secure values
