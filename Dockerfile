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

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Verify installations
RUN which node && which npm && which claude
RUN node --version && npm --version
RUN ls -la /usr/local/bin/claude

# Copy application code
COPY . .

# Copy Node.js wrapper to /app directory
COPY claude-wrapper.js /app/claude-wrapper.js
RUN chmod +x /app/claude-wrapper.js

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

# Verify at runtime that claude and wrapper exist
RUN test -f /usr/local/bin/claude && echo "claude exists" || echo "claude missing"
RUN test -x /usr/local/bin/claude && echo "claude executable" || echo "claude not executable"
RUN test -f /app/claude-wrapper.js && echo "wrapper exists in /app" || echo "wrapper missing from /app"
RUN test -x /app/claude-wrapper.js && echo "wrapper executable in /app" || echo "wrapper not executable in /app"
RUN ls -la /app/claude-wrapper.js
RUN head -1 /app/claude-wrapper.js

# Start the application
CMD ["/usr/local/bin/node", "dist/index.js"]
