# Multi-stage build for llm-cost-telemetry
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source and config files
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Build the project
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production && npm cache clean --force

# Production stage
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S app && adduser -S app -u 1001

# Set working directory
WORKDIR /app

# Copy built files from builder
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY package.json ./

# Switch to non-root user
USER app

# Expose port for health checks
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Set entrypoint
ENTRYPOINT ["dumb-init", "node", "dist/cli.js"]

# Default command
CMD ["--help"]
