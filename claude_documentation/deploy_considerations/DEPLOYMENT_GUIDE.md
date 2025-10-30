# Deployment Guide

> Practical guide for deploying the Buyer List Builder in various environments

---

## Deployment Options

### Option 1: Local Development (Current)

**Best for:** Development, testing, small-scale usage (1-5 clients)

```bash
# Run directly on your Mac
python stage_3_web_search_expansion_parallel.py cim.yaml --workers 8
```

**Pros:**
- ✅ Simple setup
- ✅ Full Agent SDK capabilities
- ✅ Easy debugging
- ✅ No infrastructure overhead

**Cons:**
- ❌ Tied to your machine
- ❌ Can't run while machine is off
- ❌ Limited by local resources

---

### Option 2: Single Server Deployment

**Best for:** Production use, 5-20 clients, dedicated server

#### Setup

```bash
# 1. Provision server (Ubuntu 22.04)
# AWS EC2, DigitalOcean Droplet, etc.

# 2. Install dependencies
sudo apt update
sudo apt install -y python3.11 python3.11-venv git

# 3. Install Claude CLI
curl -o- https://claude.ai/install.sh | bash

# 4. Clone repository
git clone https://github.com/yourusername/buyer-list-builder.git
cd buyer-list-builder

# 5. Setup Python environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 6. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 7. Create data directory
mkdir -p data/outputs

# 8. Run pipeline
python stages/stage_3_web_search_expansion_parallel.py clients/client1/cim.yaml
```

#### Systemd Service

```ini
# /etc/systemd/system/buyer-list-builder.service

[Unit]
Description=Buyer List Builder Pipeline
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/buyer-list-builder
Environment="PATH=/home/ubuntu/buyer-list-builder/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="ANTHROPIC_API_KEY=your-key-here"
ExecStart=/home/ubuntu/buyer-list-builder/venv/bin/python run_pipeline.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable buyer-list-builder
sudo systemctl start buyer-list-builder
sudo systemctl status buyer-list-builder
```

---

### Option 3: Docker Container

**Best for:** Reproducible deployments, multiple environments

#### Dockerfile

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI
RUN curl -o- https://claude.ai/install.sh | bash

# Set working directory
WORKDIR /app

# Copy requirements first (for layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data/outputs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV CLAUDE_SESSION_DIR=/app/data/outputs/.claude_sessions

# Volume for persistent data
VOLUME /app/data/outputs

# Default command
CMD ["python", "run_pipeline.py"]
```

#### Build and Run

```bash
# Build image
docker build -t buyer-list-builder:latest .

# Run container
docker run -d \
  --name buyer-list-builder \
  -v $(pwd)/data/outputs:/app/data/outputs \
  -e ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
  -e LISTING_ID=cranbury_and_dunwell \
  buyer-list-builder:latest

# View logs
docker logs -f buyer-list-builder

# Execute commands
docker exec buyer-list-builder \
  python stages/stage_3_web_search_expansion_parallel.py \
  /app/clients/client1/cim.yaml
```

#### Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  buyer-list-builder:
    build: .
    container_name: buyer-list-builder
    volumes:
      - ./data/outputs:/app/data/outputs
      - ./clients:/app/clients:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LISTING_ID=${LISTING_ID}
    restart: unless-stopped
    command: python run_pipeline.py

  # Optional: Web dashboard
  dashboard:
    build: ./dashboard
    container_name: buyer-list-dashboard
    ports:
      - "5000:5000"
    volumes:
      - ./data/outputs:/app/data/outputs:ro
    depends_on:
      - buyer-list-builder
    restart: unless-stopped
```

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

### Option 4: Container-Per-Client

**Best for:** High isolation requirements, concurrent processing

