# Use Node.js 20 LTS Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies (needed for some native modules like bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size (optional)
# RUN npm prune --production

# Expose port
EXPOSE 3000

# Copy and make startup script executable
COPY start.sh ./
RUN chmod +x start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server (with migrations)
CMD ["./start.sh"]
