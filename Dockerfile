# Use Node.js 18 as base image
FROM node:18-slim

# Install required dependencies for Claude Code CLI
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Configure git (required by Claude Code CLI)
RUN git config --global user.name "Claude Agent" && \
    git config --global user.email "agent@claude.ai" && \
    git config --global init.defaultBranch main

# Set working directory
WORKDIR /app

# Create session directory for Claude CLI
RUN mkdir -p /app/.claude_sessions && \
    chmod 755 /app/.claude_sessions

# Install Claude Code CLI globally (required by Claude Agent SDK)
RUN npm install -g @anthropic-ai/claude-code && \
    which claude && \
    claude --version && \
    echo "✅ Claude Code CLI installed successfully"

# Set Claude session directory
ENV CLAUDE_SESSION_DIR=/app/.claude_sessions

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Make startup script executable
RUN chmod +x start.sh

# Create non-root user to run the app (Claude CLI won't allow bypassPermissions as root)
RUN useradd -m -u 1001 -s /bin/bash appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /tmp && \
    chown -R appuser:appuser /app/.claude_sessions

# Switch to non-root user
USER appuser

# Expose port (Railway sets PORT env var to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application with startup script
CMD ["./start.sh"]
