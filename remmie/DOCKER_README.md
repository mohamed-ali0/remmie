# 🐳 Docker Setup for Remmie Travel Platform

This guide will help you set up and run the Remmie Travel Platform using Docker containers.

## 📋 Prerequisites

- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (included with Docker Desktop)
- At least 4GB RAM available for Docker
- 10GB free disk space

## 🏗️ Architecture Overview

The application consists of 6 services:

- **Frontend**: React + Vite (Nginx in production)
- **Backend**: Node.js + Express API
- **Python AI**: Flask service for AI chat functionality
- **MySQL**: Database for user data and bookings
- **MongoDB**: Database for AI chat history
- **Redis**: Caching layer
- **Nginx**: Reverse proxy (production only)

## 🚀 Quick Start

### 1. Initial Setup

Run the setup script for your platform:

**Linux/macOS:**
```bash
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh
```

**Windows:**
```batch
scripts\docker-setup.bat
```

### 2. Configure Environment

Edit the `.env` file created by the setup script:

```bash
# Required: Update these values
JWT_SECRET=your_super_secret_jwt_key_change_in_production
DB_ROOT_PASSWORD=your_secure_root_password
MONGO_ROOT_PASSWORD=your_secure_mongo_password
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
DUFFEL_ACCESS_TOKENS=your_duffel_api_token
WHATSAPP_TOKEN=your_whatsapp_token
```

### 3. Start the Application

**Development Mode (with hot reload):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

**Production Mode:**
```bash
docker-compose up --build
```

**Production with Nginx Proxy:**
```bash
docker-compose --profile production up --build
```

## 🌐 Access Points

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | http://localhost:80 | https://localhost:443 |
| Backend API | http://localhost:5000 | https://localhost:443/api |
| Python AI | http://localhost:5001 | https://localhost:443/ai |
| MySQL | localhost:3306 | localhost:3306 |
| MongoDB | localhost:27017 | localhost:27017 |
| Redis | localhost:6379 | localhost:6379 |

## 📁 Project Structure

```
remmie-master/
├── backend/                 # Node.js API service
│   ├── Dockerfile          # Production Docker image
│   ├── Dockerfile.dev      # Development Docker image
│   └── ...
├── fronted/                # React frontend
│   ├── Dockerfile          # Production Docker image
│   ├── nginx.conf          # Nginx configuration for frontend
│   └── ...
├── python/                 # Python AI service
│   ├── Dockerfile          # Production Docker image
│   ├── Dockerfile.dev      # Development Docker image
│   └── ...
├── nginx/                  # Reverse proxy configuration
│   ├── nginx.conf          # Main Nginx config
│   └── conf.d/
│       └── default.conf    # Server configuration
├── scripts/                # Setup scripts
├── database/               # Database initialization
├── ssl/                    # SSL certificates (production)
├── docker-compose.yml      # Production configuration
├── docker-compose.dev.yml  # Development configuration
└── env.example            # Environment template
```

## 🔧 Development Commands

### Container Management

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start specific service
docker-compose -f docker-compose.dev.yml up backend

# Rebuild and start
docker-compose -f docker-compose.dev.yml up --build

# Stop all services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
```

### Database Management

```bash
# Access MySQL container
docker exec -it remmie-mysql-dev mysql -u root -p

# Access MongoDB container
docker exec -it remmie-mongodb-dev mongosh

# Backup MySQL database
docker exec remmie-mysql-dev mysqldump -u root -p remmie_db > backup.sql

# Restore MySQL database
docker exec -i remmie-mysql-dev mysql -u root -p remmie_db < backup.sql
```

### Service Management

```bash
# Restart a specific service
docker-compose -f docker-compose.dev.yml restart backend

# Scale a service
docker-compose -f docker-compose.dev.yml up --scale backend=2

# View service status
docker-compose -f docker-compose.dev.yml ps

# Execute command in container
docker exec -it remmie-backend-dev npm install new-package
```

## 🏭 Production Deployment

### 1. SSL Certificates

Place your SSL certificates in the `ssl/` directory:
```
ssl/
├── cert.pem    # Your SSL certificate
└── key.pem     # Your private key
```

### 2. Environment Configuration

Update `.env` for production:
```bash
NODE_ENV=production
FLASK_ENV=production
FRONTEND_URL=https://yourdomain.com
BASE_URL=https://yourdomain.com
SSL_CERT_PATH=/etc/ssl/certs/cert.pem
SSL_KEY_PATH=/etc/ssl/certs/key.pem
```

### 3. Deploy

```bash
# Production deployment
docker-compose --profile production up -d --build

# Check logs
docker-compose logs -f

# Update services
docker-compose pull
docker-compose up -d --build
```

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find and kill process using port
sudo lsof -i :5000
kill -9 <PID>

# Or use different ports in docker-compose.yml
```

**Permission Denied (uploads directory):**
```bash
# Fix permissions
sudo chown -R $USER:$USER backend/uploads
chmod -R 755 backend/uploads
```

**Database Connection Failed:**
```bash
# Check database container
docker-compose logs mysql

# Reset database
docker-compose down -v
docker-compose up --build
```

**Frontend Build Fails:**
```bash
# Clear npm cache
docker-compose exec frontend npm cache clean --force

# Rebuild frontend
docker-compose up --build frontend
```

### Health Checks

All services include health checks. Check status:

```bash
# View health status
docker-compose ps

# Check specific service health
curl http://localhost:5000/api/health
curl http://localhost:5001/
curl http://localhost:80/health
```

### Logs and Monitoring

```bash
# View all logs
docker-compose logs

# Follow logs for specific service
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail 100 python-ai

# Export logs
docker-compose logs > application.log
```

## 🔒 Security Considerations

### Development Environment
- Uses HTTP for simplicity
- Database passwords in `.env` file
- Debug mode enabled for Python service

### Production Environment
- HTTPS enforced through Nginx
- Rate limiting configured
- Security headers enabled
- Non-root user for Python service
- Secrets should be managed externally (Docker secrets, Kubernetes secrets, etc.)

## 📊 Performance Optimization

### Resource Limits

Add resource limits in docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Caching

- Redis is configured for caching
- Nginx caches static assets
- Docker layer caching for faster builds

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          docker-compose pull
          docker-compose up -d --build
```

## 📞 Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify environment variables in `.env`
3. Ensure all required services are running
4. Check port conflicts
5. Review the troubleshooting section above

For additional help, please refer to the main project documentation or create an issue in the repository.
