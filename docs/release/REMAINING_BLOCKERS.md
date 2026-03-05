# Implementation Guide: Remaining Critical Blockers

## Overview
This guide covers the 4 remaining critical blockers that prevent production launch:
1. Token Refresh Mechanism
2. Subscription Verification  
3. Loading States
4. Empty States

---

## 1. Token Refresh Mechanism 🔐

### Problem
Tokens expire but the app has no refresh flow. Users get logged out unexpectedly.

### Solution
Implement short-lived access tokens + refresh token flow.

### Server Changes Needed
```typescript
// Backend should return both tokens on login
{
  access_token: "jwt...",        // 15 minute expiry
  refresh_token: "jwt...",       // 7 day expiry
  expires_in: 900                // seconds
}

// New endpoint: POST /auth/refresh
// Input: { refresh_token: "..." }
// Output: { access_token: "...", expires_in: 900 }
```

### Client Implementation

**Step 1: Update `auth.ts` to support refresh tokens**
```typescript
const REFRESH_TOKEN_KEY = 'auth_refresh_token_key';

async function saveRefreshToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token || '');
    } else {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token || '');
    }
  } catch (error) {
    console.error('[auth] Failed to save refresh token:', error);
  }
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    else return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('[auth] Failed to load refresh token:', error);
    return null;
  }
}

// Add to auth object
async refresh() {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');
  
  const res = await httpPost('/auth/refresh', { refresh_token: refreshToken });
  if (res?.access_token) {
    await saveToken(res.access_token);
  }
  return res;
}
```

**Step 2: Update login/register to save refresh token**
```typescript
async login(email: string, password: string) {
  const res = await httpPost('/auth/login', { email, password });
  if (res?.access_token) {
    await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
  }
  return res;
}
```

**Step 3: Intercept 401 errors in `http.ts`**
```typescript
async function request(path: string, options: RequestInit = {}, ...): Promise<any> {
  try {
    return await actualFetch(...);
  } catch (error: any) {
    // If unauthorized, try to refresh token
    if (error.status === 401) {
      try {
        await auth.refresh();
        // Retry request with new token
        return await actualFetch(...);
      } catch (refreshError) {
        // Refresh failed, logout user
        await auth.logout();
        throw error;
      }
    }
    throw error;
  }
}
```

---

## 2. Subscription Verification 💳

### Problem
App doesn't verify subscription status. Premium features aren't properly gated.

### Solution
Check subscription at login and periodically refresh.

### Server Changes Needed
```typescript
// New endpoint: GET /me/subscription
{
  has_active_subscription: boolean,
  plan: "free" | "pro" | "premium",
  expires_at: "2026-03-03T...",
  features: {
    can_create_ads: boolean,
    can_message: boolean,
    can_view_analytics: boolean
  }
}
```

### Client Implementation

**Step 1: Update `AuthProvider.tsx` to fetch subscription**
```typescript
interface AuthContextType {
  user: AuthUser | null;
  subscription: SubscriptionData | null;
  hasActiveSubscription: boolean;
  // ... rest of interface
}

async function checkSubscription() {
  try {
    const sub = await httpGet('/me/subscription');
    setSubscription(sub);
    
    // Refresh every 5 minutes (or when app regains focus)
    const timer = setInterval(() => {
      void checkSubscription();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(timer);
  } catch (error) {
    console.error('[auth] Failed to check subscription:', error);
    setSubscription(null);
  }
}
```

**Step 2: Add feature gating helper**
```typescript
// utils/subscriptionUtils.ts
export function requireSubscription(feature: string, hasSubscription: boolean): void {
  if (!hasSubscription) {
    throw new Error(`Feature "${feature}" requires active subscription`);
  }
}

// In component
import { useAuth } from '@/context/AuthProvider';

function CreateAdButton() {
  const { hasActiveSubscription } = useAuth();
  
  const handlePress = () => {
    if (!hasActiveSubscription) {
      showErrorToast('This feature requires a subscription');
      router.push('/upgrade-subscription');
      return;
    }
    // Continue with ad creation
  };
  
  return (
    <Pressable disabled={!hasActiveSubscription} onPress={handlePress}>
      <Text>Create Ad</Text>
    </Pressable>
  );
}
```

---

## 3. Loading States ⏳

### Problem
Many screens show nothing while loading. Poor UX.

