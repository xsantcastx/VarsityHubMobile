# VarsityHub Mobile — Code Style & Organization Guide

**Purpose:** Consistent naming, file structure, and architectural patterns across the codebase.

---

## File & Folder Naming Conventions

### React Components (`.tsx` files)

| Type | Pattern | Example | Location |
|------|---------|---------|----------|
| **Screen** (full page) | `PascalCase` + `Screen` | `ProfileScreen.tsx` | `app/` or `app/*/` |
| **Feature Screen** | `PascalCase` + `Screen` | `EventDetailsScreen.tsx` | `app/events/` |
| **Shared Component** | `PascalCase` | `Avatar.tsx`, `Button.tsx` | `components/` |
| **UI Primitive** | `PascalCase` | `Text.tsx`, `View.tsx` | `components/ui/` |
| **Layout Component** | `PascalCase` + `Layout` | `SidebarLayout.tsx` | `components/layouts/` |

**Examples:**
```
app/
  profile/
    ProfileScreen.tsx         ✅
    profile-screen.tsx        ❌ (lowercase)
    Profile.tsx               ❌ (screen not named explicitly)

components/
  Avatar.tsx                  ✅
  avatar.tsx                  ❌
  AvatarComponent.tsx         ❌ (redundant suffix)

components/ui/
  Button.tsx                  ✅
  Text.tsx                    ✅
  TextField.tsx               ✅
```

### Custom Hooks (`.ts` / `.tsx` files)

| Type | Pattern | Example |
|------|---------|---------|
| **Hook** | `use` + `PascalCase` | `useAuth.ts`, `useNavigation.ts` |
| **Context Hook** | `use` + `ContextName` | `useAuthContext.ts` |
| **Utility Hook** | `use` + `Verb` + `Noun` | `useApiFetch.ts`, `useLocalStorage.ts` |

**Examples:**
```
hooks/
  useAuth.ts                  ✅
  useAuthenication.ts         ❌ (misspelled)
  useAPIFetch.ts              ❌ (prefer camelCase for acronyms)
  useApiFetch.ts              ✅
  auth.ts                     ❌ (missing 'use' prefix)
```

### Utilities & Services (`.ts` files)

| Type | Pattern | Example | Location |
|------|---------|---------|----------|
| **Utility** | `camelCase` | `formatDate.ts`, `parseUrl.ts` | `utils/` or `lib/` |
| **Service** | `camelCase` | `authService.ts`, `apiClient.ts` | `services/` |
| **API** | `camelCase` | `userApi.ts`, `eventApi.ts` | `api/` |
| **Constants** | `UPPER_SNAKE_CASE` or `camelCase` | `API_BASE_URL.ts` or `constants.ts` | `constants/` |
| **Config** | `camelCase` | `appConfig.ts`, `theme.ts` | `config/` |

**Examples:**
```
utils/
  formatDate.ts               ✅
  format-date.ts              ❌ (use camelCase)
  DateFormatter.ts            ❌ (use lowercase for utilities)

services/
  authService.ts              ✅
  auth-service.ts             ❌

api/
  userApi.ts                  ✅
  UserApi.ts                  ❌ (use camelCase)

constants/
  API_BASE_URL.ts             ✅
  API_ENDPOINTS.ts            ✅
  apiBaseUrl.ts               ✅ (also acceptable)
```

### Types & Interfaces (`.types.ts` or inline)

| Type | Pattern | Example |
|------|---------|---------|
| **Type** | `PascalCase` + (optional) `Type` | `User`, `UserType` |
| **Interface** | `I` + `PascalCase` (optional prefix) or just `PascalCase` | `IUser` or `User` |
| **Enum** | `PascalCase` | `UserRole`, `PaymentStatus` |
| **Generic Type Param** | Single uppercase letter | `T`, `K`, `V` |

**Prefer this:**
```typescript
// ✅ Recommended: one file per feature
types/user.types.ts
  export type User = { id: string; name: string };
  export type UserRole = 'admin' | 'coach' | 'athlete';
  export enum UserRoleEnum { Admin = 'admin', Coach = 'coach' }

// ✅ Also acceptable: grouped in index
types/index.ts
  export * from './user.types';
  export * from './event.types';
  export * from './team.types';
```

**Avoid this:**
```typescript
// ❌ Vague naming
types/models.ts       (too generic)
types/types.ts        (redundant)
types/index.types.ts  (redundant suffix)

// ❌ Inconsistent patterns
interfaces/User.ts    (use types/ instead)
User.interface.ts     (use .types.ts suffix)
```

### Test Files

| Type | Pattern | Location |
|------|---------|----------|
| **Unit Test** | `[Module].test.ts(x)` or `[Module].spec.ts(x)` | Next to module or `__tests__/` |
| **Integration Test** | `[Feature].integration.test.ts` | `__tests__/integration/` |
| **E2E Test** | `[Feature].e2e.test.ts` | `e2e/` or `__tests__/e2e/` |

