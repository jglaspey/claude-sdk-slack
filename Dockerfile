FROM node:20-slim

# Install required system dependencies for Claude Code CLI
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy application code
COPY . .

# Build TypeScript (if needed, though we're committing dist/)
# RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
