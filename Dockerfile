# Multi-stage Dockerfile for Kaayaan Strategist AI MCP Server
# Supports both STDIO and HTTP modes

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp

WORKDIR /app

# Copy package files and built application
COPY package*.json ./
COPY --from=builder /app/build ./build/
COPY --from=builder /app/node_modules ./node_modules/

# Copy environment template
COPY .env.example ./

# Set proper ownership
RUN chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Environment configuration
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV WEBSOCKET_PORT=4001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:$PORT/health', (res) => { \
    res.statusCode === 200 ? process.exit(0) : process.exit(1); \
  }).on('error', () => process.exit(1));" || exit 1

# Expose ports
EXPOSE 4000 4001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden)
CMD ["npm", "start"]

# Labels for metadata
LABEL org.opencontainers.image.title="Kaayaan Strategist AI MCP Server"
LABEL org.opencontainers.image.description="Professional market analysis MCP server with dual STDIO/HTTP protocol support"
LABEL org.opencontainers.image.version="2.1.0"
LABEL org.opencontainers.image.authors="Kaayaan Strategist <info@example.com>"
LABEL org.opencontainers.image.url="https://github.com/kaayaan/mcp-kaayaan-strategist"
LABEL org.opencontainers.image.source="https://github.com/kaayaan/mcp-kaayaan-strategist"
LABEL org.opencontainers.image.licenses="MIT"