# God Agent - Production Dockerfile
# ==================================

# Stage 1: Build the frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build the backend
FROM node:22-slim AS backend-builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Stage 3: Production image
FROM node:22-slim AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built backend
COPY --from=backend-builder /app/dist ./dist

# Copy frontend server and built assets
COPY frontend/server ./frontend/server
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --omit=dev

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy necessary runtime files
COPY .claude/agents ./.claude/agents
COPY specs ./specs

# Create necessary directories
RUN mkdir -p .god-agent .agentdb logs

# Environment variables
ENV NODE_ENV=production
ENV PORT=4200

# Expose the port
EXPOSE 4200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4200/api/health || exit 1

# Start the combined server
CMD ["node", "--loader", "tsx", "frontend/server/index.ts"]

