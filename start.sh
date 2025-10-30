#!/bin/bash

# Slack Claude Bot Startup Script
echo "Starting Slack Claude Bot..."

# Check if running in Railway environment
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
  echo "Running in Railway environment: $RAILWAY_ENVIRONMENT"
  echo "Volume mount path: $RAILWAY_VOLUME_MOUNT_PATH"
fi

# Create data directory if it doesn't exist (for local development)
if [ -z "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
  echo "Local development mode - creating data directory..."
  mkdir -p data
fi

# Start the application
echo "Starting Node.js application..."
exec node dist/index.js
