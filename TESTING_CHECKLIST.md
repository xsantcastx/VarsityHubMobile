# VarsityHub Sports App - Testing Checklist

## 🚀 Quick Start Testing Guide

### Backend Server
1. **Start the server:**
   ```bash
   cd server && npm run dev
   ```
2. **Verify database is seeded:**
   ```bash
   cd server && npm run seed
   ```

### Frontend App  
1. **Start the Expo app:**
   ```bash
   npm start
   ```
2. **Test on device/simulator**

## 🎯 Core Features to Test

### ✅ Authentication & User Management
- [ ] User can sign up with email/password
- [ ] User can log in successfully
- [ ] User session persists across app restarts
- [ ] Profile editing works properly

### ✅ Highlights Feed (Main Feature)
- [ ] Highlights screen loads without errors
- [ ] Sports posts display with proper layout
- [ ] Tab switching works (Trending/Recent/Top)
- [ ] Pull-to-refresh updates content
- [ ] Tapping a post navigates to post detail
- [ ] Category badges show correct sports

### ✅ Post Detail Screen
- [ ] Post loads with all content (text, images, videos)
- [ ] Author info displays correctly
- [ ] **Upvote button:**
   - [ ] Shows correct initial state (upvoted/not upvoted)
   - [ ] Changes color when upvoted (blue → green)
   - [ ] Count updates immediately
   - [ ] State persists across navigation
- [ ] **Comments:**
   - [ ] Can add new comments
   - [ ] Comments appear immediately
   - [ ] Comment list loads properly
   - [ ] Send button disables during submission
- [ ] **Follow/Save buttons:**
   - [ ] Follow author works
   - [ ] Save post works
   - [ ] States show correctly
- [ ] **Share functionality:**
   - [ ] Share button opens native share dialog
   - [ ] Share content includes post details

### ✅ Navigation & UI
- [ ] Bottom tabs work correctly
- [ ] Create post button (center tab) opens create screen
- [ ] Back navigation works smoothly
- [ ] Loading states show during API calls
- [ ] Error messages appear for failed operations

## 🔧 Technical Validation

### ✅ API Endpoints
- [ ] `GET /highlights` - Returns sports posts
- [ ] `GET /posts/:id` - Returns post with user states
- [ ] `POST /posts/:id/upvote` - Toggles upvote
- [ ] `POST /posts/:id/comments` - Creates comment
- [ ] `POST /posts/:id/bookmark` - Toggles save
- [ ] `POST /users/:id/follow` - Follows user

### ✅ Database Operations
- [ ] Posts have proper upvote counts
- [ ] Comments are linked to posts and users
- [ ] User follows are tracked correctly
- [ ] Bookmarks are saved properly

### ✅ Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Invalid inputs are rejected gracefully
- [ ] Loading states prevent double-submissions
- [ ] Console logs show detailed error information

## 🏈 Sports App Specific Features

### ✅ Content Display
- [ ] Sports categories detected correctly (Football, Basketball, etc.)
- [ ] Video posts show play button overlay
- [ ] Recent posts show "LIVE" badge
- [ ] Professional sports app aesthetic maintained

### ✅ User Engagement
- [ ] Trending algorithm promotes popular posts
- [ ] Local content prioritized when location available
- [ ] Following relationships affect content ranking
- [ ] Sports statistics display correctly

## 🐛 Common Issues to Check

1. **Authentication Errors:**
   - Check if JWT tokens are being sent with requests
   - Verify user is logged in before testing protected features

2. **Database Connection:**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in server/.env

3. **API Response Issues:**
   - Check server console for error logs
   - Verify CORS is properly configured
   - Test API endpoints directly with Postman/curl

4. **Mobile App Issues:**
   - Clear Metro bundler cache: `npx expo start --clear`
   - Check device/simulator network connectivity
   - Verify API_URL points to correct server

## 🎉 Success Criteria

The app is working correctly when:
- Users can browse highlights without errors
- Upvotes and comments save properly
- Navigation is smooth and responsive
- All social features (follow/save/share) work
- Professional sports app design is maintained
- Error handling provides good user experience

---

**Last Updated:** September 29, 2025
**Version:** 1.0 - Feature/highlights branch