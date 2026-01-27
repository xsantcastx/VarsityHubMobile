# Force Reload to See Changes

The duplicate icon has been removed from the code, but you need to reload the app to see the change.

## Quick Fix

In the Expo dev tools (or simulator), press:
- **`r`** - Reload the app
- Or shake the device/simulator and tap "Reload"

## Alternative: Restart Metro

If reload doesn't work:

```bash
# Stop Metro (Ctrl+C)
# Then restart with cleared cache
npx expo start --dev-client --clear
```

## Verify the Fix

After reloading, you should see:
- ✅ Only ONE information icon
- ✅ Only the text "Create games with locations"
- ✅ No duplicate "Follow teams near you" hint

The change is already in the code at `components/EventMap.tsx` line 248-253.
