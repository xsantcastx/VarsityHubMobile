# Contact Section Implementation - Manage Teams

## Overview

Added a contact section to the Manage Teams screen that displays the customer service email and explains its purposes.

**Implementation Date**: October 13, 2025  
**Location**: `app/manage-teams.tsx`

---

## Features

### Contact Card Design

A clean, professional contact card displayed between the stats section and the teams list:

**Visual Layout**:
```
┌──────────────────────────────────────┐
│ 📧 Contact                           │
│                                      │
│ customerservice@varsityhub.app      │
│                                      │
│ 📢 Ad acquisitions                   │
│ ❓ Customer service                  │
└──────────────────────────────────────┘
```

### Components

#### Header
- **Icon**: Mail outline (blue/tint color)
- **Title**: "Contact" (bold, 18px)

#### Email Address
- **Text**: `customerservice@varsityhub.app`
- **Style**: Blue tint color, underlined, bold (16px)
- **Interactive**: Tappable - opens native email client

#### Purpose List
Two items explaining what the email is for:

1. **Ad Acquisitions**
   - Icon: Megaphone outline
   - For advertising and sponsorship inquiries

2. **Customer Service**
   - Icon: Help circle outline
   - For general support and assistance

---

## User Interaction

### Email Tap Behavior

When user taps the email address:
```typescript
1. Detects tap on email
2. Opens device's default email app
3. Pre-fills "To:" field with customerservice@varsityhub.app
4. User can compose message
```

**Implementation**:
```typescript
onPress={() => {
  const email = 'customerservice@varsityhub.app';
  const mailto = `mailto:${email}`;
  import('expo-linking').then(Linking => {
    Linking.default.openURL(mailto).catch(err => 
      console.error('Error opening email:', err)
    );
  });
}}
```

---

## Design Specifications

### Layout
- **Position**: Between stats cards and team list
- **Margin**: 16px horizontal, 16px vertical
- **Padding**: 16px all sides
- **Border Radius**: 12px
- **Border**: Hairline width, theme-aware color

### Typography
```typescript
Contact Title: 18px, 700 weight
Email Address: 16px, 600 weight, underlined
Purpose Text:  14px, normal weight, 20px line height
```

### Colors (Theme-Aware)
```typescript
Background: Colors[colorScheme].surface
Border:     Colors[colorScheme].border
Title:      Colors[colorScheme].text
Email:      Colors[colorScheme].tint (blue)
Icons:      Colors[colorScheme].tint / mutedText
```

### Spacing
```typescript
Header → Email:     12px margin bottom
Email → Purposes:   12px margin bottom
Between purposes:   8px gap
Icon → Text:        8px gap
Header icon-title:  8px gap
```

---

## Technical Implementation

### Code Structure

**Contact Section** (Lines 189-223):
```tsx
<View style={[styles.contactSection, { 
  backgroundColor: Colors[colorScheme].surface,
  borderColor: Colors[colorScheme].border 
}]}>
  <View style={styles.contactHeader}>
    <Ionicons name="mail-outline" size={24} color={tint} />
    <Text style={styles.contactTitle}>Contact</Text>
  </View>
  
  <Pressable style={styles.contactEmailContainer} onPress={openEmail}>
    <Text style={styles.contactEmail}>
      customerservice@varsityhub.app
    </Text>
  </Pressable>
  
  <View style={styles.contactPurposes}>
    <View style={styles.contactPurposeItem}>
      <Ionicons name="megaphone-outline" size={16} />
      <Text>Ad acquisitions</Text>
    </View>
    <View style={styles.contactPurposeItem}>
      <Ionicons name="help-circle-outline" size={16} />
      <Text>Customer service</Text>
    </View>
  </View>
</View>
```

### New Styles Added

```typescript
contactSection: {
  marginHorizontal: 16,
  marginVertical: 16,
  padding: 16,
  borderRadius: 12,
  borderWidth: StyleSheet.hairlineWidth,
}

contactHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
}

contactTitle: {
  fontSize: 18,
  fontWeight: '700',
}

contactEmailContainer: {
  marginBottom: 12,
}

contactEmail: {
  fontSize: 16,
  fontWeight: '600',
  textDecorationLine: 'underline',
}

contactPurposes: {
  gap: 8,
}

contactPurposeItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
}

contactPurposeText: {
  fontSize: 14,
  lineHeight: 20,
}
```

---

## Placement Logic

The contact section appears in the `ListHeader` component, positioned after the stats section:

