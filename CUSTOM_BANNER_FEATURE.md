# Custom Banner Upload Feature

## Overview
Added the ability to upload custom images for game banners in the QuickAddGameModal instead of using only auto-generated banners.

## Changes Made

### 1. Enhanced QuickAddGameModal.tsx
- Added new state variables for custom banner handling:
  - `uploadingCustomBanner`: Track upload status
  - Enhanced `bannerUrl` logic to prioritize custom uploads

### 2. New Functions Added
- `pickCustomBanner()`: Opens photo library with 16:9 aspect ratio
- `takeCustomBannerPhoto()`: Opens camera with 16:9 aspect ratio  
- `uploadCustomBanner()`: Handles file upload to server
- `showCustomBannerOptions()`: Shows alert with upload options
- `removeCustomBanner()`: Removes custom banner and reverts to auto-generated

### 3. Enhanced UI
- **Custom Banner Section**: When a custom banner is uploaded:
  - Shows the uploaded image
  - Provides "Change" and "Remove" buttons
  
- **Auto-Generated Banner Section**: When no custom banner is uploaded:
  - Shows the MatchBanner preview as before
  - Provides "Upload Custom" button to replace auto-generated banner
  - Provides "Edit Generated" button to edit the auto-generated banner
  - Only shows appearance picker when using auto-generated banners

### 4. Upload Priority Logic
- Custom uploaded banners take priority over auto-generated ones
- If user uploads a custom banner, it's used directly
- If no custom banner, the system captures and uploads the auto-generated preview
- Appearance settings only affect auto-generated banners

### 5. User Experience Improvements
- Clear visual distinction between custom and auto-generated banners
- Intuitive button layout with appropriate icons
- Upload progress indicators
- Confirmation dialogs for banner removal
- Proper aspect ratio (16:9) for custom banners

## How It Works

1. **Default State**: User sees auto-generated MatchBanner with team logos
2. **Custom Upload**: User can tap "Upload Custom" to choose from gallery or camera
3. **Custom Banner View**: Once uploaded, shows custom image with change/remove options
4. **Flexibility**: User can switch between custom and auto-generated at any time

## Technical Details

- Uses same upload infrastructure as other image uploads in the app
- Maintains compatibility with existing ImageEditor component
- Proper error handling and user feedback
- Aspect ratio enforcement (16:9) for consistent banner dimensions
- Image compression and optimization during upload

## Files Modified

- `components/QuickAddGameModal.tsx`: Main implementation
- Added proper TypeScript types and styling
- Enhanced save logic to handle both banner types

This feature gives users full control over their game banners while maintaining the convenience of auto-generated options.