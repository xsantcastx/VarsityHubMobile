# Project Structure

Complete guide to VarsityHub's folder organization and architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Root Directory](#root-directory)
3. [App Directory](#app-directory)
4. [Components](#components)
5. [Server Directory](#server-directory)
6. [Configuration Files](#configuration-files)
7. [File Naming Conventions](#file-naming-conventions)

---

## Overview

VarsityHub uses a monorepo structure with the mobile app and backend server in the same repository:

```
VarsityHubMobile/
├── app/                    # Frontend - Expo Router screens
├── components/             # Reusable React components
├── constants/              # App-wide constants
├── context/                # React Context providers
├── hooks/                  # Custom React hooks
├── utils/                  # Utility functions
├── assets/                 # Static assets (images, fonts)
├── server/                 # Backend - Express.js API
├── docs/                   # Documentation
└── scripts/                # Build and deployment scripts
```

---

## Root Directory

### Key Files

```
VarsityHubMobile/
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── app.json                # Expo configuration
├── eas.json                # Expo Application Services config
├── babel.config.js         # Babel transpiler config
├── metro.config.js         # Metro bundler config
├── eslint.config.js        # ESLint rules
├── .env                    # Frontend environment variables
├── .gitignore              # Git ignore rules
├── README.md               # Main documentation
├── PRIVACY_POLICY.md       # Privacy policy (required for stores)
├── TERMS_OF_SERVICE.md     # Terms of service (required for stores)
└── expo-env.d.ts           # Expo TypeScript definitions
```

### Scripts Directory

```
scripts/
├── build-production.bat    # Interactive production build
├── validate-pre-launch.bat # Pre-launch validation
└── start-beta-testing.bat  # Beta testing setup
```

### Documentation Directory

```
docs/
├── README.md               # Documentation index
├── 01-SETUP.md            # Setup guide
├── 02-PROJECT-STRUCTURE.md # This file
├── 03-ENVIRONMENT.md       # Environment configuration
├── 04-DEVELOPMENT.md       # Development workflow
├── 05-FEATURES.md          # Feature documentation
├── 06-API.md              # API reference
├── 07-PRODUCTION.md        # Production deployment
├── 08-BACKEND.md           # Backend setup
├── 09-LEGAL.md             # Legal documents
├── 11-TROUBLESHOOTING.md   # Common issues
└── cleanup-docs.bat        # Cleanup script
```

---

## App Directory

The `app/` directory uses **Expo Router's file-based routing**. File names become routes automatically.

### Structure

```
app/
├── _layout.tsx             # Root layout (navigation, providers)
├── index.tsx               # Landing/Login screen (/)
├── +not-found.tsx          # 404 error screen
├── _error.tsx              # Error boundary
│
├── (tabs)/                 # Tab navigation group
│   ├── _layout.tsx        # Tab bar configuration
│   ├── feed.tsx           # Feed tab (/)
│   ├── discover.tsx       # Discover tab (/discover)
│   ├── create.tsx         # Create tab (/create)
│   ├── messages.tsx       # Messages tab (/messages)
│   └── profile.tsx        # Profile tab (/profile)
│
├── onboarding/            # Onboarding flow
│   ├── _layout.tsx        # Onboarding layout
│   ├── step-1.tsx         # Name & Bio
│   ├── step-2.tsx         # Profile Picture
│   ├── step-3.tsx         # Cover Photo
│   ├── step-4.tsx         # Location
│   ├── step-5.tsx         # Sports Selection
│   ├── step-6.tsx         # Roles Selection
│   ├── step-7.tsx         # School/Organization
│   ├── step-8.tsx         # Core Values
│   ├── step-9.tsx         # Subscription
│   └── step-10.tsx        # Complete
│
├── settings/              # Settings screens
│   ├── index.tsx          # Main settings
│   ├── account.tsx        # Account settings
│   ├── privacy.tsx        # Privacy settings
│   ├── notifications.tsx  # Notification settings
│   └── subscription.tsx   # Subscription management
│
├── admin/                 # Admin screens
│   ├── dashboard.tsx      # Admin dashboard
│   ├── users.tsx          # User management
│   ├── teams.tsx          # Team management
│   ├── ads.tsx            # Ad management
│   └── messages.tsx       # Message moderation
│
├── teams/                 # Team management
│   ├── create.tsx         # Create team
│   ├── edit.tsx           # Edit team
│   ├── manage.tsx         # Manage team
│   └── detail.tsx         # Team details
│
├── games/                 # Game/Event management
│   ├── create.tsx         # Create game
│   ├── edit.tsx           # Edit game
│   ├── detail.tsx         # Game details
│   ├── photos.tsx         # Game photos
│   ├── highlights.tsx     # Game highlights
│   └── reviews.tsx        # Game reviews
│
├── posts/                 # Post management
│   ├── create.tsx         # Create post
│   ├── detail.tsx         # Post details
│   └── edit.tsx           # Edit post
│
├── ads/                   # Ad management
│   ├── create.tsx         # Create ad
│   ├── edit.tsx           # Edit ad
│   ├── my-ads.tsx         # My ads list
│   └── calendar.tsx       # Ad calendar
│
├── payments/              # Payment screens
│   ├── success.tsx        # Payment success
│   ├── cancel.tsx         # Payment cancelled
│   └── billing.tsx        # Billing history
│
└── auth/                  # Authentication (if needed)
    ├── login.tsx          # Login screen
    ├── register.tsx       # Register screen
    ├── forgot-password.tsx # Password reset
    └── reset-password.tsx  # Reset password form
```

### File-Based Routing Examples

| File Path | URL Route | Description |
|-----------|-----------|-------------|
| `app/index.tsx` | `/` | Landing/Login screen |
| `app/(tabs)/feed.tsx` | `/feed` | Feed tab |
| `app/game-detail.tsx` | `/game-detail` | Game details (with params) |
| `app/onboarding/step-1.tsx` | `/onboarding/step-1` | First onboarding step |
| `app/settings/account.tsx` | `/settings/account` | Account settings |
| `app/+not-found.tsx` | `/*` | 404 fallback |

### Navigation Patterns

**Stack Navigation:**
```typescript
import { router } from 'expo-router';

// Navigate to a screen
router.push('/game-detail?id=123');

// Navigate and replace current screen
router.replace('/profile');

// Go back
router.back();
```

**Passing Parameters:**
```typescript
// In navigation
router.push(`/game-detail?id=${gameId}&tab=photos`);

// In destination screen
import { useLocalSearchParams } from 'expo-router';

const { id, tab } = useLocalSearchParams();
```

---

## Components

Reusable React components organized by category.

```
components/
├── ui/                     # Base UI components
│   ├── Button.tsx         # Primary button
│   ├── Input.tsx          # Text input
│   ├── Card.tsx           # Card container
│   ├── Modal.tsx          # Modal dialog
│   ├── Loading.tsx        # Loading spinner
│   └── Avatar.tsx         # User avatar
│
├── forms/                  # Form components
│   ├── FormField.tsx      # Form field wrapper
│   ├── Picker.tsx         # Dropdown picker
│   ├── DatePicker.tsx     # Date picker
│   ├── ImagePicker.tsx    # Image picker
│   └── LocationPicker.tsx # Location picker
│
├── navigation/             # Navigation components
│   ├── TabBar.tsx         # Custom tab bar
│   ├── Header.tsx         # Screen header
│   └── BackButton.tsx     # Back button
│
├── feed/                   # Feed-specific components
│   ├── PostCard.tsx       # Post card
│   ├── CommentList.tsx    # Comment list
│   ├── LikeButton.tsx     # Like button
│   └── ShareButton.tsx    # Share button
│
├── team/                   # Team-specific components
│   ├── TeamCard.tsx       # Team card
│   ├── TeamMemberList.tsx # Member list
│   ├── RosterView.tsx     # Roster view
│   └── TeamStats.tsx      # Team statistics
│
├── game/                   # Game-specific components
│   ├── GameCard.tsx       # Game card
│   ├── ScoreBoard.tsx     # Score display
│   ├── GameTimeline.tsx   # Game timeline
│   └── HighlightReel.tsx  # Highlights player
│
├── messaging/              # Messaging components
│   ├── MessageBubble.tsx  # Message bubble
│   ├── ChatInput.tsx      # Message input
│   ├── ThreadList.tsx     # Thread list
│   └── TypingIndicator.tsx # Typing indicator
│
├── media/                  # Media components
│   ├── ImageGrid.tsx      # Image grid
│   ├── VideoPlayer.tsx    # Video player
│   ├── MediaViewer.tsx    # Fullscreen viewer
│   └── ImageCarousel.tsx  # Image carousel
│
├── maps/                   # Map components
│   ├── EventMap.tsx       # Event map
│   ├── MapMarker.tsx      # Custom marker
│   └── MapSearch.tsx      # Location search
│
├── ads/                    # Ad components
│   ├── AdBanner.tsx       # Banner ad
│   ├── AdCard.tsx         # Ad card
│   └── AdManager.tsx      # Ad management
│
└── layout/                 # Layout components
    ├── Container.tsx      # Main container
    ├── SafeArea.tsx       # Safe area wrapper
    ├── KeyboardAvoid.tsx  # Keyboard avoiding view
    └── ScrollContainer.tsx # Scrollable container
```

### Component Naming Conventions

- **PascalCase**: All component files (e.g., `Button.tsx`, `PostCard.tsx`)
- **Descriptive names**: Clearly indicate purpose (e.g., `LikeButton`, not `LB`)
- **Suffixes**: Use common suffixes:
  - `*Card`: Card-style component
  - `*List`: List component
  - `*Modal`: Modal dialog
  - `*Picker`: Selection component
  - `*Button`: Button component

---

## Server Directory

Backend Express.js server with PostgreSQL database.

```
server/
├── package.json            # Backend dependencies
├── tsconfig.json           # TypeScript config
├── .env                    # Backend environment variables
├── .env.example            # Environment template
│
├── src/                    # Source code
│   ├── index.ts           # Server entry point
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication routes
│   │   ├── users.ts       # User routes
│   │   ├── teams.ts       # Team routes
│   │   ├── games.ts       # Game routes
│   │   ├── posts.ts       # Post routes
│   │   ├── messages.ts    # Messaging routes
│   │   ├── ads.ts         # Ad routes
│   │   ├── payments.ts    # Payment routes
│   │   └── admin.ts       # Admin routes
│   │
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts        # Authentication middleware
│   │   ├── validation.ts  # Input validation
│   │   ├── errorHandler.ts # Error handling
│   │   └── cors.ts        # CORS configuration
│   │
│   ├── services/           # Business logic
│   │   ├── authService.ts # Authentication logic
│   │   ├── emailService.ts # Email sending
│   │   ├── stripeService.ts # Stripe integration
│   │   ├── uploadService.ts # File uploads
│   │   └── notificationService.ts # Notifications
│   │
│   ├── utils/              # Utility functions
│   │   ├── jwt.ts         # JWT helpers
│   │   ├── validation.ts  # Validation helpers
│   │   └── logger.ts      # Logging
│   │
│   └── types/              # TypeScript types
│       ├── express.d.ts   # Express type extensions
│       └── models.ts      # Database model types
│
├── prisma/                 # Prisma ORM
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Seed data
│
└── scripts/                # Backend scripts
    ├── migrate.sh         # Run migrations
    ├── seed.sh            # Seed database
    └── deploy.sh          # Deploy script
```

### API Route Structure

Each route file exports an Express router:

```typescript
// server/src/routes/teams.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// GET /api/teams
router.get('/', authMiddleware, async (req, res) => {
  // Handler logic
});

// POST /api/teams
router.post('/', authMiddleware, async (req, res) => {
  // Handler logic
});

export default router;
```

### Database Schema

```prisma
// prisma/schema.prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  username      String   @unique
  passwordHash  String?
  firstName     String?
  lastName      String?
  bio           String?
  profilePicture String?
  coverPhoto    String?
  role          UserRole @default(FAN)
  subscription  SubscriptionTier @default(FREE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  teams         TeamMember[]
  posts         Post[]
  messages      Message[]
  // ... other relations
}

model Team {
  id          String   @id @default(uuid())
  name        String
  sport       String
  description String?
  logo        String?
  banner      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  members     TeamMember[]
  games       Game[]
  posts       Post[]
  // ... other relations
}

// ... more models
```

---

## Configuration Files

### package.json

Main scripts:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "server:dev": "cd server && npm run dev",
    "server:db:studio": "cd server && npx prisma studio",
    "build:production": "node scripts/build-production.js",
    "validate:pre-launch": "node scripts/validate-pre-launch.js"
  }
}
```

### tsconfig.json

TypeScript configuration:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/constants/*": ["./constants/*"],
      "@/context/*": ["./context/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/utils/*": ["./utils/*"]
    }
  }
}
```

### app.json

Expo configuration:

```json
{
  "expo": {
    "name": "VarsityHub",
    "slug": "varsityhub",
    "version": "1.0.0",
    "scheme": "varsityhubmobile",
    "platforms": ["ios", "android"],
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-secure-store"
    ]
  }
}
```

### eas.json

Expo Application Services:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## File Naming Conventions

### General Rules

1. **React Components**: PascalCase
   - ✅ `Button.tsx`, `PostCard.tsx`, `UserProfile.tsx`
   - ❌ `button.tsx`, `post-card.tsx`, `userProfile.tsx`

2. **Utilities & Hooks**: camelCase
   - ✅ `useAuth.ts`, `formatDate.ts`, `apiClient.ts`
   - ❌ `UseAuth.ts`, `FormatDate.ts`, `APIClient.ts`

3. **Constants**: UPPER_SNAKE_CASE
   - ✅ `API_BASE_URL`, `MAX_FILE_SIZE`, `DEFAULT_THEME`
   - ❌ `apiBaseUrl`, `maxFileSize`, `defaultTheme`

4. **Routes (app/ dir)**: kebab-case
   - ✅ `game-detail.tsx`, `forgot-password.tsx`, `my-team.tsx`
   - ❌ `GameDetail.tsx`, `forgotPassword.tsx`, `MyTeam.tsx`

5. **Types & Interfaces**: PascalCase
   - ✅ `User`, `GameDetails`, `ApiResponse`
   - ❌ `user`, `gameDetails`, `apiResponse`

### TypeScript Types

```typescript
// types/models.ts
export interface User {
  id: string;
  email: string;
  username: string;
  // ...
}

export type UserRole = 'ATHLETE' | 'COACH' | 'FAN' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'VETERAN' | 'LEGEND';
```

### Folder Organization

- **Flat structure** for small collections (< 10 files)
- **Nested structure** for larger collections (> 10 files)
- **Index files** to simplify imports:

```typescript
// components/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';

// Usage
import { Button, Input, Card } from '@/components/ui';
```

---

## Import Path Aliases

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/constants/*": ["./constants/*"],
      "@/context/*": ["./context/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/utils/*": ["./utils/*"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

Usage:

```typescript
// ✅ Good - Using aliases
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/constants/theme';

// ❌ Bad - Relative paths
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../../constants/theme';
```

---

## Best Practices

### 1. Component Structure

```typescript
// Good component structure
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  disabled = false 
}) => {
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // styles
  }
});
```

### 2. File Organization

- **One component per file** (except small related components)
- **Keep files under 300 lines** (split if larger)
- **Co-locate related files** (e.g., `Button.tsx` + `Button.test.tsx`)

### 3. Directory Organization

- **Group by feature** rather than by type for large apps
- **Keep related files together**
- **Use index files** to simplify imports

---

## Next Steps

- **[Environment Configuration](./03-ENVIRONMENT.md)** - Set up API keys
- **[Development Guide](./04-DEVELOPMENT.md)** - Learn the workflow
- **[API Reference](./06-API.md)** - Explore the backend API

---

**Questions?** See [Troubleshooting](./11-TROUBLESHOOTING.md) or contact the dev team.
