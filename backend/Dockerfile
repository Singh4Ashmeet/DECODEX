FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Copy package files and install only prod dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory (needed for multer)
RUN mkdir -p uploads audio-storage

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "run", "start:prod"]
