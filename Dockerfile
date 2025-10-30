# Optional Dockerfile for local testing
# Railway will use Nixpacks by default, but this is useful for local Docker testing

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