**Examples:**
```
components/
  Button.tsx
  Button.test.tsx             ✅ (co-located)

hooks/
  useAuth.ts
  useAuth.test.ts             ✅ (co-located)

__tests__/
  auth/
    useAuth.test.ts           ✅ (alternative: central location)

e2e/
  profile.e2e.test.ts         ✅
```

---

## File Organization Patterns

### React Component File Structure

```typescript
// ✅ RECOMMENDED: All imports, types, helper functions, then component

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

// ========== TYPES ==========
interface Props {
  userId: string;
  onPress?: () => void;
}

interface User {
  id: string;
  name: string;
}

// ========== EXPORTS ==========
export const UserProfile: React.FC<Props> = ({ userId, onPress }) => {
  // implementation
};

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { /* ... */ },
  text: { /* ... */ },
});
```

**Why this order?**
1. Imports (dependencies)
2. Types (contract)
3. Main export (entry point)
4. Styles (styling)

### API Service Pattern

```typescript
// ✅ RECOMMENDED
// api/userApi.ts

import { httpClient } from './httpClient';
import { User } from '@/types/user.types';

export const userApi = {
  getProfile: async (userId: string): Promise<User> => {
    return httpClient.get(`/users/${userId}`);
  },

  updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
    return httpClient.put(`/users/${userId}`, data);
  },
};
```

### Custom Hook Pattern

```typescript
// ✅ RECOMMENDED
// hooks/useAuth.ts

import { useContext, useCallback } from 'react';
import { AuthContext } from '@/context/AuthContext';

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
```

### Utility Function Pattern

```typescript
// ✅ RECOMMENDED
// utils/formatDate.ts

export const formatDate = (date: Date | string, format: string = 'MM/DD/YYYY'): string => {
  // implementation
};

export const parseDate = (dateString: string): Date => {
  // implementation
};

export const isDateInPast = (date: Date): boolean => {
  // implementation
};
```

---

## Directory Structure (Phase 2 Target)

Once complete, the app will follow this structure:

```
src/
├── features/                    # Feature-first organization (Phase 2)
│   ├── auth/
│   │   ├── screens/
│   │   │   └── LoginScreen.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   └── authService.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   └── __tests__/
│   │       └── useAuth.test.ts
│   │
│   ├── profile/
│   │   ├── screens/
│   │   │   ├── ProfileScreen.tsx
│   │   │   └── EditProfileScreen.tsx
│   │   ├── components/
│   │   │   └── ProfileHeader.tsx
│   │   ├── hooks/
│   │   │   └── useProfile.ts
│   │   ├── types/
│   │   │   └── profile.types.ts
│   │   └── __tests__/
│   │
│   └── teams/
│       ├── screens/
│       │   └── TeamsScreen.tsx
│       ├── types/
│       │   └── team.types.ts
│       └── services/
│           └── teamService.ts
│
├── shared/                      # Shared across features
│   ├── components/              # Reusable UI components
│   │   └── Avatar.tsx
│   ├── ui/                      # Design system primitives
│   │   ├── Button.tsx
│   │   ├── TextField.tsx
│   │   └── Text.tsx
│   ├── hooks/                   # Shared hooks
│   │   └── useNavigation.ts
│   ├── utils/                   # Utility functions
│   │   └── formatDate.ts
│   ├── constants/               # App constants
│   │   └── API_BASE_URL.ts
│   └── types/                   # Global types
│       └── common.types.ts
│
├── app/                         # Entry points (screens, navigation)
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (main)/
│   │   ├── profile.tsx
│   │   └── teams.tsx
│   └── App.tsx
│
├── assets/                      # Images, fonts
│   ├── images/
│   ├── fonts/
│   └── icons/
│
└── config/                      # App configuration
    └── appConfig.ts
```

**Key Principle:** Files are organized by **feature first**, then by **type** (screens, components, hooks, services, types).

---

## Import Path Conventions

### Current (Pre-Phase 2)
```typescript
import { useAuth } from '../../hooks/useAuth';           // Relative
import { Button } from '../../components/Button';        // Relative
```

### Post-Phase 2 (with path aliases)
```typescript
import { useAuth } from '@/features/auth/hooks/useAuth'; // Absolute
import { Button } from '@/shared/components/Button';     // Absolute
import { User } from '@/shared/types/common.types';      // Absolute
```

