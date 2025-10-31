#!/bin/sh
set -e

# Fix permissions on volume mount point
if [ -d "/data" ]; then
    echo "[Entrypoint] Fixing permissions on /data directory..."
    chown -R appuser:appuser /data
fi

# Switch to appuser and run the application
echo "[Entrypoint] Starting application as appuser..."
exec gosu appuser "$@"
