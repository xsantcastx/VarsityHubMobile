# Monitoring & Guardrails Setup

## ✅ Completed

### Sentry Runtime Monitoring
**What it does:**
- Captures uncaught exceptions with device info (platform, app version, Expo SDK)
- Tracks HTTP request/response breadcrumbs for debugging
- Reports timeouts and network failures with context (path, base URL, method)
- Filters dev noise (network errors in development dropped by default)

**Setup:**
1. Get your Sentry DSN from https://sentry.io/settings/projects/
2. Add to `.env`:
   ```bash
   EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
   ```
3. Restart Expo: `npm start`

**Files:**
- `utils/sentry.ts` - Sentry initialization and helpers
- `app/_layout.tsx` - Calls `initSentry()` before app renders
- `api/http.ts` - Breadcrumbs for HTTP requests + exception capture

**Usage:**
```typescript
import { captureException, captureBreadcrumb } from '@/utils/sentry';

// Manually capture an error with context
try {
  await riskyOperation();
} catch (err) {
  captureException(err, { userId: 123, action: 'upload' });
}

// Add custom breadcrumb
captureBreadcrumb('User tapped share', 'user-action', { postId: 456 });
```

### Stricter Linting
**What it does:**
- Warns on unused variables (prefix with `_` to ignore)
- Errors on floating promises (must await or handle)
- Warns on `console.log` (use `console.warn` or `console.error`)
- Enforces React Hooks rules and exhaustive deps

**Files:**
- `eslint.config.js` - Enabled `@typescript-eslint/no-unused-vars`, `no-floating-promises`, `await-thenable`, `no-console`

**Usage:**
```bash
npm run lint          # Run ESLint
npm run lint:strict   # Run ESLint + typecheck
npm run doctor        # Run expo-doctor for config issues
```

### Expo Doctor Check
**What it does:**
- Validates Expo config, dependencies, and asset paths
- Surfaces wrong SDK versions, missing plugins, and broken imports

**Usage:**
```bash
npm run doctor
```

Add to CI:
```yaml
- run: npm run doctor
- run: npm run lint:strict
- run: npm run typecheck
```

## 🔄 Next Steps (Optional)

### Route Param Validation
Use `zod` or `ts-pattern` to validate route params at runtime:

```typescript
import { z } from 'zod';

const EventParams = z.object({
  id: z.string().min(1),
  tab: z.enum(['feed', 'schedule', 'roster']).optional(),
});

// In screen:
const params = EventParams.parse(useLocalSearchParams());
```

### Analytics Instrumentation
Add event tracking for share, RSVP, Add Story:

```typescript
import { captureBreadcrumb } from '@/utils/sentry';

// In share handler:
captureBreadcrumb('User shared event', 'analytics', { eventId, method: 'native-share' });

// In RSVP handler:
captureBreadcrumb('User RSVP', 'analytics', { eventId, going: true });
```

## 📊 Sentry Dashboard

Once configured, you'll see:
- **Issues**: Crash reports with stack traces, device info, and breadcrumbs
- **Performance**: Slow HTTP requests and screen transitions
- **Releases**: Track errors by app version

Filter by:
- `platform:ios` or `platform:android`
- `environment:production` or `environment:development`
- `app_version:1.0.1`

