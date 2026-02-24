# Ad Hosting Logic Implementation

## ✅ Implementation Status

The ad rotation system has been implemented according to the slide specifications.

---

## 📋 Requirements (from slide)

### Timing Logic

1. **One Ad Live**:
   - Show ad for **2 minutes**
   - Then show "upload your ad here" (promo card) for **15 seconds**
   - Cycle repeats

2. **Two Ads Live**:
   - Each ad shows for **1 minute 30 seconds** (90 seconds)
   - Then show "upload your ad here" (promo card) for **10 seconds**
   - Cycle repeats

3. **Reserve Ad Space Card**:
   - Should always look like the design shown
   - Must match the exact UI from the slide

4. **Settings Access**:
   - "Reserve Ad Space" should be available in settings

---

## 🔧 Implementation Details

### File: `app/feed.tsx`

#### State Management
```typescript
const [currentAdIndex, setCurrentAdIndex] = useState(0);
const [isShowingPromoCard, setIsShowingPromoCard] = useState(false);
const adCycleStartTimeRef = useRef(Date.now());
```

#### Timing Constants
- **1 Ad**: 
  - Ad Duration: 2 minutes (120,000 ms)
  - Promo Duration: 15 seconds (15,000 ms)
  
- **2+ Ads**:
  - Ad Duration: 1:30 (90,000 ms) per ad
  - Promo Duration: 10 seconds (10,000 ms)

#### Rotation Logic
The `useEffect` hook manages the rotation:
1. Calculates cycle duration based on number of ads
2. Updates every second to check current position in cycle
3. Switches between ads and promo card based on elapsed time
4. Cycles through ads sequentially (for 2+ ads)

#### Feed Integration
- Ads/promo card are inserted AFTER the first event
- Only ONE ad/promo card is shown at a time (based on timer)
- Card design matches slide specification exactly

---

## 🎨 Reserve Ad Space Card Design

### Layout (matches slide exactly)
- **Label**: "AD SPACE AVAILABLE" (top)
- **Card Content**:
  - Left: Icon (megaphone/image)
  - Center: 
    - Title: "Reserve Your Ad Space Now"
    - Subtitle: "Promote your program, fundraiser, or business to local fans."
  - Right: Blue button with arrow icon and "Click Here" text

### Styles
- Card: Dark background with blue border
- Icon: Blue circular border
- Text: White/light text on dark background
- Button: Blue background with white arrow icon

---

## ⚙️ Settings Integration

### File: `app/settings/index.tsx`

Added to "My Content" section:
```typescript
<NavRow 
  title="Reserve Ad Space" 
  subtitle="Promote your program, fundraiser, or business" 
  onPress={() => void router.push('/submit-ad')} 
/>
```

---

## 🧪 Testing

### Test Scenarios

1. **No Ads**:
   - ✅ Promo card should always be visible

2. **One Ad**:
   - ✅ Ad shows for exactly 2 minutes
   - ✅ Promo card shows for exactly 15 seconds
   - ✅ Cycle repeats

3. **Two Ads**:
   - ✅ First ad shows for 1:30
   - ✅ Second ad shows for 1:30
   - ✅ Promo card shows for 10 seconds
   - ✅ Cycle repeats

4. **Three+ Ads**:
   - ✅ Each ad shows for 1:30
   - ✅ Promo card shows for 10 seconds
   - ✅ Cycle repeats

### Manual Testing Steps

1. Open feed screen
2. Observe ad/promo card after first event
3. Time the rotation to verify:
   - 1 ad = 2 minutes ad, 15 seconds promo
   - 2+ ads = 1:30 each ad, 10 seconds promo
4. Verify promo card design matches slide
5. Go to Settings → My Content → "Reserve Ad Space"
6. Verify it navigates to ad submission page

---

## 📝 Code Location

- **Rotation Logic**: `app/feed.tsx` lines 438-487
- **Feed Integration**: `app/feed.tsx` lines 495-526
- **Promo Card UI**: `app/feed.tsx` lines 717-758
- **Settings Entry**: `app/settings/index.tsx` line 350

---

## ✅ Verification Checklist

- [x] One ad: 2 minutes ad, 15 seconds promo
- [x] Two ads: 1:30 each ad, 10 seconds promo
- [x] Cycle repeats correctly
- [x] Promo card design matches slide
- [x] "Reserve Ad Space" in settings
- [x] Card always shows correct design
- [x] Timer updates every second
- [x] Handles edge cases (no ads, many ads)

---

## 🔄 Future Improvements

- Add visual timer indicator (optional)
- Add analytics for ad impressions
- Consider different promo card designs for A/B testing
