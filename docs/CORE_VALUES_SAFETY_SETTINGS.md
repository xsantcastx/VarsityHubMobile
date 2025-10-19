# Core Values & Safety Settings Implementation

## Overview

The Core Values screen is VarsityHub's comprehensive safety and mission statement page. It educates users about the platform's commitment to safety, explains age-based messaging restrictions, and displays the Safe Zone Policy modal on first visit.

**Location**: Settings → Legal → View Core Values → `app/core-values.tsx`

---

## Features Implemented

### 1. **Core Values Page**
A scrollable page with four main cards:

#### Our Mission Card
- **Icon**: Flag (blue)
- **Content**: VarsityHub's mission statement about bringing high school sports communities together
- Emphasizes safety, positivity, and inclusivity

#### Safety First Card
- **Icon**: Shield with checkmark (green)
- **Content**: Lists key safety features
  - 24/7 content moderation and reporting tools
  - Age-appropriate messaging restrictions
  - Zero-tolerance policy for harassment and bullying
  - Verified coach and staff accounts

#### Age-Based Messaging Card
- **Icon**: People (amber/orange)
- **Content**: Explains messaging restrictions by age
  - **Users 17 & under**: Can only message other minors of similar age
  - **Users 18+**: Can only message other adults and verified coaches/staff
  - **Cross-age messaging**: Blocked by default for protection

#### Coach Exception Card
- **Icon**: Checkmark circle (purple)
- **Content**: Explains special coach permissions
  - Coaches auto-placed in group chats with all team members
  - Group chats allow safe communication across all ages
  - All coach communications are logged for safety and transparency
  - Parents can request to be added to team group chats

### 2. **Safe Zone Policy Modal**
A modal that appears automatically on first visit to the Core Values page.

#### Modal Features
- **Semi-transparent overlay** (60% black)
- **Rounded card design** with centered content
- **Shield icon** at top (blue)
- **Title**: "Safe Zone Policy"
- **Three policy items**:

##### 1. DM Policy for Minors
- **Icon**: Lock (blue)
- **Content**: Users 18+ can only DM coaches and staff to protect minors

##### 2. Coach Exception
- **Icon**: People (green)
- **Content**: Verified coaches auto-placed in group chats for safe team communication

##### 3. Anti-Bullying Reminder
- **Icon**: Hand (amber/orange)
- **Content**: Zero-tolerance for hate speech, harassment, or bullying

#### Modal Controls
- **"Got it!" button** at bottom dismisses the modal
- **Tap outside** the modal also dismisses it
- **AsyncStorage tracking**: Modal only shows once per user (stores `hasSeenSafeZonePolicy`)
- **Header shield icon**: Users can re-open the modal anytime via the header button

---

## Technical Implementation

### File Structure
```
app/
  core-values.tsx         # Main Core Values screen
  settings/
    core-values.tsx       # Export wrapper (exports from ../core-values.tsx)
    index.tsx             # Settings menu (has "View Core Values" link)
```

### Dependencies
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Modal, Pressable, ScrollView, SafeAreaView } from 'react-native';
```

### State Management
```typescript
const [showSafeZoneModal, setShowSafeZoneModal] = useState(false);
```

### AsyncStorage Key
```typescript
const SAFE_ZONE_KEY = 'hasSeenSafeZonePolicy';
```

Stores whether the user has seen the Safe Zone Policy modal before.

### First-Visit Detection
```typescript
useEffect(() => {
  AsyncStorage.getItem(SAFE_ZONE_KEY).then((val) => {
    if (!val) {
      setShowSafeZoneModal(true); // Show modal on first visit
    }
  });
}, []);
```

### Modal Dismissal
```typescript
const handleCloseSafeZone = async () => {
  await AsyncStorage.setItem(SAFE_ZONE_KEY, 'true'); // Mark as seen
  setShowSafeZoneModal(false);
};
```

---

## UI/UX Design

### Theme Support
- **Light Mode**: White background, dark text, light gray cards
- **Dark Mode**: Dark blue background (#0B1120), light text, darker gray cards (#1F2937)
- All colors adapt dynamically using `useColorScheme()` hook

### Layout Structure
```
SafeAreaView
└── Stack.Screen (header with shield icon button)
└── ScrollView
    ├── Our Mission Card
    ├── Safety First Card
    ├── Age-Based Messaging Card
    ├── Coach Exception Card
    └── "View Safe Zone Policy" Button
