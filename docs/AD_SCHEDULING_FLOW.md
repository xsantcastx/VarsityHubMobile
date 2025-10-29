# 📅 Ad Scheduling Flow - Current & Proposed

## Current Behavior ✅

### What Works Now:
1. **Create Ad** → User creates ad with business info & banner
2. **My Ads** → Shows all user's ads with scheduled dates
3. **Schedule Dates** → User clicks "Schedule Dates" button
4. **Calendar** → Shows available dates (8 weeks ahead)
5. **Reserved Dates** → Already-scheduled dates for THIS ad are disabled
6. **Payment** → User pays for selected dates
7. **Repeat** → User can return and schedule MORE dates later

### Current Code Flow:
```
submit-ad.tsx → Create Ad
   ↓
my-ads.tsx → View My Ads
   ↓ [Schedule Dates button]
ad-calendar.tsx → Select Dates & Pay
   ↓
Payment Success → Dates Reserved
   ↓
[Back to My Ads] → Can Schedule MORE Dates
```

---

## 🐛 Issue Identified

### Problem:
When viewing "My Ads", the system shows:
- ✅ All scheduled dates (past, present, future)
- ❌ But doesn't distinguish between:
  - **Past dates** (ad already ran - COMPLETED)
  - **Future dates** (ad will run - ACTIVE)
  - **Expired dates** (past but never scheduled - MISSED)

### User Confusion:
1. User buys ad and schedules dates
2. Dates pass (ad runs successfully)
3. User goes back to "My Ads"
4. Sees same dates, thinks they need to pay again
5. Clicks "Schedule Dates"
6. Dates are already in `reserved` set, can't select them
7. User is confused: "I paid, why can't I use it?"

---

## ✨ Proposed Solution

### Add Date Status Categories:

```typescript
enum AdDateStatus {
  SCHEDULED = 'scheduled',  // Future date, paid for
  ACTIVE = 'active',        // Date is today
  COMPLETED = 'completed',  // Past date, ad ran successfully
  AVAILABLE = 'available',  // Future date, not scheduled
  UNAVAILABLE = 'unavailable' // Past date, not scheduled
}
```

### Visual Improvements in My Ads:

```tsx
<View style={styles.scheduledDates}>
  {/* Past Dates - Completed */}
  <Text style={styles.sectionLabel}>Completed ✅</Text>
  {pastDates.map(d => (
    <View style={[styles.badge, styles.badgeCompleted]}>
      <Text>{formatDate(d)}</Text>
    </View>
  ))}
  
  {/* Future Dates - Active */}
  <Text style={styles.sectionLabel}>Upcoming 📅</Text>
  {futureDates.map(d => (
    <View style={[styles.badge, styles.badgeActive]}>
      <Text>{formatDate(d)}</Text>
    </View>
  ))}
</View>
```

### Color Coding:
- **Green badges** 🟢 → Completed dates (past)
- **Blue badges** 🔵 → Upcoming dates (future)
- **Gray badges** ⚫ → Unavailable/Expired

---

## 🔧 Implementation Plan

### Phase 1: Add Date Status Logic

**File**: `app/my-ads.tsx`

```typescript
const categorizeAdDates = (dates: string[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const past: string[] = [];
  const future: string[] = [];
  
  dates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    if (date < today) {
      past.push(dateStr);
    } else {
      future.push(dateStr);
    }
  });
  
  return { past, future };
};
```

### Phase 2: Update UI

**In `renderItem` function:**

```typescript
const renderItem = ({ item }: { item: DraftAd }) => {
  const dates = datesByAd[item.id] || [];
  const { past, future } = categorizeAdDates(dates);
  const hasCompleted = past.length > 0;
  const hasUpcoming = future.length > 0;
  
  return (
    <View style={styles.card}>
      {/* Business Info */}
      <Text style={styles.title}>{item.business_name}</Text>
      
      {/* Completed Dates */}
      {hasCompleted && (
        <>
          <Text style={styles.sectionTitle}>
            Completed ✅ ({past.length})
          </Text>
          <View style={styles.badgeWrap}>
            {past.map(d => (
              <View key={d} style={[styles.badge, styles.badgeCompleted]}>
                <Text style={styles.badgeText}>{formatDate(d)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      
      {/* Upcoming Dates */}
      {hasUpcoming && (
        <>
          <Text style={styles.sectionTitle}>
            Upcoming 📅 ({future.length})
          </Text>
          <View style={styles.badgeWrap}>
            {future.map(d => (
              <View key={d} style={[styles.badge, styles.badgeActive]}>
                <Text style={styles.badgeText}>{formatDate(d)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      
      {/* No Dates */}
      {!hasCompleted && !hasUpcoming && (
        <Text style={styles.muted}>No dates scheduled yet</Text>
      )}
      
      {/* Actions */}
      <View style={styles.row}>
        <Pressable 
          style={styles.btn}
          onPress={() => router.push({
            pathname: '/ad-calendar',
            params: { adId: item.id }
          })}
        >
          <Text style={styles.btnText}>
            {hasUpcoming ? 'Schedule More' : 'Schedule Dates'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
```

### Phase 3: Add Status Styles

