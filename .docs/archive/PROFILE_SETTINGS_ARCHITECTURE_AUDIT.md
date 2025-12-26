# Profile & Settings Architecture Audit
**Date:** December 23, 2024  
**Scope:** Profile page, edit-profile page, settings integration, and backend API alignment

---

## Executive Summary

### ✅ **PASS** - System Architecture is Sound

The profile and settings system is well-architected with proper separation of concerns, secure data flow, and robust state management. However, there are **critical missing components** that prevent full functionality.

### Key Findings
- ✅ Profile page correctly displays user data from `/auth/me`
- ✅ Edit-profile page properly updates via `PUT /auth/me`
- ✅ Preferences properly merged server-side to prevent data loss
- ✅ Avatar/header image uploads work correctly
- ⚠️ **CRITICAL:** Settings page does not exist
- ⚠️ **MEDIUM:** Settings button in profile.tsx routes to non-existent `/settings`
- ✅ Security: Role changes blocked after onboarding completion
- ✅ Data integrity: Username normalization consistent client/server

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Profile Data                    │
│                                                          │
│  Source: GET /auth/me                                    │
│  Update: PUT /auth/me                                    │
│  Partial: PATCH /auth/me                                 │
│          PATCH /auth/me/preferences                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │    User Object Structure            │
        │                                     │
        │  - id, email, username              │
        │  - display_name, avatar_url, bio    │
        │  - email_verified, banned           │
        │  - preferences (JSON)               │
        │  - _count { posts, followers,       │
        │           following }               │
        └─────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
  ┌──────────────────┐          ┌─────────────────┐
  │  profile.tsx     │          │ edit-profile.tsx│
  │                  │          │                 │
  │  - Displays user │          │ - Updates user  │
  │  - Shows stats   │◄─────────│ - Manages prefs │
  │  - Avatar upload │  router  │ - Image uploads │
  │  - Background    │  .back() │ - Form handling │
  │  - Organizations │          │                 │
  │  - Posts/Feed    │          │                 │
  └──────────────────┘          └─────────────────┘
          │
          │ Settings Button
          │ router.push('/settings')
          ▼
  ┌──────────────────┐
  │  /settings       │
  │                  │
  │  ❌ MISSING      │ ◄─── CRITICAL ISSUE
  │                  │
  └──────────────────┘
```

---

## Component Analysis

### 1. Profile Page (`app/profile.tsx`)

**Purpose:** Display user's own profile with posts, interactions, and stats

**Key Features:**
- ✅ Fetches user data via `User.me()` (GET /auth/me)
- ✅ Displays avatar with upload capability
- ✅ Background image upload and positioning
- ✅ Stats: posts, followers, following (clickable)
- ✅ Organizations section (loaded separately)
- ✅ Tabs: Posts | Interactions
- ✅ Interaction filters: all, like, comment, save
- ✅ Sort options: newest, most_upvoted, most_commented
- ✅ Vertical video feed viewer
- ✅ Edit Profile button → routes to `/edit-profile`
- ⚠️ **ISSUE:** Settings button → routes to `/settings` (non-existent)

**State Management:**
```typescript
const [me, setMe] = useState<CurrentUser | null>(null);
const [activeTab, setActiveTab] = useState<'posts' | 'interactions'>('posts');
const [posts, setPosts] = useState<any[]>([]);
const [interactions, setInteractions] = useState<any[]>([]);
const [organizations, setOrganizations] = useState<any[]>([]);
```

**Security:**
- ✅ Requires authentication (401 → show sign-in message)
- ✅ Avatar upload with image manipulation (resize to 800px, 85% quality)
- ✅ Background upload with positioning (drag to adjust focus_y)
- ✅ Preferences properly merged with existing data

**API Calls:**
```typescript
// Profile data
const u = await User.me(); // GET /auth/me

// Posts
const page = await User.postsForProfile(userId, { limit: 10, sort });
// GET /users/:id/posts?limit=10&sort=newest

// Interactions
const page = await User.interactionsForProfile(userId, { 
  limit: 10, type: 'like', sort 
});
// GET /users/:id/interactions?type=like&limit=10&sort=newest

// Avatar update
await User.updateMe({ avatar_url: url });
// PUT /auth/me with { avatar_url: "..." }