```yaml
# docker-compose.yml

version: '3.8'

services:
  client-cranbury:
    build: .
    container_name: buyer-list-cranbury
    volumes:
      - ./data/outputs/cranbury_and_dunwell:/app/data
      - ./clients/cranbury_and_dunwell:/app/client:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LISTING_ID=cranbury_and_dunwell
    networks:
      - buyer-list-network
    restart: unless-stopped

  client-tech-solutions:
    build: .
    container_name: buyer-list-tech-solutions
    volumes:
      - ./data/outputs/tech_solutions:/app/data
      - ./clients/tech_solutions:/app/client:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LISTING_ID=tech_solutions
    networks:
      - buyer-list-network
    restart: unless-stopped

networks:
  buyer-list-network:
    driver: bridge
```

---

### Option 5: Kubernetes

**Best for:** Large scale, auto-scaling, high availability

#### Deployment

```yaml
# k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: buyer-list-builder
spec:
  replicas: 1
  selector:
    matchLabels:
      app: buyer-list-builder
  template:
    metadata:
      labels:
        app: buyer-list-builder
    spec:
      containers:
      - name: buyer-list-builder
        image: buyer-list-builder:latest
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: anthropic-api-key
        volumeMounts:
        - name: data
          mountPath: /app/data/outputs
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: buyer-list-data
```

#### Persistent Volume Claim

```yaml
# k8s/pvc.yaml

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: buyer-list-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard
```

#### Job for Pipeline Execution

```yaml
# k8s/job.yaml

apiVersion: batch/v1
kind: Job
metadata:
  name: buyer-list-cranbury
spec:
  ttlSecondsAfterFinished: 86400  # Auto-delete after 24 hours
  template:
    spec:
      containers:
      - name: pipeline
        image: buyer-list-builder:latest
        args:
          - "python"
          - "stages/stage_3_web_search_expansion_parallel.py"
          - "/app/clients/cranbury/cim.yaml"
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: anthropic-api-key
        - name: LISTING_ID
          value: "cranbury_and_dunwell"
        volumeMounts:
        - name: data
          mountPath: /app/data/outputs
        - name: client-config
          mountPath: /app/clients
          readOnly: true
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: buyer-list-data
      - name: client-config
        configMap:
          name: client-configs
      restartPolicy: Never
  backoffLimit: 3
```

```bash
# Deploy
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/job.yaml

# Monitor
kubectl get pods
kubectl logs -f buyer-list-cranbury-xxxxx

# Cleanup
kubectl delete job buyer-list-cranbury
```

---

## Environment Configuration

### .env File

```bash
# .env

# API Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
APOLLO_API_KEY=xxxxx
NEVERBOUNCE_API_KEY=xxxxx

# Session Configuration
CLAUDE_SESSION_DIR=/app/data/outputs/.claude_sessions
MAX_SESSION_AGE_DAYS=7

# Pipeline Configuration
DEFAULT_WORKERS=8
DEFAULT_TIMEOUT=900

# Logging
LOG_LEVEL=INFO
LOG_FILE=/app/logs/pipeline.log
```

### Environment-Specific Configs

```python
# config.py

import os
from pathlib import Path

class Config:
    # API Keys
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    APOLLO_API_KEY = os.getenv('APOLLO_API_KEY')
    NEVERBOUNCE_API_KEY = os.getenv('NEVERBOUNCE_API_KEY')
    
    # Paths
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR / 'data' / 'outputs'
    CLIENTS_DIR = BASE_DIR / 'clients'
    
    # Session Configuration
    CLAUDE_SESSION_DIR = os.getenv('CLAUDE_SESSION_DIR', str(DATA_DIR / '.claude_sessions'))
    MAX_SESSION_AGE_DAYS = int(os.getenv('MAX_SESSION_AGE_DAYS', '7'))
    
    # Pipeline Configuration
    DEFAULT_WORKERS = int(os.getenv('DEFAULT_WORKERS', '8'))
    DEFAULT_TIMEOUT = int(os.getenv('DEFAULT_TIMEOUT', '900'))
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', str(BASE_DIR / 'logs' / 'pipeline.log'))

class DevelopmentConfig(Config):
    DEBUG = True
    DEFAULT_WORKERS = 4

class ProductionConfig(Config):
    DEBUG = False
    DEFAULT_WORKERS = 8

# Select config based on environment
ENV = os.getenv('ENV', 'development')
config = ProductionConfig() if ENV == 'production' else DevelopmentConfig()
```