```typescript
const styles = StyleSheet.create({
  // ... existing styles ...
  
  badgeCompleted: {
    backgroundColor: '#D1FAE5', // Light green
    borderColor: '#10B981',
    borderWidth: 1,
  },
  
  badgeActive: {
    backgroundColor: '#DBEAFE', // Light blue
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  
  sectionTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
    opacity: 0.7,
  },
});
```

---

## 📊 Enhanced Calendar View

### In `ad-calendar.tsx`:

**Show past scheduled dates as "completed" in calendar:**

```typescript
// Mark reserved dates with status
const markedDates = useMemo(() => {
  const obj: Record<string, any> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Selected dates (blue)
  for (const d of selected) {
    obj[d] = {
      selected: true,
      selectedColor: '#3B82F6', // Blue
    };
  }
  
  // Reserved dates - check if past or future
  for (const d of reserved) {
    const date = new Date(d + 'T00:00:00');
    const isPast = date < today;
    
    obj[d] = {
      disabled: true,
      disableTouchEvent: true,
      marked: true,
      dotColor: isPast ? '#10B981' : '#6B7280', // Green for past, gray for future
      selected: false,
    };
  }
  
  return obj;
}, [selected, reserved]);
```

---

## 🎯 User Experience Flow (After Fix)

### Scenario 1: User with Past Dates

**My Ads Screen:**
```
┌─────────────────────────────────┐
│ My Business Ad                  │
│                                 │
│ Completed ✅ (3)                │
│ [Oct 1] [Oct 2] [Oct 3]       │
│ (Green badges)                  │
│                                 │
│ Upcoming 📅 (2)                │
│ [Nov 15] [Nov 16]              │
│ (Blue badges)                   │
│                                 │
│ [Schedule More] [Edit] [Delete] │
└─────────────────────────────────┘
```

**What user sees:**
- ✅ Clear distinction between completed and upcoming
- ✅ Can see ad history (what dates already ran)
- ✅ "Schedule More" button makes it clear they can add new dates
- ✅ No confusion about payment - past dates are marked "Completed"

### Scenario 2: User with No Past Dates

```
┌─────────────────────────────────┐
│ My Business Ad                  │
│                                 │
│ Upcoming 📅 (5)                │
│ [Nov 20] [Nov 21] [Nov 22]     │
│ [Nov 23] [Nov 24]              │
│ (Blue badges)                   │
│                                 │
│ [Schedule More] [Edit] [Delete] │
└─────────────────────────────────┘
```

### Scenario 3: New Ad (No Dates)

```
┌─────────────────────────────────┐
│ My Business Ad                  │
│                                 │
│ No dates scheduled yet          │
│                                 │
│ [Schedule Dates] [Edit] [Delete]│
└─────────────────────────────────┘
```

---

## 🚀 Benefits

1. **Clear Status** → Users instantly see completed vs upcoming
2. **No Confusion** → Green badges show "already done, paid, ran"
3. **Historical Record** → Users can track ad performance
4. **Reusable Ads** → "Schedule More" encourages repeat scheduling
5. **Better UX** → Visual feedback reduces support questions

---

## 📝 Additional Enhancements (Optional)

### 1. Performance Metrics:
```typescript
interface AdMetrics {
  totalImpressions: number;
  clickThroughRate: number;
  datesCompleted: number;
  datesUpcoming: number;
}
```

### 2. Auto-Archive:
- After 30 days, move completed dates to "History" section
- Keep upcoming dates prominent

### 3. Notifications:
- Day before: "Your ad runs tomorrow!"
- Day of: "Your ad is live today!"
- Day after: "Your ad completed successfully!"

---

## 🔍 Testing Checklist

- [ ] Ad with only past dates shows "Completed" section
- [ ] Ad with only future dates shows "Upcoming" section
- [ ] Ad with mix shows both sections
- [ ] New ad with no dates shows "No dates scheduled"
- [ ] Calendar disables past reserved dates
- [ ] Calendar allows selecting new future dates
- [ ] Payment only charged for NEW dates
- [ ] "Schedule More" button text changes appropriately
- [ ] Color coding is consistent (green=past, blue=future)
- [ ] Dark mode support for all badge colors

---

## 🎨 Color Palette

**Light Mode:**
- Completed: Background `#D1FAE5` Border `#10B981` (Green)
- Upcoming: Background `#DBEAFE` Border `#3B82F6` (Blue)
- Unavailable: Background `#F3F4F6` Border `#9CA3AF` (Gray)

**Dark Mode:**
- Completed: Background `rgba(16, 185, 129, 0.2)` Border `#10B981`
- Upcoming: Background `rgba(59, 130, 246, 0.2)` Border `#3B82F6`
- Unavailable: Background `rgba(107, 114, 128, 0.2)` Border `#6B7280`

---

## ✅ Summary

**Current State**: Users see all scheduled dates without status distinction

**Proposed State**: Clear visual separation of completed vs upcoming dates

**Impact**: 
- Reduces confusion about payment
- Provides historical tracking
- Encourages ad reuse
- Improves overall UX

**Effort**: Low-Medium (mainly UI changes, backend already handles date logic)
