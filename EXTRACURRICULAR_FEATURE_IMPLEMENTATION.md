# Extracurricular Clubs Feature - Implementation Summary

## Overview
Implemented complete extracurricular clubs feature for Legend tier users. Legend plan subscribers can now create extracurricular clubs (Theater, Chess, Debate, Robotics, etc.) in addition to sports teams.

## Changes Made

### 1. Frontend UI - `src/features/teams/screens/CreateTeamScreen.tsx`

#### State Variables Added
```typescript
const [clubType, setClubType] = useState<'sport' | 'extracurricular'>('sport');
const [extracurricularCategory, setExtracurricularCategory] = useState('');
```

#### Club Type Selector (Legend-Only)
- Added radio button UI to choose between "Sport" and "Extracurricular"
- Only visible to users with Legend tier (`teamLimits.subscription_tier === 'legend'`)
- Two large card-style buttons with icons:
  - **Sport**: Basketball icon, "Athletic teams" subtitle
  - **Extracurricular**: School icon, "Theater, Chess, etc." subtitle
- Automatically clears extracurricular category when switching back to Sport

#### Extracurricular Category Input
- Text input field that appears when "Extracurricular" is selected
- Required field with validation (marked with red asterisk)
- Placeholder examples: "Theater, Chess Club, Debate Team, Robotics, etc."
- User can enter custom category name

#### Conditional Form Rendering
- **Sport Selection**: Only shown when `clubType === 'sport'`
- **Extracurricular Category**: Only shown when `clubType === 'extracurricular'`
- **Club Type Selector**: Only shown for Legend tier users

#### Form Validation
```typescript
if (clubType === 'extracurricular' && !extracurricularCategory.trim()) {
  Alert.alert('Category required', 'Please enter a category for your extracurricular club.');
  return;
}
```

#### API Payload Updated
```typescript
const teamData = {
  name: name.trim(),
  description: description.trim() || undefined,
  club_type: clubType,
  extracurricular_category: clubType === 'extracurricular' ? extracurricularCategory.trim() : undefined,
  sport: clubType === 'sport' ? (sport || undefined) : undefined,
  season_start: seasonType && seasonYear ? `${seasonYear}-${seasonType}` : undefined,
  primary_color: teamColor || undefined,
  organization_id: organizationId,
  logo_url: logoUrl || undefined,
};
```

#### Error Handling
Added specific error handler for Legend tier requirement:
```typescript
if (e?.code === 'LEGEND_TIER_REQUIRED') {
  Alert.alert(
    'Legend Plan Required',
    'Extracurricular clubs require the Legend plan. Upgrade to unlock this feature.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'View Plans', onPress: () => router.push('/subscription-paywall') }
    ]
  );
}
```

#### Styles Added
```typescript
clubTypeContainer: {
  flexDirection: 'row',
  gap: 12,
},
clubTypeButton: {
  flex: 1,
  padding: 16,
  borderRadius: 16,
  borderWidth: 2,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 120,
},
clubTypeButtonText: {
  fontSize: 16,
  fontWeight: '700',
  marginTop: 8,
},
clubTypeButtonSubtext: {
  fontSize: 12,
  fontWeight: '500',
  marginTop: 4,
  textAlign: 'center',
},
```

## Backend Validation (Already Existed)

### `server/src/routes/teams.ts` (lines 985-993)
Backend was already properly implemented:
```typescript
const clubType = data.club_type || 'sport';
if (clubType === 'extracurricular' && !planSupportsExtracurricular(userPlan)) {
  return res.status(403).json({
    error: 'Extracurricular clubs require Legend tier',
    code: 'LEGEND_TIER_REQUIRED'
  });
}
```

### Plan Definitions - `shared/plan-definitions.json`
```json
{
  "rookie": { "supports_extracurricular": false },
  "veteran": { "supports_extracurricular": false },
  "legend": { "supports_extracurricular": true }
}
```

## Feature Access Control

### Legend Plan Requirements
- **Club Type Selector**: Visible only to Legend users
- **Extracurricular Category**: Visible only when club type is extracurricular
- **Backend Validation**: Returns 403 LEGEND_TIER_REQUIRED for non-Legend users
- **Upgrade Prompt**: Non-Legend users see alert with link to subscription paywall

### User Experience Flow

#### For Rookie/Veteran Users
1. Create team form shows standard sport team creation
2. No club type selector visible
3. If somehow attempted via API, backend rejects with 403 error

#### For Legend Users
1. See "Club Type" section with Sport/Extracurricular toggle
2. Select "Extracurricular" to reveal category input
3. Enter category (e.g., "Theater Club", "Chess Team")
4. Form validates category is required
5. Team created with `club_type: 'extracurricular'` and custom category

## Testing Recommendations

### Manual Testing Checklist
- [ ] Test as Rookie user - club type selector should NOT appear
- [ ] Test as Veteran user - club type selector should NOT appear
- [ ] Test as Legend user - club type selector SHOULD appear
- [ ] Test creating sport team as Legend user
- [ ] Test creating extracurricular club as Legend user
- [ ] Test validation when category is empty for extracurricular
- [ ] Test switching between Sport/Extracurricular clears fields correctly
- [ ] Test that sport field is hidden when extracurricular selected
- [ ] Test backend 403 error handling (if non-Legend somehow attempts)
- [ ] Test navigation to subscription paywall on upgrade prompt

### Integration Testing
- [ ] Verify extracurricular teams display correctly on team profile page
- [ ] Verify organization page lists extracurricular clubs correctly
- [ ] Verify team search/filtering works with extracurricular clubs
- [ ] Verify team members can join extracurricular clubs
- [ ] Verify schedule/roster features work for extracurricular clubs

## Files Modified
1. `src/features/teams/screens/CreateTeamScreen.tsx` - Complete UI implementation

## Files Referenced (No Changes)
1. `server/src/routes/teams.ts` - Backend validation (already working)
2. `shared/plan-definitions.json` - Plan tier definitions (already configured)
3. `server/src/lib/planLimits.ts` - Backend plan utilities (already working)
4. `constants/plans.ts` - Frontend plan helpers (already working)

## No Breaking Changes
- Existing sport team creation flow unchanged
- Backward compatible - defaults to `club_type: 'sport'` if not specified
- Non-Legend users see no UI changes
- All existing teams continue to work normally

## Security Considerations
- ✅ Backend validates Legend tier requirement
- ✅ Frontend only shows option to Legend users
- ✅ Form validates required fields before submission
- ✅ API payload sanitized (trim whitespace)
- ✅ Error handling prevents information leakage
- ✅ No client-side bypasses possible (backend enforces)

## Future Enhancements
- Add predefined extracurricular categories dropdown (Theater, Chess, Debate, Robotics, Art, Music, etc.)
- Add category icons/emojis for better visual distinction
- Add filtering by club type on organization/team list pages
- Add analytics for most popular extracurricular categories
- Add category-specific features (e.g., performance schedules for Theater, tournament brackets for Chess)
