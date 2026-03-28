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
# Copy shared directory (needed for plan-definitions.json)
COPY ./shared ./shared

# Remove expo extends and ensure compilation outputs files
RUN node -e " \
  const fs = require('fs'); \
  const config = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8')); \
  delete config.extends; \
  if (!config.compilerOptions) config.compilerOptions = {}; \
  config.compilerOptions.noEmit = false; \
  fs.writeFileSync('tsconfig.json', JSON.stringify(config, null, 2)); \
  console.log('Updated tsconfig.json:', JSON.stringify(config, null, 2)); \
"

# Build TypeScript using npm run build (matches package.json script)
RUN echo "🔨 Building TypeScript..." && \
    rm -rf dist .tsbuildinfo && \
    npm run build && \
    if [ ! -f dist/index.js ]; then \
        echo "❌ ERROR: dist/index.js not found after build!" && \
        echo "TypeScript config:" && \
        cat tsconfig.json && \
        echo "Checking if dist directory exists:" && \
        ls -la dist/ 2>/dev/null || echo "dist/ does not exist" && \
        echo "Files in src:" && \
        ls -la src/ | head -10 && \
        echo "Running tsc --listFiles to debug:" && \
        npx tsc -p . --listFiles 2>&1 | head -30 && \
        exit 1; \
    fi && \
    echo "✅ Build successful - dist/index.js exists"

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
  CMD node -e "const http=require('http');const port=process.env.PORT||4000;http.get('http://localhost:'+port+'/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

# Start the server (with migrations)
CMD ["./start.sh"]