---

## Monitoring and Logging

### Logging Setup

```python
# logging_config.py

import logging
from pathlib import Path

def setup_logging(log_file: str = None, log_level: str = 'INFO'):
    """Configure logging for the application"""
    
    # Create logs directory
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),  # Console
            logging.FileHandler(log_file) if log_file else logging.NullHandler()
        ]
    )
    
    # Set third-party loggers to WARNING
    logging.getLogger('anthropic').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)
```

### Health Check Endpoint

```python
# health_check.py

from fastapi import FastAPI
from pathlib import Path
import sqlite3

app = FastAPI()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check"""
    checks = {}
    
    # Check data directory
    data_dir = Path("data/outputs")
    checks["data_directory"] = {
        "exists": data_dir.exists(),
        "writable": os.access(data_dir, os.W_OK) if data_dir.exists() else False
    }
    
    # Check Claude CLI
    import shutil
    checks["claude_cli"] = {
        "installed": shutil.which("claude") is not None
    }
    
    # Check API keys
    checks["api_keys"] = {
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY"))
    }
    
    overall_status = all(
        check.get("exists", True) and check.get("installed", True) 
        for check in checks.values()
    )
    
    return {
        "status": "healthy" if overall_status else "unhealthy",
        "checks": checks
    }
```

---

## Backup and Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/buyer-list-builder"
DATA_DIR="/app/data/outputs"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup all client data
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" "$DATA_DIR"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "data_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/data_$DATE.tar.gz"
```

### Restore

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
DATA_DIR="/app/data/outputs"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# Stop services
docker-compose down

# Restore data
tar -xzf "$BACKUP_FILE" -C /

# Start services
docker-compose up -d

echo "Restore completed from: $BACKUP_FILE"
```

---

## Security Best Practices

### 1. API Key Management

```bash
# Use environment variables, never commit keys
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# Or use secrets management
# AWS Secrets Manager, HashiCorp Vault, etc.
```

### 2. File Permissions

```bash
# Restrict access to data directory
chmod 700 data/outputs

# Restrict access to .env file
chmod 600 .env
```

### 3. Network Security

```yaml
# docker-compose.yml with network isolation

services:
  buyer-list-builder:
    networks:
      - internal
    # No exposed ports

  dashboard:
    networks:
      - internal
      - external
    ports:
      - "5000:5000"

networks:
  internal:
    internal: true
  external:
```

### 4. Container Security

```dockerfile
# Run as non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Use specific versions
FROM python:3.11.6-slim

# Scan for vulnerabilities
# docker scan buyer-list-builder:latest
```

---

## Troubleshooting

### Common Issues

#### 1. Claude CLI Not Found

```bash
# Check if Claude CLI is installed
which claude

# Install if missing
curl -o- https://claude.ai/install.sh | bash

# Add to PATH
export PATH="$HOME/.claude/local:$PATH"
```

#### 2. Permission Denied

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/outputs
chmod -R 755 data/outputs
```

#### 3. Out of Memory

```bash
# Reduce workers
python stage_3_web_search_expansion_parallel.py cim.yaml --workers 4

# Or increase container memory
docker run -m 4g buyer-list-builder
```

#### 4. Session Not Found

```bash
# Check session directory
ls -la data/outputs/client_name/.claude_sessions

# Verify CLAUDE_SESSION_DIR
echo $CLAUDE_SESSION_DIR

# Set explicitly
export CLAUDE_SESSION_DIR=/app/data/outputs/.claude_sessions
```

---

## Summary

Choose deployment based on your needs:

- **Local**: Development, testing, small scale
- **Single Server**: Production, 5-20 clients
- **Docker**: Reproducible deployments
- **Container-Per-Client**: High isolation, concurrent processing
- **Kubernetes**: Large scale, auto-scaling

Always:
- ✅ Use environment variables for secrets
- ✅ Implement health checks
- ✅ Set up logging and monitoring
- ✅ Regular backups
- ✅ Follow security best practices
