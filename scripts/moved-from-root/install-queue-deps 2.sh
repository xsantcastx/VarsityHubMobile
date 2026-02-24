#!/bin/bash

# Install queue system dependencies
echo "📦 Installing Bull and Redis dependencies..."

cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server

npm install bull ioredis
npm install --save-dev @types/bull

echo "✅ Queue dependencies installed successfully"
echo ""
echo "Next steps:"
echo "1. Make sure Redis is running locally: brew install redis && brew services start redis"
echo "2. Or use Docker: docker run -d -p 6379:6379 redis:alpine"
echo "3. Restart your dev server: npm run dev"
