# 🏈 VarsityHub Mobile

**The ultimate sports team management and social platform for athletes, coaches, and fans.**

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2050-000020)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 📱 About VarsityHub

VarsityHub brings athletes, coaches, and fans together on one powerful platform. Manage teams, schedule games, share moments, and connect with your sports community like never before.

### ✨ Key Features

- 👥 **Team Management** - Create and organize teams with roles
- 📅 **Game Scheduling** - Plan games, track scores, manage seasons
- 💬 **Real-time Messaging** - Team chat and direct messages
- 📸 **Media Sharing** - Share photos and videos from games
- 🗺️ **Event Maps** - Find nearby games and events
- 💳 **Subscriptions** - Free, Veteran ($9.99/mo), Legend ($19.99/mo)
- 📊 **Analytics** - Track team performance and statistics
- 🌙 **Dark Mode** - Full app-wide dark mode support

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Or use Expo Go app on your phone

### Installation

```bash
# Clone repository
git clone https://github.com/xsantcastx/VarsityHubMobile.git
cd VarsityHubMobile

# Install dependencies
npm install

# Start development server
npm start
```

**Full setup guide**: [docs/01-SETUP.md](./docs/01-SETUP.md)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](./docs/01-SETUP.md) | Installation and environment setup |
| [Project Structure](./docs/02-PROJECT-STRUCTURE.md) | Folder organization |
| [Environment Config](./docs/03-ENVIRONMENT.md) | API keys and variables |
| [Development Guide](./docs/04-DEVELOPMENT.md) | Coding standards and workflow |
| [Features Overview](./docs/05-FEATURES.md) | Complete feature list |
| [API Reference](./docs/06-API.md) | Backend API documentation |
| [Production Deploy](./docs/07-PRODUCTION.md) | App Store & Play Store launch |
| [Backend Setup](./docs/08-BACKEND.md) | Server configuration |
| [Legal Documents](./docs/09-LEGAL.md) | Privacy & Terms |
| [Troubleshooting](./docs/11-TROUBLESHOOTING.md) | Common issues |

**📖 Full documentation index**: [docs/README.md](./docs/README.md)

---

## 🏗️ Tech Stack

### Frontend (Mobile App)
- **Framework**: React Native + Expo
- **Navigation**: Expo Router (file-based routing)
- **State**: React Context + AsyncStorage
- **Styling**: StyleSheet with dynamic theming
- **UI**: Custom components + Expo Vector Icons
- **Media**: Expo Image Picker + Cloudinary
- **Maps**: Google Maps (react-native-maps)

### Backend (Server)
- **Runtime**: Node.js + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT + Google OAuth 2.0
- **Payments**: Stripe
- **Email**: Nodemailer (Gmail SMTP)
- **Hosting**: Railway
- **Storage**: Cloudinary

---

## 📂 Project Structure

```
VarsityHubMobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── onboarding/        # Onboarding flow (10 steps)
│   ├── settings/          # Settings screens
│   └── ...                # Other screens
├── components/            # Reusable components
│   ├── ui/               # UI components
│   └── ...
├── constants/            # Constants and theme
├── context/              # React Context providers
├── hooks/                # Custom hooks
├── server/               # Backend API
│   ├── src/             # Server source code
│   ├── prisma/          # Database schema & migrations
│   └── scripts/         # Utility scripts
├── docs/                 # Documentation
└── assets/              # Images, fonts, etc.
```

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run backend server
npm run server:dev

# Database management
npm run server:db:studio     # Open Prisma Studio
npm run server:db:migrate    # Run migrations

# Production builds
npm run build:production     # Interactive build
npm run build:ios           # Build for iOS
npm run build:android       # Build for Android

# Deployment
npm run submit:ios          # Submit to App Store
npm run submit:android      # Submit to Play Store
```

### Development Workflow

1. **Feature branch**: Create from `main`
2. **Develop**: Make changes and test
3. **Commit**: Use clear commit messages
4. **Push**: Push to GitHub
5. **Merge**: Merge to `main` when ready

See: [Development Guide](./docs/04-DEVELOPMENT.md)

---

## 🚀 Deployment

### Mobile App

**Builds handled by Expo EAS:**
```bash
npm run build:production
```

Then submit to stores:
```bash
npm run submit:ios
npm run submit:android
```

**Full deployment guide**: [docs/07-PRODUCTION.md](./docs/07-PRODUCTION.md)

### Backend

**Deployed on Railway:**
- Auto-deploys from `main` branch
- PostgreSQL database included
- Environment variables configured in Railway dashboard

**Backend setup**: [docs/08-BACKEND.md](./docs/08-BACKEND.md)

---

## 🔐 Environment Variables

### Frontend `.env`
```properties
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

### Backend `server/.env`
```properties
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
GOOGLE_MAPS_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
```

**Full configuration guide**: [docs/03-ENVIRONMENT.md](./docs/03-ENVIRONMENT.md)

---

## 🧪 Testing

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

---

## 📊 Current Status

### Version
- **App Version**: 1.0.0
- **Backend Version**: 1.0.0
- **Status**: ✅ Production Ready

### Features Complete
- ✅ Authentication (Email + Google OAuth)
- ✅ Onboarding flow (10 steps with persistence)
- ✅ Team management with deletion
- ✅ Game/Event scheduling
- ✅ Post creation with fullscreen media viewer
- ✅ Real-time messaging
- ✅ Payment system (Stripe)
- ✅ Ad management
- ✅ Dark mode throughout
- ✅ Maps integration

### Deployment Status
- ✅ Backend: Deployed on Railway
- ✅ Database: PostgreSQL configured
- ✅ API: Fully functional
- ⏳ Mobile: Ready for App Store/Play Store submission

---

## 📱 Screenshots

*Coming soon after App Store launch*

---

## 🤝 Contributing

This is a private repository. Development team only.

### Team
- **Lead Developer**: xsantcastx
- **Platform**: React Native + Expo
- **Backend**: Express.js + PostgreSQL

---

## 📄 License

**Proprietary** - All rights reserved © 2025 VarsityHub

---

## 🆘 Support

- **Documentation**: [docs/README.md](./docs/README.md)
- **Troubleshooting**: [docs/11-TROUBLESHOOTING.md](./docs/11-TROUBLESHOOTING.md)
- **Email**: support@varsityhub.com

---

## 🗺️ Roadmap

### Version 1.1 (Q1 2025)
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] Video streaming
- [ ] Team rankings

### Version 1.2 (Q2 2025)
- [ ] Live game updates
- [ ] Tournament brackets
- [ ] Coach toolkit
- [ ] Fan engagement features

---

## 📝 Changelog

### v1.0.0 (January 2025)
- ✅ Initial production release
- ✅ Full feature set
- ✅ Dark mode support
- ✅ App Store & Play Store ready

---

## 🙏 Acknowledgments

- **Expo Team** - Amazing React Native framework
- **Railway** - Excellent hosting platform
- **Stripe** - Reliable payment processing
- **Cloudinary** - Media management
- **Google** - Maps & OAuth services

---

**Built with ❤️ for the sports community** 🏈⚽🏀⚾🏐

---

**Ready to get started?** Check out the [Setup Guide](./docs/01-SETUP.md)!
