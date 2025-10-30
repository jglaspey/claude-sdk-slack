#!/bin/bash
# ABOUTME: Startup script that initializes git repo in /tmp and starts the app
# ABOUTME: Ensures Claude Code CLI has a valid git repository to work in

# Initialize git repository in /tmp if it doesn't exist
if [ ! -d "/tmp/.git" ]; then
  cd /tmp
  git init
  git config user.name "Claude Agent"
  git config user.email "agent@claude.ai"
  echo "Initialized git repository in /tmp"
fi

# Start the application
cd /app
npm start
