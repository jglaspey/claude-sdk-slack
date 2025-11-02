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

# Suppress npm update notices
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci --no-fund

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

# Create non-root user for running the app (use UID 1001 to avoid conflicts)
RUN useradd -m -u 1001 appuser && \
    mkdir -p /home/appuser/.claude && \
    chown -R appuser:appuser /home/appuser

# Set environment variables for runtime
ENV NODE_ENV=production
ENV NODE=/usr/local/bin/node
ENV HOME=/home/appuser

# Copy API key helper script
COPY api-key-helper.sh /usr/local/bin/api-key-helper.sh
RUN chmod +x /usr/local/bin/api-key-helper.sh

# Set up Claude Code settings to use apiKeyHelper instead of OAuth
# Create both .claude.json (user config) and .claude/settings.json (project config)
RUN mkdir -p /root/.claude && \
    echo '{"apiKeyHelper":"/usr/local/bin/api-key-helper.sh","numStartups":1,"installMethod":"docker","autoUpdates":false,"hasCompletedOnboarding":true,"subscriptionNoticeCount":0,"hasAvailableSubscription":true}' > /root/.claude.json && \
    echo '{"apiKeyHelper":"/usr/local/bin/api-key-helper.sh"}' > /root/.claude/settings.json && \
    cat /root/.claude.json && \
    cat /root/.claude/settings.json

# Test the CLI manually to see what error it gives
# This will help us debug the exit code 1
RUN echo "Testing CLI with mock API key..." && \
    ANTHROPIC_API_KEY=sk-test-12345 /usr/local/bin/node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js --help || echo "CLI test failed with exit code $?"

# Verify at runtime that claude wrapper exists  
RUN test -f /app/claude && echo "wrapper exists in /app" || echo "wrapper missing from /app"
RUN test -x /app/claude && echo "wrapper executable in /app" || echo "wrapper not executable in /app"
RUN ls -la /app/claude
RUN cat /app/claude

# Give appuser ownership of /app
RUN chown -R appuser:appuser /app

# Install gosu for switching users in entrypoint
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Create entrypoint script that sets up session symlink
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'echo "[Entrypoint] Running as:" && id' >> /entrypoint.sh && \
    echo 'if [ -d /data ]; then' >> /entrypoint.sh && \
    echo '  echo "[Entrypoint] Fixing /data permissions..."' >> /entrypoint.sh && \
    echo '  chown -R appuser:appuser /data' >> /entrypoint.sh && \
    echo '  mkdir -p /data/.claude_sessions' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'echo "[Entrypoint] Setting up Claude sessions symlink..."' >> /entrypoint.sh && \
    echo 'su appuser -c "mkdir -p /home/appuser/.claude"' >> /entrypoint.sh && \
    echo 'su appuser -c "ln -sfn /data/.claude_sessions /home/appuser/.claude/sessions"' >> /entrypoint.sh && \
    echo 'echo "[Entrypoint] Symlink created: /home/appuser/.claude/sessions -> /data/.claude_sessions"' >> /entrypoint.sh && \
    echo 'echo "[Entrypoint] Switching to appuser..."' >> /entrypoint.sh && \
    echo 'exec gosu appuser /usr/local/bin/node dist/index.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Start the application
ENTRYPOINT ["/entrypoint.sh"]
