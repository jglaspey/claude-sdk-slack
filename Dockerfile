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

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Verify claude still exists after prune
RUN which claude && ls -la /usr/local/bin/claude

# Expose port
EXPOSE 8080

# Set environment variables for runtime
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]
