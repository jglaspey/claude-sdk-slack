#!/bin/sh
# Wrapper script to run claude CLI with explicit node path
# This fixes the "spawn node ENOENT" issue in Docker containers
# Using /bin/sh instead of /bin/bash for better compatibility with slim images

exec </dev/null
exec /usr/local/bin/node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"
