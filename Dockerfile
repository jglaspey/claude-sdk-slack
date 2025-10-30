# Optional Dockerfile for local testing
# Railway will use Nixpacks by default, but this is useful for local Docker testing

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