```

### Card Design
- **Border radius**: 12px
- **Padding**: 16px
- **Border**: 1px hairline
- **Spacing**: 16px margin bottom between cards
- **Icon + Title**: Side-by-side in header
- **Body text**: 15px with 22px line height
- **Bullet points**: 14px with 20px line height

### Modal Design
- **Max width**: 500px (for tablets)
- **Max height**: 85% of screen
- **Border radius**: 16px
- **Padding**: 24px
- **Overlay**: `rgba(0, 0, 0, 0.6)`
- **Icon circles**: 48x48px with 24px border radius

---

## Navigation Integration

### Settings Menu Link
Already implemented in `app/settings/index.tsx`:

```typescript
<SectionCard title="Legal">
  <NavRow 
    title="View Core Values" 
    onPress={() => router.push('/settings/core-values')} 
  />
  <NavRow title="Report Abuse" onPress={() => router.push('/report-abuse')} />
  <NavRow title="DM Restrictions Summary" onPress={() => router.push('/dm-restrictions')} />
</SectionCard>
```

Users access Core Values via: **Settings → Legal → View Core Values**

---

## Safety Features Explained

### Age-Based Messaging Logic

#### For Minors (17 & under):
```typescript
// Can only send DMs to other minors
if (senderAge <= 17) {
  if (receiverAge <= 17) {
    // ✅ Allowed: Minor to minor messaging
    allowMessage = true;
  } else if (receiver.role === 'coach' || receiver.role === 'staff') {
    // ✅ Allowed: Minor can message verified coaches/staff
    allowMessage = true;
  } else {
    // ❌ Blocked: Minor cannot message adults
    allowMessage = false;
  }
}
```

#### For Adults (18+):
```typescript
// Can only message other adults or coaches/staff
if (senderAge >= 18) {
  if (receiverAge >= 18) {
    // ✅ Allowed: Adult to adult messaging
    allowMessage = true;
  } else if (receiver.role === 'coach' || receiver.role === 'staff') {
    // ✅ Allowed: Adult can message coaches/staff
    allowMessage = true;
  } else {
    // ❌ Blocked: Adult cannot message minors
    allowMessage = false;
  }
}
```

### Coach Exception Logic

#### For Coaches:
```typescript
// Coaches can message anyone via group chats
if (sender.role === 'coach' || sender.role === 'staff') {
  if (conversation.type === 'group' && conversation.teamId) {
    // ✅ Allowed: Coach in team group chat
    allowMessage = true;
  } else {
    // ❌ Blocked: Coaches cannot send 1-on-1 DMs to minors
    // Must use team group chats for all team communication
    allowMessage = false;
  }
}
```

#### Group Chat Creation:
```typescript
// When a team is created, automatically create group chat with coach + all members
async function createTeamGroupChat(teamId: string) {
  const teamMembers = await Team.getMembers(teamId);
  const coach = teamMembers.find(m => m.role === 'coach');
  
  await GroupChat.create({
    name: `${team.name} Team Chat`,
    teamId: teamId,
    members: teamMembers.map(m => m.userId), // All ages allowed in group
    createdBy: coach.userId,
    type: 'team',
  });
}
```

---

## Testing Checklist

### ✅ Visual Testing
- [ ] Core Values appears in Settings → Legal
- [ ] All four cards render with correct icons and colors
- [ ] Text is readable in both light and dark mode
- [ ] Bullet points are properly formatted
- [ ] "View Safe Zone Policy" button is visible and styled correctly

### ✅ Modal Testing
- [ ] Safe Zone Policy modal appears on first visit
- [ ] Modal displays all three policies with icons
- [ ] "Got it!" button dismisses the modal
- [ ] Tapping outside the modal dismisses it
- [ ] Modal does NOT appear on second visit (AsyncStorage working)
- [ ] Header shield icon re-opens the modal

### ✅ Theme Testing
- [ ] Light mode: White background, dark text, light gray cards
- [ ] Dark mode: Dark blue background, light text, darker gray cards
- [ ] All icons have correct colors in both themes
- [ ] Modal overlay is semi-transparent in both themes

### ✅ Responsive Testing
- [ ] Content scrolls properly on small screens
- [ ] Modal scrolls if content is too tall
- [ ] Modal is centered and doesn't exceed screen bounds
- [ ] Text wraps correctly in all cards

### ✅ AsyncStorage Testing
- [ ] First visit triggers modal automatically
- [ ] Second visit does NOT trigger modal
- [ ] Clearing AsyncStorage re-enables first-visit modal
- [ ] Header button always works regardless of AsyncStorage state

### ✅ Accessibility Testing
- [ ] All text is readable (sufficient contrast)
- [ ] Icons are descriptive and match content
- [ ] Touch targets are large enough (44x44px minimum)
- [ ] Modal can be dismissed easily

---

## AsyncStorage Debugging

### Check if user has seen the modal:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

AsyncStorage.getItem('hasSeenSafeZonePolicy').then(val => {
  console.log('Has seen Safe Zone Policy:', val); // 'true' or null
});
```

