# Use Node.js 20 LTS Debian-based image for broader libc/SSL support
# Cache bust: 2026-01-15 - force npm ci to pull fresh lock file
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install build dependencies (needed for native modules and Prisma engines)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema (needed for postinstall)
# Force fresh copy - 2026-01-15T04:40
COPY ./server/package.json ./package.json
COPY ./server/package-lock.json ./package-lock.json
COPY ./server/prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and startup script
COPY ./server/src ./src
COPY ./server/tsconfig.json ./
COPY ./server/start.sh ./start.sh

# Verify TypeScript is installed and can compile
RUN echo "🔍 Verifying TypeScript installation..." && \
    npx tsc --version && \
    echo "🔍 Checking if expo/tsconfig.base.json exists..." && \
    if [ ! -f node_modules/expo/tsconfig.base.json ]; then \
      echo "⚠️  expo tsconfig NOT found - removing extends from tsconfig.json"; \
      sed -i 's/"extends": "expo\/tsconfig.base",//' tsconfig.json || true; \
    else \
      echo "✅ expo tsconfig found"; \
    fi && \
    echo "🔨 Running Prisma generate..." && \
    npx prisma generate && \
    echo "🔨 Building TypeScript directly (showing all output)..." && \
    rm -f .tsbuildinfo && \
    npx tsc -p . --noEmit false 2>&1 | tee /tmp/tsc.log && \
    TSC_EXIT=${PIPESTATUS[0]} && \
    echo "TypeScript exit code: $TSC_EXIT" && \
    if [ "$TSC_EXIT" -ne 0 ]; then \
      echo "❌ TypeScript compilation FAILED!"; \
      echo "TypeScript errors:"; \
      cat /tmp/tsc.log; \
      exit 1; \
    fi && \
    echo "📁 Checking for dist/index.js..." && \
    if [ ! -f dist/index.js ]; then \
      echo "❌ ERROR: dist/index.js not found after TypeScript compilation!"; \
      echo "TypeScript output:"; \
      cat /tmp/tsc.log; \
      echo "Working directory: $(pwd)"; \
      echo "Contents of /app:"; \
      ls -la /app/; \
      echo "Contents of dist/ (if exists):"; \
      ls -la dist/ 2>/dev/null || echo "dist/ directory does not exist!"; \
      echo "Running tsc --listFiles to see what files it compiled:"; \
      npx tsc -p . --listFiles 2>&1 | head -30 || true; \
      echo "Checking TypeScript configuration:"; \
      cat tsconfig.json; \
      exit 1; \
    fi && \
    echo "✅ dist/index.js exists - build successful!"

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
