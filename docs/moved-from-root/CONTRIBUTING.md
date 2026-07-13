# Contributing to VarsityHub

Thank you for your interest in contributing to VarsityHub! This document provides guidelines and instructions for contributing.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Code Style](#code-style)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing](#testing)
8. [Documentation](#documentation)

---

## 📝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the project
- Show empathy towards others

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli eas-cli`
- **Git**: Latest version

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/VarsityHubMobile.git
   cd VarsityHubMobile
   ```

2. **Install dependencies**

   ```bash
   # Frontend dependencies
   npm install

   # Backend dependencies
   cd server && npm install && cd ..
   ```

3. **Set up environment variables**

   ```bash
   # Copy example files
   cp .env.example .env
   cp server/.env.example server/.env

   # Fill in your values (see docs/03-ENVIRONMENT.md)
   ```

4. **Start development**

   ```bash
   # Terminal 1: Frontend
   npm run start

   # Terminal 2: Backend (optional if using remote API)
   npm run server:dev
   ```

See **[docs/01-SETUP.md](./docs/01-SETUP.md)** for detailed setup instructions.

---

## 💻 Development Setup

### Project Structure

- `app/` - Expo Router screens (file-based routing)
- `components/` - Reusable React components
- `hooks/` - Custom React hooks
- `utils/` - Utility functions
- `api/` - API client code
- `server/` - Backend Express.js API
- `docs/` - Documentation

See **[docs/02-PROJECT-STRUCTURE.md](./docs/02-PROJECT-STRUCTURE.md)** for detailed structure.

### Running the App

```bash
# Start Expo dev server
npm run start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run on web
npm run web
```

### Running Tests

```bash
# Run all tests
npm test

# Run server tests
npm run test:server

# Run E2E tests
npm run test:smoke

# Run specific test suite
npm run test:teams
```

---

## 🎨 Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode when possible
- Avoid `any` type (use `unknown` or proper types)
- Use interfaces for object shapes, types for unions

### React/React Native

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Use `PascalCase` for component names
- Use `camelCase` for function and variable names

### File Naming

- **Components**: `PascalCase.tsx` (e.g., `PostCard.tsx`)
- **Hooks**: `camelCase.ts` (e.g., `useAuth.ts`)
- **Utils**: `camelCase.ts` (e.g., `formatDate.ts`)
- **Routes**: `kebab-case.tsx` (e.g., `game-detail.tsx`)

### Import Organization

```typescript
// 1. React/React Native imports
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

// 2. Third-party imports
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';

// 3. Local imports (using path aliases)
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/format';
```

### Formatting

- Use Prettier for code formatting (configured via `.prettierrc`)
- Use ESLint for linting (configured via `eslint.config.js`)
- Run `npm run format` before committing

---

## 📝 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, scripts, etc.)

### Examples

```bash
feat(auth): add Google OAuth authentication

fix(payments): correct Stripe pricing for Veteran plan

docs(readme): update setup instructions

style(components): format code with Prettier

refactor(api): extract API client into separate module
```

### Commit Message Rules

- Use imperative mood ("add feature" not "added feature")
- Keep subject line under 50 characters
- Capitalize first letter of subject
- No period at end of subject
- Reference issues in footer: `Closes #123`

---

## 🔄 Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, tested code
   - Follow code style guidelines
   - Update documentation if needed

3. **Test your changes**

   ```bash
   # Run type checking
   npm run typecheck

   # Run linting
   npm run lint

   # Run tests
   npm test
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): your commit message"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Fill out the PR template
   - Describe your changes clearly
   - Link related issues
   - Request review from maintainers

### PR Checklist

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Tests pass (if applicable)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventions

---

## 🧪 Testing

### Writing Tests

- Write unit tests for utilities and hooks
- Write integration tests for API routes
- Write E2E tests for critical user flows

### Test Structure

```typescript
describe('functionName', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

---

## 📚 Documentation

### Updating Documentation

- Update relevant docs when adding features
- Keep README.md up to date
- Document breaking changes
- Add code examples where helpful

### Documentation Structure

- `README.md` - Project overview and quick start
- `CONTRIBUTING.md` - This file
- `docs/` - Detailed documentation
  - `01-SETUP.md` - Setup guide
  - `02-PROJECT-STRUCTURE.md` - Project structure
  - `03-ENVIRONMENT.md` - Environment variables

---

## ❓ Getting Help

- Check existing documentation in `docs/`
- Search existing issues and PRs
- Create a new issue for bugs or questions
- Ask in discussions for general questions

---

## ✅ Checklist

Before submitting a PR:

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with `main`

---

**Thank you for contributing to VarsityHub! 🎉**
