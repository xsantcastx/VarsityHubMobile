# Upload Page E2E Tests

**Date**: December 2024  
**Status**: ✅ **TESTS CREATED**

---

## Overview

Comprehensive E2E tests for the upload functionality to ensure file uploads work correctly in real-world scenarios, including validation, error handling, and integration with post creation.

---

## Test Coverage

### Upload Page Tests

1. **Upload page loads and displays correctly**
   - Verifies upload/create post page loads
   - Checks that upload UI is visible
   - Tests authentication integration

2. **Can upload an image file via API**
   - Creates test image file
   - Uploads via `/uploads` endpoint
   - Verifies upload succeeds and returns URL

3. **Upload API validates file types**
   - Attempts to upload invalid file type
   - Verifies API rejects invalid files
   - Tests validation error handling

4. **Upload API enforces file size limits**
   - Attempts to upload file larger than 25MB
   - Verifies API rejects oversized files
   - Tests size limit enforcement

5. **Can upload avatar via API**
   - Uploads avatar via `/upload/avatar` endpoint
   - Verifies avatar upload succeeds
   - Tests avatar-specific endpoint

6. **Avatar upload enforces size limit**
   - Attempts to upload avatar larger than 5MB
   - Verifies API rejects oversized avatars
   - Tests avatar size limit (5MB)

7. **Upload requires authentication**
   - Attempts upload without authentication
   - Verifies API requires authentication
   - Tests security

8. **Can upload general files via /uploads/files endpoint**
   - Uploads PDF file via `/uploads/files`
   - Verifies general file upload works
   - Tests different file types

9. **Upload page handles file picker**
   - Navigates to upload page
   - Verifies file picker UI exists
   - Tests UI components

10. **Upload page validates file before upload**
    - Verifies validation logic exists
    - Tests client-side validation
    - Ensures proper error handling

11. **Can create post with uploaded media**
    - Uploads media file
    - Creates post with media URL
    - Tests end-to-end flow

12. **Upload endpoint returns correct response structure**
    - Verifies response includes all required fields
    - Tests response format
    - Ensures API contract compliance

---

## Test Structure

### Helper Functions

- `generateTestData()` - Creates unique test user data
- `createUser()` - Creates user via API
- `loginUser()` - Logs in user via API
- `createTestImageFile()` - Creates minimal valid JPEG buffer
- `uploadFile()` - Helper for file uploads (note: Playwright limitations)

### Test Data

Each test generates unique data:
- Unique email addresses (timestamp + random)
- Unique display names
- Test passwords
- Test image files (minimal valid JPEG)

---

## Running the Tests

### Run All Upload Tests
```bash
npx playwright test tests/e2e/upload.spec.ts
```

### Run with UI Mode
```bash
npx playwright test tests/e2e/upload.spec.ts --ui
```

### Run in Debug Mode
```bash
npx playwright test tests/e2e/upload.spec.ts --debug
```

### Run in Headed Mode
```bash
npx playwright test tests/e2e/upload.spec.ts --headed
```

---

## Test Scenarios

### Upload API Scenarios

1. **User uploads image**
   - User authenticates
   - Uploads image file
   - Receives upload URL

2. **User uploads invalid file**
   - User attempts invalid file type
   - API rejects with error
   - User sees validation error

3. **User uploads oversized file**
   - User attempts large file
   - API rejects with size error
   - User sees size limit error

4. **User uploads avatar**
   - User uploads avatar image
   - Avatar saved successfully
   - Avatar URL returned

### Upload Page Scenarios

1. **User navigates to upload page**
   - User clicks create post
   - Upload page loads
   - File picker available

2. **User selects file**
   - User opens file picker
   - Selects image/video
   - File validated

3. **User creates post with media**
   - User uploads file
   - File URL received
   - Post created with media

---

## Expected Behavior

### Upload API

- ✅ Accepts image and video files
- ✅ Rejects invalid file types
- ✅ Enforces size limits (25MB media, 5MB avatars, 50MB general)
- ✅ Returns upload URL
- ✅ Supports Cloudinary and local storage
- ✅ Requires authentication (for some endpoints)

### Upload Page

- ✅ Loads without errors
- ✅ Shows file picker
- ✅ Validates files before upload
- ✅ Handles upload errors gracefully
- ✅ Shows upload progress
- ✅ Integrates with post creation

---

## Known Limitations

1. **Playwright File Upload**
   - Playwright's request API has limited multipart/form-data support
   - Some upload tests may need adjustment
   - Consider using actual browser file input for full E2E testing

2. **File Generation**
   - Tests use minimal valid JPEG files
   - Real-world files may behave differently
   - Consider testing with actual image/video files

3. **Cloudinary vs Local Storage**
   - Tests work with both storage backends
   - Response format may vary slightly
   - Storage type indicated in response

4. **Rate Limiting**
   - Avatar uploads are rate limited (10/hour)
   - Tests may hit rate limits if run multiple times
   - Consider rate limit handling in tests

---

## Troubleshooting

### Tests Fail to Upload Files

- Check if server is running: `npm run server:dev`
- Verify upload directory exists
- Check Cloudinary configuration (if using)
- Verify file size limits match expectations

### Authentication Issues

- Verify token is valid
- Check token format and expiration
- Ensure user is created and verified

### File Validation Fails

- Check allowed file types
- Verify MIME type detection
- Check file size limits
- Review validation logic

### Upload Endpoint Errors

- Check server logs for errors
- Verify multer configuration
- Check storage backend (Cloudinary/local)
- Verify file permissions

---

## Files

- `tests/e2e/upload.spec.ts` - Test file
- `docs/UPLOAD_TESTS.md` - This documentation

---

## Upload Endpoints Tested

1. **POST /uploads** - Media uploads (images/videos, 25MB limit)
2. **POST /uploads/files** - General file uploads (all types, 50MB limit)
3. **POST /upload/avatar** - Avatar uploads (images only, 5MB limit, rate limited)

---

## Security Features Tested

- ✅ Authentication required
- ✅ File type validation
- ✅ File size limits
- ✅ Rate limiting (avatars)
- ✅ MIME type validation

---

**Status**: ✅ **TESTS READY**  
**Next Steps**: Run tests to verify functionality, adjust for Playwright limitations if needed
