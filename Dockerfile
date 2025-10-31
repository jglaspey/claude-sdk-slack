FROM node:20-slim

# Install required system dependencies for Claude Code CLI
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Ensure node is in PATH for Claude Agent SDK
ENV PATH="/usr/local/bin:$PATH"
ENV NODE_PATH="/usr/local/lib/node_modules"

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Install Claude Code CLI and Agent SDK globally (like receipting/claude-agent-sdk-container)
RUN npm install -g @anthropic-ai/claude-code @anthropic-ai/claude-agent-sdk

# Copy the globally installed claude-code to /app for runtime persistence
RUN cp -r /usr/local/lib/node_modules/@anthropic-ai/claude-code /app/claude-code

# Verify installations
RUN which node && which npm && which claude
RUN node --version && npm --version
RUN ls -la /usr/local/bin/claude
RUN ls -la /app/claude-code/cli.js

# Copy application code
COPY . .

# Create a simple executable wrapper that calls node with absolute path
RUN echo '#!/bin/sh' > /app/claude && \
    echo 'exec /usr/local/bin/node /app/claude-code/cli.js "$@"' >> /app/claude && \
    chmod +x /app/claude

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Verify claude still exists after prune and check the actual file
RUN which claude && ls -la /usr/local/bin/claude
RUN ls -la /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js
RUN head -1 /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js

# Expose port
EXPOSE 8080

# Set environment variables for runtime
ENV NODE_ENV=production
ENV NODE=/usr/local/bin/node
ENV HOME=/root

# Set up Claude Code authentication at build time
# This creates the credential files that the CLI expects
RUN mkdir -p /root/.claude && \
    echo '{"claudeAiOauth":{"accessToken":"placeholder","refreshToken":"placeholder","expiresAt":"2099-12-31T23:59:59.000Z","scopes":["read","write"],"subscriptionType":"pro"}}' > /root/.claude/.credentials.json && \
    echo '{"numStartups":1,"installMethod":"docker","autoUpdates":false,"hasCompletedOnboarding":true,"subscriptionNoticeCount":0,"hasAvailableSubscription":true}' > /root/.claude.json && \
    chmod 600 /root/.claude/.credentials.json /root/.claude.json

# Verify at runtime that claude wrapper exists
RUN test -f /app/claude && echo "wrapper exists in /app" || echo "wrapper missing from /app"
RUN test -x /app/claude && echo "wrapper executable in /app" || echo "wrapper not executable in /app"
RUN ls -la /app/claude
RUN cat /app/claude

# Start the application
CMD ["/usr/local/bin/node", "dist/index.js"]