```
ListHeader Structure:
├── Action Cards (Create Team, View Billing, Archives)
├── Search Bar
├── Stats Section (Active, Members, Archived)
├── ⭐ Contact Section (NEW)
├── Loading/Error States
└── Section Title ("Active Teams")
```

This ensures it's visible above the team list and below the key stats.

---

## Use Cases

### 1. Advertising Inquiry
```
User Journey:
1. Coach wants to promote team/event
2. Sees "Contact" section
3. Reads "Ad acquisitions" purpose
4. Taps email address
5. Email app opens with pre-filled address
6. Composes inquiry about ad placement
7. Sends email
```

### 2. Support Request
```
User Journey:
1. Coach has question about team management
2. Sees "Contact" section
3. Reads "Customer service" purpose
4. Taps email address
5. Email app opens
6. Writes support question
7. Sends email
```

### 3. General Inquiry
```
User Journey:
1. User needs help with any feature
2. Scrolls through Manage Teams
3. Notices contact card
4. Understands dual purpose (ads + support)
5. Contacts appropriate department
```

---

## Accessibility

### Screen Reader Support
```typescript
// Email button
accessibilityLabel="Email customer service at customerservice@varsityhub.app"
accessibilityRole="button"
accessibilityHint="Opens your email app to contact VarsityHub"

// Purpose items
accessibilityLabel="For ad acquisitions and customer service inquiries"
```

### Touch Target
- Email address is fully tappable
- Minimum 44x44pt touch area (iOS guideline)
- Clear visual feedback on press

---

## Testing Checklist

### Visual Testing
- [ ] Contact card displays below stats
- [ ] Email is blue and underlined
- [ ] Icons render correctly (mail, megaphone, help)
- [ ] Card has proper border and padding
- [ ] Light/dark theme colors adapt correctly

### Interaction Testing
- [ ] Tapping email opens email app (iOS)
- [ ] Tapping email opens email app (Android)
- [ ] Email address pre-fills in "To:" field
- [ ] Error handling if no email app available

### Layout Testing
- [ ] Card doesn't overflow on small screens
- [ ] Text wraps properly if needed
- [ ] Spacing is consistent
- [ ] Card appears in correct position

### Theme Testing
- [ ] Light mode: White card, dark text
- [ ] Dark mode: Dark card, light text
- [ ] Icons match theme tint color
- [ ] Border color adapts to theme

---

## Edge Cases Handled

### No Email App
If device has no email app configured:
```typescript
.catch(err => console.error('Error opening email:', err))
```
Silently fails and logs error (doesn't crash app)

### Long Email Address
Email uses flexible container - will wrap if needed on very small screens

### Theme Switching
All colors are theme-aware using `Colors[colorScheme]`

---

## Future Enhancements

### 1. Copy Email Button
Add a copy-to-clipboard option:
```typescript
<Pressable onPress={copyEmail}>
  <Ionicons name="copy-outline" size={18} />
</Pressable>
```

### 2. Direct Call Option
Add phone number for urgent support:
```typescript
<Pressable onPress={() => Linking.openURL('tel:+1234567890')}>
  <Text>Call: (123) 456-7890</Text>
</Pressable>
```

### 3. FAQ Link
Link to help center:
```typescript
<Pressable onPress={() => router.push('/help')}>
  <Text>View FAQ →</Text>
</Pressable>
```

### 4. Category Selection
Pre-fill email subject based on purpose:
```typescript
const mailto = `mailto:customerservice@varsityhub.app?subject=${
  type === 'ads' ? 'Ad Inquiry' : 'Support Request'
}`;
```

### 5. Live Chat
Integrate support chat:
```typescript
<Pressable onPress={openLiveChat}>
  <Ionicons name="chatbubble-outline" />
  <Text>Live Chat</Text>
</Pressable>
```

---

## Related Files

**Modified**:
- `app/manage-teams.tsx` - Added contact section and styles

**Related Screens**:
- `app/settings/contact.tsx` - General contact form
- `app/help.tsx` - Help and FAQ screen
- `app/submit-ad.tsx` - Ad submission form

---

## Summary

✅ **Added**: Professional contact card in Manage Teams
✅ **Email**: customerservice@varsityhub.app (tappable)
✅ **Purposes**: Ad acquisitions + Customer service
✅ **Interactive**: Opens email app on tap
✅ **Theme Support**: Full light/dark mode
✅ **Accessible**: Clear labels and icons
✅ **Positioned**: Between stats and team list

The contact section provides coaches with a clear, accessible way to reach VarsityHub for both advertising opportunities and support needs.

---

*Feature Documentation - VarsityHub Development Team*
