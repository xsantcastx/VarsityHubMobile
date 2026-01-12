# Use Node.js 20 LTS Debian-based image for broader libc/SSL support
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install build dependencies (needed for native modules and Prisma engines)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema (needed for postinstall)
COPY ./server/package*.json ./
COPY ./server/prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code, shared files, and startup script
COPY ./server/src ./src
COPY ./server/tsconfig.json ./
COPY ./server/start.sh ./
COPY ./shared ./shared

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce final image size
RUN npm prune --omit=dev

# Set runtime environment
ENV NODE_ENV=production

# Expose the API port (app respects Railway-assigned PORT at runtime)
EXPOSE 4000

# Ensure startup script is present and executable
RUN chmod +x ./start.sh

# Health check
# Note: start-period is 90s to account for cold starts + Prisma client init + migration time
# Interval 30s with 5 retries = 150s total window for recovery from temporary issues
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the server (with migrations)
CMD ["./start.sh"]