### Reset the modal (for testing):
```typescript
AsyncStorage.removeItem('hasSeenSafeZonePolicy').then(() => {
  console.log('Safe Zone Policy flag cleared. Modal will show again.');
});
```

### Clear ALL AsyncStorage (nuclear option):
```typescript
AsyncStorage.clear().then(() => {
  console.log('All AsyncStorage cleared.');
});
```

---

## Customization Options

### Change Modal Trigger
If you want the modal to show every time instead of just once:

```typescript
// Remove AsyncStorage check
useEffect(() => {
  setShowSafeZoneModal(true); // Always show on mount
}, []);
```

### Add More Policies
Add another policy item to the modal:

```typescript
<View style={styles.policyItem}>
  <View style={[styles.policyIcon, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
    <Ionicons name="alert-circle" size={24} color={isDark ? '#EF4444' : '#DC2626'} />
  </View>
  <View style={styles.policyText}>
    <Text style={[styles.policyTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
      New Policy Title
    </Text>
    <Text style={[styles.policyDescription, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>
      New policy description goes here.
    </Text>
  </View>
</View>
```

### Change Icon Colors
Update icon colors to match your brand:

```typescript
// Our Mission - Change from blue to custom color
<Ionicons name="flag-outline" size={28} color="#YOUR_COLOR" />

// Safety First - Change from green to custom color
<Ionicons name="shield-checkmark" size={28} color="#YOUR_COLOR" />
```

### Add More Cards
Insert a new card between existing ones:

```typescript
<View style={[styles.card, { 
  backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
  borderColor: isDark ? '#374151' : '#E5E7EB'
}]}>
  <View style={styles.cardHeader}>
    <Ionicons name="heart" size={28} color={isDark ? '#EC4899' : '#DB2777'} />
    <Text style={[styles.cardTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
      New Card Title
    </Text>
  </View>
  <Text style={[styles.cardBody, { color: isDark ? '#D1D5DB' : '#374151' }]}>
    New card content goes here.
  </Text>
</View>
```

---

## Related Files

### Settings Integration
- **`app/settings/index.tsx`**: Main settings screen with "View Core Values" link
- **`app/settings/core-values.tsx`**: Export wrapper that redirects to `app/core-values.tsx`

### Related Screens
- **`app/dm-restrictions.tsx`**: Detailed DM restrictions explanation
- **`app/report-abuse.tsx`**: Abuse reporting form
- **`app/blocked-users.tsx`**: View and manage blocked users

---

## Future Enhancements

### 1. **Video Tutorial**
Add an embedded video explaining the Safe Zone Policy:
```typescript
<Video
  source={{ uri: 'https://varsityhub.com/videos/safe-zone-policy.mp4' }}
  style={{ width: '100%', height: 200, borderRadius: 12 }}
  useNativeControls
/>
```

### 2. **Interactive Quiz**
Test user understanding of safety policies:
```typescript
const [quizCompleted, setQuizCompleted] = useState(false);

// Show quiz after reading Core Values
// Award badge for completion
```

### 3. **Age Verification**
Require users to verify their age before dismissing the modal:
```typescript
const [ageVerified, setAgeVerified] = useState(false);

// Show date picker or age confirmation before "Got it!" button works
```

### 4. **Parental Consent**
For minors, require parent email and consent:
```typescript
const [parentEmail, setParentEmail] = useState('');
const [consentGiven, setConsentGiven] = useState(false);

// Disable messaging until parent approves via email link
```

### 5. **Analytics Tracking**
Track how many users read the Core Values:
```typescript
import Analytics from '@/utils/analytics';

Analytics.track('core_values_viewed', {
  userId: currentUser.id,
  timestamp: new Date().toISOString(),
});
```

