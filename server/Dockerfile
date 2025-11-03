# Use Node.js 20 LTS Alpine as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies (needed for some native modules like bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files and Prisma schema (needed for postinstall)
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce final image size
RUN npm prune --omit=dev

# Set runtime environment
ENV NODE_ENV=production

# Expose the API port (app respects Railway-assigned PORT at runtime)
EXPOSE 4000

# Ensure startup script is present and executable
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server (with migrations)
CMD ["./start.sh"]