### Solution
Add skeleton screens and proper loading indicators to all data-fetching screens.

### Create Skeleton Components

**Create `components/SkeletonCard.tsx`**
```typescript
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function SkeletonCard() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });
  
  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={[styles.avatar, { backgroundColor: theme.text + '20' }]} />
      <View style={styles.content}>
        <View style={[styles.line, { backgroundColor: theme.text + '20' }]} />
        <View style={[styles.line, { backgroundColor: theme.text + '20', width: '70%' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  line: {
    height: 12,
    borderRadius: 4,
    marginVertical: 4,
  },
});
```

### Apply to Screens

**Example: `app/highlights.tsx`**
```typescript
function HighlightsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    const loadHighlights = async () => {
      try {
        setLoading(true);
        const data = await Highlights.list();
        setItems(data);
      } finally {
        setLoading(false);
      }
    };
    void loadHighlights();
  }, []);
  
  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }
  
  if (items.length === 0) {
    return <EmptyState message="No highlights yet" />;
  }
  
  return <FlatList data={items} renderItem={renderItem} />;
}
```

### Add to Critical Screens
Priority order:
1. Feed/Highlights (currently blank while loading)
2. Messages (currently blank)
3. Game Details (already has some loading)
4. Profile Posts
5. Teams/League

---

## 4. Empty States 📭

### Problem
When lists are empty, users don't know if it's loading, error, or actually empty.

### Solution
Create `EmptyState` component used consistently across app.

**Create `components/EmptyState.tsx`**
```typescript
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon = 'inbox', title, message, action }: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={64} color={theme.text + '40'} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: theme.text + '70' }]}>{message}</Text>}
      {action && (
        <Pressable
          onPress={action.onPress}
          style={[styles.button, { backgroundColor: theme.tint }]}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
```

### Usage Examples

```typescript
// No posts
{items.length === 0 ? (
  <EmptyState
    icon="document-text"
    title="No posts yet"
    message="Be the first to share a highlight!"
    action={{
      label: 'Create Post',
      onPress: () => router.push('/create-post'),
    }}
  />
) : (
  <FlatList data={items} renderItem={renderItem} />
)}

// No messages
{conversations.length === 0 ? (
  <EmptyState
    icon="mail"
    title="No messages"
    message="Start a conversation with someone"
    action={{
      label: 'Find People',
      onPress: () => router.push('/search'),
    }}
  />
) : (
  <FlatList data={conversations} renderItem={renderItem} />
)}

// No bookmarks
{bookmarks.length === 0 ? (
  <EmptyState
    icon="bookmark"
    title="No bookmarks"
    message="Save posts to view them later"
  />
) : (
  <FlatList data={bookmarks} renderItem={renderItem} />
)}
```

---

## Implementation Priority

```
Week 1: Token Refresh + Subscription
├─ Add refresh token support to auth.ts
├─ Implement 401 retry logic in http.ts
├─ Add subscription endpoint check
└─ Gate premium features

Week 2: Loading States + Empty States
├─ Create SkeletonCard component
├─ Create EmptyState component
├─ Add to top 5 screens
└─ Test loading/empty transitions
```

---

## Testing Checklist

### Token Refresh
- [ ] Token expires (set short expiry: 60 seconds for testing)
- [ ] Make request after expiry
- [ ] Verify refresh endpoint called
- [ ] Verify request retried with new token
- [ ] Verify user stays logged in

### Subscription
- [ ] Create two test users (one with, one without subscription)
- [ ] Login as non-subscriber
- [ ] Try to create ad
- [ ] Verify error/redirect to upgrade screen
- [ ] Verify no network request succeeds

### Loading States
- [ ] Load feed on slow network
- [ ] Verify skeleton cards appear
- [ ] Verify cards replaced when data loads
- [ ] Verify smooth transition

### Empty States
- [ ] Clear all posts for user
- [ ] Navigate to profile
- [ ] Verify empty state shows instead of blank screen
- [ ] Verify action button works

---

## Code Examples - Complete Implementation

**Full auth.ts with refresh token**
```typescript
// See production-ready implementation in docs/token-refresh-complete.ts
```

**Full http.ts with 401 retry**
```typescript
// See production-ready implementation in docs/http-retry-complete.ts
```

---

**Estimated Effort**: 3-5 days for complete implementation  
**Launch Blocker**: Yes - all 4 items critical for production