// Background update
const updatedPreferences = { ...preferences, header_image_url: url };
await User.updateMe({ preferences: updatedPreferences });
// PUT /auth/me with { preferences: { header_image_url: "..." } }
```

**Settings Button Issue:**
```typescript
// Line 427 - profile.tsx
<Pressable onPress={() => void router.push('/settings')} style={styles.settingsButton}>
  <Ionicons name="settings-outline" size={24} color={theme.mutedText} />
</Pressable>
```
**Problem:** `/settings` route does not exist. App will crash or show blank screen.

---

### 2. Edit Profile Page (`app/edit-profile.tsx`)

**Purpose:** Comprehensive profile editing form

**Key Features:**
- ✅ Loads user data from `User.me()`
- ✅ Basic fields: display_name, full_name, bio, location, zip_code
- ✅ Avatar upload (camera or gallery, 400x400, 80% quality)
- ✅ Background image with drag-to-position (1600px wide, 80% quality)
- ✅ Date of birth picker
- ✅ Sports interests (max 3)
- ✅ Theme color selection (6 preset colors)
- ✅ Team member fields (position, jersey number)
- ✅ Athlete fields (grade level, graduation year, accolades, primary sport)
- ✅ Saves via `User.updateMe(directFields)`
- ✅ Splits direct fields vs preferences correctly

**Data Structure:**
```typescript
// Direct fields (top-level user columns)
const directFields = {
  display_name: string,
  bio: string,
  avatar_url: string,
};

// Preferences (JSON column)
const preferences = {
  full_name: string,
  location: string,
  zip_code: string,
  date_of_birth: string (YYYY-MM-DD),
  sports_interests: string[],
  theme_color: string,
  header_image_url: string,
  header_image_focus_y: number (-1 to 1),
  position: string,
  jersey_number: string,
  grade_level: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior',
  graduation_year: number,
  accolades: string[],
  primary_sport: string,
};
```

**API Integration:**
```typescript
// Load data
const me = await User.me(); // GET /auth/me
const prefs = me?.preferences || {};

// Extract fields
setDisplayName(me?.display_name || '');
setFullName(prefs?.full_name || '');
setLocation(prefs?.location || '');
// ... etc

