#!/bin/bash
# Beta Testing Quick Deploy Script
# Run this script to quickly deploy your VarsityHub app for beta testing

echo "🚀 VarsityHub Beta Testing Deployment"
echo "====================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the VarsityHubMobile root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd server && npm install && cd ..

# Check if database is running
echo "🗃️ Checking database connection..."
cd server
if npm run prisma:generate; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed. Please check your DATABASE_URL in server/.env"
    echo "💡 For quick setup, consider using Railway or Supabase"
    exit 1
fi

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed database with sample data
echo "🌱 Seeding database with sample data..."
npm run seed

cd ..

# Update API configuration for production
echo "⚙️ Configuring API endpoints..."
if [ ! -f "src/config/api.ts" ]; then
    mkdir -p src/config
    cat > src/config/api.ts << 'EOF'
// API Configuration for Beta Testing
export const API_BASE_URL = __DEV__ 
  ? process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.11:4000'
  : process.env.EXPO_PUBLIC_PROD_API_URL || 'https://your-app.railway.app';

export const API_TIMEOUT = 10000; // 10 seconds
EOF
    echo "✅ Created API configuration file"
fi

# Build Expo app for testing
echo "📱 Building Expo app for beta testing..."
if command -v eas &> /dev/null; then
    echo "🔧 EAS CLI found, building development build..."
    eas build:configure
    echo "📱 Run 'eas build --platform android --profile preview' to build for testing"
else
    echo "📱 Using Expo Go for testing..."
    echo "💡 Install EAS CLI with: npm install -g @expo/eas-cli"
    npx expo publish
fi

echo ""
echo "🎉 Beta Testing Setup Complete!"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo "1. 🗃️ Deploy your database to Railway/Render/Supabase"
echo "2. 🚀 Deploy your server to Railway/Render/Heroku"
echo "3. 📱 Share your app with beta testers"
echo "4. 📝 Collect feedback and iterate"
echo ""
echo "📖 See BETA_TESTING_SETUP.md for detailed instructions"
echo ""
echo "🔗 Quick Links:"
echo "   Railway: https://railway.app"
echo "   Render: https://render.com"
echo "   Supabase: https://supabase.com"
echo ""