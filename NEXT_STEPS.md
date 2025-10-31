# 🚀 NEXT STEPS - Fan Event Approval System

## ⚠️ STEP 1: Database Migration (REQUIRED)

**You must run this before the feature will work:**

```bash
cd server
npx prisma migrate dev --name add_event_approvals
npx prisma generate
```

**What this does:**
- Creates SQL migration for Event model changes
- Adds new columns: `creator_id`, `creator_role`, `approval_status`, `event_type`, `description`, `linked_league`, `max_attendees`, `contact_info`, `approved_by`, `approved_at`, `rejected_reason`
- Adds `User.createdEvents` relation
- Regenerates Prisma client with updated types
- Fixes TypeScript errors in `server/src/routes/events.ts`

**Expected output:**
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
```

---

## 🧪 STEP 2: Test the Feature

### Start the servers:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Mobile App):**
```bash
npm start
# Press 'i' for iOS or 'a' for Android
```

### Test as a Fan:

1. **Login as a fan user** (or create new account with role: 'fan')

2. **Navigate:** Tap "+" tab → "Create Fan Event"

3. **Fill the form:**
   - Event Type: Watch Party
   - Title: "Stamford vs Greenwich Watch Party"
   - Description: "Join us at Campus Pub to watch the big game!"
   - Date: Tomorrow
   - Time: 7:00 PM
   - Location: "Campus Pub, Stamford CT"
   - League: "Stamford High School" (optional)
   - Max Attendees: 50 (optional)
   - Contact: Your email (optional)

4. **Submit → Should see:** "Event Submitted for Approval" alert

5. **Try creating 3 more events** → 4th should trigger limit error

### Test as a Coach:

1. **Login as coach user** (role must be 'coach', 'organizer', or 'admin')

2. **Navigate to approvals:**
   - Option A: Add link manually to create.tsx (see step 3 below)
   - Option B: Navigate directly: `http://localhost:8081/event-approvals`

3. **See pending events** → Should show the fan's submitted event

4. **Approve the event:**
   - Tap "Approve" button
   - See success alert
   - Event disappears from list

5. **Verify event is published:**
   - Navigate to events feed
   - Should see approved event

6. **Test rejection:**
   - Have fan create another event
   - Tap "Reject" button
   - Enter reason: "Missing venue details"
   - Submit
   - Event disappears from list

---

## 🔧 STEP 3: Add Navigation to Approvals

**Option A: Add to Create Menu (for coaches only)**

Edit `app/create.tsx` and add this after line 50:

```tsx
{me?.preferences?.role === 'coach' || me?.preferences?.role === 'organizer' || me?.preferences?.role === 'admin' ? (
  <Pressable 
    style={[styles.item, { borderColor: Colors[colorScheme].border }]} 
    onPress={() => router.push('/event-approvals')}
  >
    <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>
      Event Approvals
    </Text>
  </Pressable>
) : null}
```

**Option B: Add to Settings/Profile Screen**

Find your settings screen and add a menu item:

```tsx
<Pressable onPress={() => router.push('/event-approvals')}>
  <Text>Event Approvals</Text>
  {pendingCount > 0 && <Badge count={pendingCount} />}
</Pressable>
```

---

## 📋 Verification Checklist

After running migration and testing:

### Database
- [ ] Migration ran without errors
- [ ] Event table has new columns (check with `SELECT * FROM "Event" LIMIT 1`)
- [ ] Indexes created successfully

### Backend API
- [ ] POST /events creates events with `approval_status='pending'` for fans
- [ ] POST /events creates events with `approval_status='approved'` for coaches
- [ ] GET /events/pending returns pending events (coach only)
- [ ] PUT /events/:id/approve works
- [ ] PUT /events/:id/reject works
- [ ] Event limit enforced (3 pending max for Rookie fans)

### Frontend
- [ ] Event creation form loads
- [ ] All form fields work (date picker, type selector, etc.)
- [ ] Validation shows errors for required fields
- [ ] Submit button disabled during processing
- [ ] Success messages appear after submission
- [ ] Approvals dashboard loads (coach only)
- [ ] Approve/reject actions work
- [ ] Pull-to-refresh updates list

---

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"
**Solution:**
```bash
cd server
npm install
npx prisma generate
```

### "Field 'approval_status' does not exist in Event"
**Solution:**
```bash
cd server
npx prisma migrate dev --name add_event_approvals
npx prisma generate
npm run dev  # Restart server
```

### "PERMISSION_DENIED" when accessing /event-approvals
**Solution:** Check user role in database:
```sql
SELECT id, display_name, preferences FROM "User" WHERE id = YOUR_USER_ID;
```
Role should be in `preferences.role` as 'coach', 'organizer', or 'admin'.

To update:
```sql
UPDATE "User" 
SET preferences = jsonb_set(preferences, '{role}', '"coach"') 
WHERE id = YOUR_USER_ID;
```

### Event limit not working
**Check:** User's subscription plan in database:
```sql
SELECT subscription_plan FROM "User" WHERE id = YOUR_USER_ID;
```
Should be 'rookie' for free tier. Event limit only applies to fans on Rookie plan.

### Date picker not showing on Android
**Install dependency:**
```bash
npx expo install @react-native-community/datetimepicker
```

---

## 🎯 What's Been Built

### ✅ Complete
- Event schema with approval workflow
- Backend API (create, pending list, approve, reject)
- Event creation screen (full-featured form)
- Event approvals dashboard (moderator interface)
- Event limits (3 pending for Rookie fans)
- Role-based permissions (fan/coach/admin)
- Dark mode support
- Input validation
- Error handling

### 🔜 Optional Additions
- Navigation to approvals (manual step above)
- Notification system integration
- "My Events" screen for creators
- League page
- Event detail view with status
- Map view for event locations
- Calendar integration

---

## 📚 Documentation

**Full implementation details:**
- `FAN_EVENT_IMPLEMENTATION_SUMMARY.md` - Complete guide with testing, deployment
- `todo.md` - Original requirements and screenshots
- `server/src/routes/events.ts` - All API endpoints with comments

**Backend endpoints:**
```
POST   /events              - Create event (fan=pending, coach=approved)
GET    /events              - List approved events
GET    /events/pending      - List pending events (coach only)
PUT    /events/:id/approve  - Approve event (coach only)
PUT    /events/:id/reject   - Reject event (coach only)
```

**Frontend screens:**
```
/create-fan-event    - Event creation form
/event-approvals     - Moderator approval dashboard
```

---

## 🎉 You're Ready!

Once you run the migration (Step 1), the feature is fully functional. Test it out and let me know if you hit any issues!

**Quick test command:**
```bash
cd server && npx prisma migrate dev --name add_event_approvals && npx prisma generate && npm run dev
```

Then open the app and create an event! 🚀