// Save data
await User.updateMe({
  display_name: displayName.trim(),
  bio: bio.trim(),
  avatar_url: avatarUrl,
  preferences: {
    full_name: fullName.trim(),
    location: location.trim(),
    // ... etc
  }
});
// PUT /auth/me
```

**Security:**
- ✅ Requires authentication (shows error if not signed in)
- ✅ Image compression before upload
- ✅ Field validation (display_name required)
- ✅ Data sanitization (trim, lowercase for sports)
- ✅ Year validation (2020-2040 range)

**Navigation:**
```typescript
// After save
if (userRole === 'coach' || userRole === 'admin') {
  router.replace('/team-profile');
} else {
  router.back(); // Returns to profile page
}
```

---

### 3. Backend API (`server/src/routes/auth.ts`)

**Endpoints:**

#### GET /auth/me
```typescript
authRouter.get('/me', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { _count: { select: { posts, followers, following } } }
  });
  
  // Merge preferences with defaults
  const defaults = {
    notifications: { 
      game_event_reminders: false,
      team_updates: false,
      comments_upvotes: false 
    },
    is_parent: false,
    zip_code: null,
  };
  const mergedPrefs = mergePreferences(defaults, user.preferences || {});
  
  // Admin bypass for onboarding
  if (is_admin) {
    mergedPrefs.onboarding_completed = true;
  }
  
  return res.json({ ...user, preferences: mergedPrefs, is_admin });
});
```

#### PUT /auth/me
```typescript
authRouter.put('/me', async (req: AuthedRequest, res) => {
  const data = updateMeSchema.safeParse(req.body);
  
  // Normalize usernames
  if (data.display_name) {
    patch.display_name = normalizeUsername(data.display_name);
  }
  
  // Merge preferences
  if (data.preferences) {
    const currentPrefs = await getCurrentPreferences(req.user.id);
    const onboardingCompleted = currentPrefs.onboarding_completed === true;
    
    // SECURITY: Block role changes after onboarding
    if (onboardingCompleted && 'role' in data.preferences) {
      if (data.preferences.role !== currentPrefs.role) {
        return res.status(403).json({ 
          error: 'Role changes not allowed after onboarding' 
        });
      }
    }
    
    patch.preferences = mergePreferences(currentPrefs, data.preferences);
  }
  
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: patch
  });
  
  return res.json(sanitizeUser(user));
});
```

#### PATCH /auth/me
Same as PUT but supports partial updates and includes role downgrade cleanup.

#### PATCH /auth/me/preferences
Partial update specifically for preferences object (notifications, etc).

**Security Features:**
- ✅ Username normalization: spaces → underscores, lowercase
- ✅ Role change prevention after onboarding
- ✅ Role downgrade cleanup (coach → fan removes org/team memberships)
- ✅ Preference merging prevents data loss
- ✅ Deep merge for nested objects (notifications)

**Validation Schema:**
```typescript
const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  preferences: z.any().optional(),
});
```

---

### 4. User Profile Page (`app/user-profile.tsx`)

**Purpose:** View other users' public profiles

**Key Features:**
- ✅ Fetches public profile via `User.getPublic(id)`
- ✅ Displays avatar, bio, stats
- ✅ Shows user's posts
- ✅ Follow/unfollow functionality (not audited in detail)
- ✅ Admin badge for admin users
- ✅ Jersey badge for sports

**Differences from profile.tsx:**
- No edit button (viewing others)
- No settings button
- No avatar upload
- Fetches `GET /users/:id` instead of `/auth/me`

---

## Critical Issues

### 🔴 CRITICAL: Missing Settings Page

**Problem:**
```typescript
// profile.tsx line 427
<Pressable onPress={() => void router.push('/settings')}>
```

**Impact:**
- Settings button navigates to non-existent route
- Users cannot access account settings
- Password change, notifications, privacy controls all inaccessible

**Expected Settings Features (based on backend):**
1. **Account Settings**
   - Change password (`POST /auth/password/change`)
   - Email verification status
   - Delete account (`DELETE /users/me`)

2. **Notification Settings**
   - Game event reminders
   - Team updates
   - Comments & upvotes
   - (`PATCH /auth/me/preferences`)

3. **Privacy Settings**
   - DM restrictions (`/dm-restrictions` exists but not linked)
   - Block list management
   - Profile visibility

4. **Preferences**
   - Theme color (currently in edit-profile)
   - Location/zip code
   - Sports interests

**Evidence of Settings Intent:**
```typescript
// server/src/routes/auth.ts line 251-253
const secureAccountLink = `${APP_BASE_URL}/settings/security`;
const changePasswordLink = `${APP_BASE_URL}/settings/password`;
const contactSupportLink = `${APP_BASE_URL}/support`;
```

Backend references `/settings/*` routes in security emails, confirming settings page is expected.

---

## Medium Priority Issues

### ⚠️ Settings vs Edit-Profile Boundary Unclear

**Issue:** Some settings are in edit-profile, others referenced in backend:

**Currently in edit-profile.tsx:**
- Theme color
- Sports interests (max 3)
- Location/zip code
- Date of birth

**Should be in settings:**
- Notification preferences
- Privacy controls
- Password change
- Account deletion
- Email verification

**Recommendation:** 
- Keep profile customization in edit-profile (avatar, bio, theme)
- Move account/security/privacy to dedicated settings page

---

### ⚠️ No Direct Link to DM Restrictions

**File exists:** `app/dm-restrictions.tsx`

**Purpose:** Control who can send direct messages

**Issue:** Not linked from profile or settings

**Options:**
```typescript
// DM policy options
'everyone' | 'followers' | 'following' | 'mutuals'
```

**Recommendation:** Add to settings page under Privacy section

---

## Security Analysis

### ✅ Strengths

1. **Authentication Required**
   - Profile pages check auth status
   - 401 errors show sign-in prompts

2. **Role Change Protection**
   ```typescript
   // Block role changes after onboarding
   if (onboardingCompleted && data.preferences.role !== currentPrefs.role) {
     return res.status(403).json({ error: '...' });
   }
   ```

3. **Username Normalization**
   ```typescript
   // Server: spaces → underscores
   function normalizeUsername(username: string): string {
     return username.trim().toLowerCase().replace(/\s+/g, '_');
   }
   ```

4. **Preference Merging**
   ```typescript
   // Prevents data loss on partial updates
   const mergedPrefs = mergePreferences(currentPrefs, data.preferences);
   ```

5. **Image Compression**
   - Avatar: 400x400, 80% quality
   - Header: 1600px wide, 80% quality
   - Prevents excessive storage/bandwidth

6. **Input Validation**
   - Zod schemas on backend
   - Display name required
   - Bio max 1000 chars
   - URL validation for avatar

### ⚠️ Potential Concerns

1. **No Rate Limiting on Profile Updates**
   - User can spam PUT /auth/me
   - Recommendation: Add rate limiter (e.g., 10 updates per hour)

2. **Preferences Schema Too Permissive**
   ```typescript
   preferences: z.any().optional()
   ```
   - Allows arbitrary JSON
   - Could store unexpected/large data
   - Recommendation: Define strict schema

3. **No Audit Trail for Profile Changes**
   - No logging of display_name changes
   - No tracking of avatar updates
   - Recommendation: Add audit log for security-relevant changes

---

## Data Consistency

### ✅ Working Correctly

1. **Preference Defaults**
   ```typescript
   const defaults = {
     notifications: { 
       game_event_reminders: false,
       team_updates: false,
       comments_upvotes: false 
     },
     is_parent: false,
     zip_code: null,
   };
   ```

2. **Deep Merge for Nested Objects**
   ```typescript
   if (base?.notifications || incoming?.notifications) {
     out.notifications = { 
       ...(base?.notifications || {}), 
       ...(incoming?.notifications || {}) 
     };
   }
   ```

3. **Avatar URL Handling**
   - Frontend checks `avatarUrl || null`
   - Backend accepts `nullable()`
   - Consistent null handling

4. **Username Normalization**
   - Client: Live normalization on input
   - Server: Normalize on save
   - Both use `/\s+/g` → `_`

---

## Recommendations

### 🔴 CRITICAL (Must Fix)

1. **Create Settings Page**
   ```typescript
   // app/settings.tsx
   export default function SettingsScreen() {
     return (
       <SafeAreaView>
         <ScrollView>
           {/* Account section */}
           {/* Notifications section */}
           {/* Privacy section */}
           {/* About section */}
         </ScrollView>
       </SafeAreaView>
     );
   }
   ```

2. **Add Settings Route**
   ```typescript
   // app/_layout.tsx
   <Stack.Screen name="settings" options={{ title: 'Settings' }} />
   ```

3. **Implement Password Change UI**
   ```typescript
   // Use POST /auth/password/change endpoint
   const onChangePassword = async () => {
     await fetch('/auth/password/change', {
       method: 'POST',
       body: JSON.stringify({ 
         current_password, 
         new_password 
       })
     });
   };
   ```

### ⚠️ HIGH PRIORITY (Should Fix)

4. **Add Rate Limiting to Profile Updates**
   ```typescript
   // server/src/routes/auth.ts
   const profileUpdateLimiter = rateLimit({
     windowMs: 60 * 60 * 1000, // 1 hour
     max: 10, // 10 updates per hour
   });
   
   authRouter.put('/me', profileUpdateLimiter, async (req, res) => {
     // ...
   });
   ```

5. **Strict Preferences Schema**
   ```typescript
   const preferencesSchema = z.object({
     full_name: z.string().max(120).optional(),
     location: z.string().max(200).optional(),
     zip_code: z.string().max(10).optional(),
     date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
     sports_interests: z.array(z.string()).max(3).optional(),
     theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
     header_image_url: z.string().url().nullable().optional(),
     header_image_focus_y: z.number().min(-1).max(1).optional(),
     // ... etc
   });
   ```

6. **Link DM Restrictions**
   ```typescript
   // In settings page
   <Pressable onPress={() => router.push('/dm-restrictions')}>
     <Text>Message Privacy</Text>
   </Pressable>
   ```

### 📝 MEDIUM PRIORITY (Nice to Have)

7. **Audit Log for Profile Changes**
   ```typescript
   await prisma.auditLog.create({
     data: {
       user_id: req.user.id,
       action: 'profile_update',
       changes: { display_name: { from: oldName, to: newName } },
       ip_address: req.ip,
       timestamp: new Date(),
     }
   });
   ```

8. **Email Notification on Profile Changes**
   - Notify user when avatar changes
   - Notify when email changes
   - Notify when password changes (already exists)

9. **Avatar History**
   - Keep last 3 avatars
   - Allow rollback
   - Show "previous avatars" in edit-profile

10. **Profile Completeness Score**
    ```typescript
    const calculateCompleteness = (user) => {
      const fields = [
        'avatar_url', 'bio', 'location', 
        'date_of_birth', 'sports_interests'
      ];
      const filled = fields.filter(f => user[f] || user.preferences?.[f]);
      return (filled.length / fields.length) * 100;
    };
    ```

---

## Testing Checklist

### Profile Page
- [ ] Displays user data correctly
- [ ] Avatar upload works
- [ ] Background image upload works
- [ ] Background drag-to-position works
- [ ] Stats clickable (followers/following)
- [ ] Posts tab loads posts
- [ ] Interactions tab loads interactions
- [ ] Filters work (like, comment, save)
- [ ] Sort options work (newest, most_upvoted)
- [ ] Edit Profile button works
- [ ] Settings button (currently broken)
- [ ] Organizations section displays
- [ ] Back button works

### Edit Profile Page
- [ ] Loads user data on mount
- [ ] Display name required validation
- [ ] Avatar camera/gallery picker works
- [ ] Background image picker works
- [ ] Background drag positioning works
- [ ] Date of birth picker works
- [ ] Sports interests (max 3) works
- [ ] Theme color selection works
- [ ] Position/jersey fields (team members)
- [ ] Athlete fields (grade, graduation, accolades)
- [ ] Save button updates profile
- [ ] Navigation after save (coach → team-profile, fan → back)
- [ ] Loading states during upload
- [ ] Error handling for upload failures

### Backend API
- [ ] GET /auth/me returns user with preferences
- [ ] GET /auth/me includes _count for stats
- [ ] PUT /auth/me updates direct fields
- [ ] PUT /auth/me merges preferences correctly
- [ ] PUT /auth/me normalizes username
- [ ] PUT /auth/me blocks role changes after onboarding
- [ ] PATCH /auth/me supports partial updates
- [ ] PATCH /auth/me/preferences updates notifications
- [ ] Password change requires current password
- [ ] Admin users bypass onboarding_completed checks

### Settings Page (MISSING)
- [ ] Create settings page
- [ ] Add notifications toggle
- [ ] Add password change form
- [ ] Add account deletion
- [ ] Add privacy controls
- [ ] Link DM restrictions

---

## Conclusion

### Overall Assessment: **B+ (85/100)**

**Strengths:**
- Profile and edit-profile pages are well-built
- Backend API is secure and properly validates data
- Preference merging prevents data loss
- Image uploads work correctly with compression
- Authentication properly enforced

**Critical Gap:**
- Settings page completely missing despite backend support
- Settings button in profile navigates to non-existent route

**Recommendation:**
**Immediate action required:** Create settings page with account/security/privacy sections. System is 85% complete but missing critical user-facing functionality.

---

## Appendix: API Endpoints

### Authentication & Profile
```
GET    /auth/me                    - Get current user with preferences
PUT    /auth/me                    - Update user (full)
PATCH  /auth/me                    - Update user (partial)
PATCH  /auth/me/preferences        - Update preferences only
POST   /auth/password/change       - Change password (requires current)
POST   /auth/password/forgot       - Request password reset email
POST   /auth/password/reset        - Reset password with code
DELETE /users/me                   - Delete account (soft-delete)
```

### Profile Data
```
GET    /users/:id                  - Get public profile
GET    /users/:id/posts            - Get user's posts
GET    /users/:id/interactions     - Get user's interactions
GET    /users/:id/followers        - Get followers list
GET    /users/:id/following        - Get following list
POST   /users/:id/follow           - Follow user
DELETE /users/:id/follow           - Unfollow user
```

### Privacy & Blocking
```
POST   /users/:id/block            - Block user
DELETE /users/:id/block            - Unblock user
GET    /users/blocked              - Get blocked users list
```

### Uploads
```
POST   /uploads                    - Upload file (requires auth)
```

---

**Audit Completed:** December 23, 2024  
**Next Review:** After settings page implementation