**tsconfig.json paths to add:**
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/assets/*": ["assets/*"]
    }
  }
}
```

---

## Naming Conventions Summary

| Category | Format | Example | ❌ Don't |
|----------|--------|---------|---------|
| React Screens | `PascalCase` + `Screen` | `ProfileScreen.tsx` | `profile-screen.tsx`, `Profile.tsx` |
| React Components | `PascalCase` | `Button.tsx`, `Avatar.tsx` | `button.tsx`, `button-component.tsx` |
| Hooks | `use` + `PascalCase` | `useAuth.ts` | `auth.ts`, `useauth.ts`, `use_auth.ts` |
| Services | `camelCase` + `Service` | `authService.ts` | `AuthService.ts`, `auth-service.ts` |
| Utils | `camelCase` | `formatDate.ts` | `FormatDate.ts`, `format-date.ts` |
| Constants | `UPPER_SNAKE_CASE` | `API_BASE_URL.ts` | `ApiBaseUrl.ts`, `api_base_url.ts` |
| Types | `PascalCase` | `User`, `UserRole` | `user`, `USER_ROLE` |
| Directories | `lowercase` or `kebab-case` | `shared/`, `src/features/` | `Shared/`, `SRC/Features/` |
| Booleans | `is`, `has`, `can`, `should` | `isActive`, `hasPermission` | `active`, `permission`, `getActive` |
| Callbacks | `on` + `PascalCase` | `onPress`, `onSuccess` | `press`, `onClick`, `success` |

---

## Code Quality Rules

### TypeScript Strictness
- ✅ **Always use** explicit types for function parameters and returns
- ✅ **Avoid** `any` type (use `unknown` with type guard if necessary)
- ✅ **Enable** `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` in `tsconfig.json`

### React Patterns
- ✅ **Use** functional components with hooks (no class components)
- ✅ **Use** `React.FC<Props>` for typed components
- ✅ **Extract** reusable logic into custom hooks
- ✅ **Memoize** expensive computations with `useMemo`
- ✅ **Avoid** inline arrow functions in JSX (use `useCallback`)
- ❌ **Don't** use `any` for props

### Error Handling
- ✅ **Always** catch and handle promise rejections
- ✅ **Use** try-catch for async operations
- ✅ **Log** errors with context (what operation, what input)
- ✅ **Show** user-friendly error messages

### Testing
- ✅ **Write** tests for custom hooks
- ✅ **Test** API services with mocked responses
- ✅ **Co-locate** tests next to modules (`[Module].test.ts`)
- ✅ **Use** descriptive test names: `should return user data when userId is valid`

---

## Folder Organization Rules

1. **Avoid nesting > 4 levels deep**
   ```
   ✅  src/features/auth/screens/LoginScreen.tsx      (3 levels)
   ❌  src/features/auth/screens/main/LoginScreen.tsx  (4 levels, too deep)
   ```

2. **One concept per file**
   ```
   ✅  Button.tsx (Button component only)
   ❌  Button.tsx (Button + Input + TextField together)
   ```

3. **Group by feature first, not by file type**
   ```
   ✅  src/features/auth/       (feature folder)
         └── screens/
         └── hooks/
         └── services/
   
   ❌  src/screens/auth/        (type folder)
       src/hooks/auth/
       src/services/auth/
   ```

4. **Keep `__tests__` at same level as code**
   ```
   ✅  hooks/
         └── useAuth.ts
         └── useAuth.test.ts
   
   ✅  hooks/
         └── useAuth.ts
         └── __tests__/
             └── useAuth.test.ts
   
   ❌  hooks/
       __tests__/
         └── useAuth.test.ts
   ```

---

## Comments & Documentation

### Comment Rules
- ✅ **Explain the why**, not the what (code shows the what)
- ✅ **Use TODO** comments for future improvements: `// TODO: Add retry logic`
- ✅ **Use FIXME** for known bugs: `// FIXME: Handle null case`
- ✅ **Document complex logic** with multi-line comments
- ❌ **Don't comment obvious code**: `const name = user.name; // set name variable`

### JSDoc for Public APIs
```typescript
/**
 * Formats a date into a readable string format.
 *
 * @param date - The date to format (Date object or ISO string)
 * @param format - The output format (default: 'MM/DD/YYYY')
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(), 'MM/DD/YYYY') // '12/25/2025'
 */
export const formatDate = (date: Date | string, format: string = 'MM/DD/YYYY'): string => {
  // implementation
};
```

---

## Linting & Formatting

### ESLint Rules (enforce in CI/CD)
```bash
npm run lint                 # Check for violations
npm run lint:fix            # Auto-fix violations
```

### Prettier (auto-format on save)
```bash
npm run format              # Format all files
```

### Type Checking
```bash
npm run typecheck           # Check TS compilation
```

---

## Last Updated
- **Date:** December 25, 2025
- **Status:** Approved for Phase 1; Phase 2 (feature-first refactor) pending
- **Scope:** All new code should follow these conventions
- **Review:** Before merging PRs, verify naming and organization match this guide

---

## Quick Checklist Before Committing

- [ ] Component names follow `PascalCase` + `Screen`/nothing pattern?
- [ ] Hook names start with `use`?
- [ ] Utilities and services are `camelCase`?
- [ ] Types are `PascalCase` or in `.types.ts` files?
- [ ] No `any` types without justification?
- [ ] Tests are co-located with modules?
- [ ] Import paths are clear and logical?
- [ ] No nesting > 4 levels deep?
- [ ] Comments explain "why", not "what"?
