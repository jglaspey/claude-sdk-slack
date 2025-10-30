#!/bin/bash
# ABOUTME: Startup script that initializes git repo in /tmp and starts the app
# ABOUTME: Ensures Claude Code CLI has a valid git repository to work in

# Check if Claude Code CLI is installed
echo "🔍 Checking for Claude Code CLI..."
which claude
if [ $? -eq 0 ]; then
  echo "✅ Claude Code CLI found at: $(which claude)"
  claude --version
else
  echo "❌ ERROR: Claude Code CLI not found in PATH"
  exit 1
fi

# Initialize git repository in /tmp if it doesn't exist
if [ ! -d "/tmp/.git" ]; then
  cd /tmp
  git init
  git config user.name "Claude Agent"
  git config user.email "agent@claude.ai"
  echo "✅ Initialized git repository in /tmp"
fi

# Verify git is working
cd /tmp
git status
echo "✅ Git is working in /tmp"

# Verify session directory
if [ -d "/app/.claude_sessions" ]; then
  echo "✅ Session directory exists: /app/.claude_sessions"
  echo "CLAUDE_SESSION_DIR=$CLAUDE_SESSION_DIR"
else
  echo "❌ ERROR: Session directory not found"
  exit 1
fi

# Start the application
cd /app
echo "🚀 Starting application..."
npm start