### 6. **Push Notification Reminder**
Remind users to review Core Values periodically:
```typescript
// Send quarterly reminder to re-read Core Values
Notifications.scheduleNotification({
  title: 'Review VarsityHub Safety Policies',
  body: 'Take a moment to refresh your knowledge of our Core Values.',
  trigger: { months: 3 },
});
```

---

## Troubleshooting

### Modal Doesn't Appear
**Issue**: Safe Zone Policy modal never shows on first visit

**Solutions**:
1. Check AsyncStorage permissions in `app.json`:
   ```json
   {
     "expo": {
       "plugins": [
         "@react-native-async-storage/async-storage"
       ]
     }
   }
   ```

2. Verify AsyncStorage import:
   ```typescript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   ```

3. Check console for errors:
   ```typescript
   AsyncStorage.getItem(SAFE_ZONE_KEY)
     .then(val => console.log('AsyncStorage value:', val))
     .catch(err => console.error('AsyncStorage error:', err));
   ```

### Modal Shows Every Time
**Issue**: Safe Zone Policy modal appears on every visit, not just the first

**Solutions**:
1. Check if AsyncStorage is saving properly:
   ```typescript
   const handleCloseSafeZone = async () => {
     try {
       await AsyncStorage.setItem(SAFE_ZONE_KEY, 'true');
       console.log('AsyncStorage set successfully');
     } catch (error) {
       console.error('Failed to save to AsyncStorage:', error);
     }
     setShowSafeZoneModal(false);
   };
   ```

2. Verify the AsyncStorage key is consistent (no typos)

3. Check if app is clearing AsyncStorage on logout:
   ```typescript
   // Don't clear Safe Zone flag on logout
   await AsyncStorage.removeItem('authToken');
   // Keep: hasSeenSafeZonePolicy
   ```

### Text Overflows Card
**Issue**: Long text doesn't wrap properly in cards

**Solutions**:
1. Add `flex: 1` to text containers:
   ```typescript
   policyText: {
     flex: 1, // Allows text to wrap
   }
   ```

2. Set explicit `lineHeight` for better wrapping:
   ```typescript
   cardBody: {
     fontSize: 15,
     lineHeight: 22, // 1.47x font size
   }
   ```

### Icons Don't Match Theme
**Issue**: Icons are wrong color in dark mode

**Solutions**:
1. Use dynamic color based on `isDark`:
   ```typescript
   color={isDark ? '#60A5FA' : '#3B82F6'}
   ```

2. Check `useColorScheme()` hook is working:
   ```typescript
   const colorScheme = useColorScheme();
   console.log('Current theme:', colorScheme); // 'light' or 'dark'
   ```

---

## Production Checklist

Before deploying to production:

### Content Review
- [ ] All text is grammatically correct
- [ ] Mission statement is approved by leadership
- [ ] Safety policies match legal team's requirements
- [ ] No placeholder text remains

### Legal Compliance
- [ ] Safety policies comply with COPPA (Children's Online Privacy Protection Act)
- [ ] Age verification meets legal requirements
- [ ] Coach background checks are mentioned
- [ ] Privacy policy link is accessible

### Performance
- [ ] Modal animation is smooth (no lag)
- [ ] AsyncStorage operations don't block UI
- [ ] Images/icons load quickly
- [ ] No memory leaks from modal

### Accessibility
- [ ] Screen reader compatible
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Touch targets are 44x44px minimum
- [ ] Text is resizable

### Testing
- [ ] Tested on iOS and Android
- [ ] Tested on tablets and phones
- [ ] Tested in light and dark mode
- [ ] Tested with slow network (AsyncStorage may be slow)

---

## Support Resources

### Ionicons Icon Reference
Browse all available icons: https://ionic.io/ionicons

### AsyncStorage Documentation
Official docs: https://react-native-async-storage.github.io/async-storage/

### React Native Modal
Official docs: https://reactnative.dev/docs/modal

---

## Change Log

### Version 1.0.0 (Initial Release)
- ✅ Implemented Core Values screen with 4 cards
- ✅ Added Safe Zone Policy modal with 3 policies
- ✅ Integrated AsyncStorage for first-visit detection
- ✅ Added header button to re-open modal
- ✅ Full light/dark theme support
- ✅ Responsive design for all screen sizes

---

## Contact

For questions or issues with the Core Values implementation:
- **Technical Issues**: Open a GitHub issue
- **Content Changes**: Contact legal/compliance team
- **Design Feedback**: Contact UX/UI team

---

*Last Updated: [Current Date]*
*Maintained by: VarsityHub Development Team*
