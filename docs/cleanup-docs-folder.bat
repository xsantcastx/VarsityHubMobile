@echo off
REM Archive old scattered documentation files in docs/ folder
REM Keeps only the new consolidated documentation structure

echo ========================================
echo VarsityHub Docs Folder Cleanup
echo ========================================
echo.

echo Creating archive subfolder...
if not exist "archive" mkdir "archive"

echo.
echo Moving old documentation files to archive...

REM Architecture & Design Docs
if exist "ACCESSIBILITY_IMPLEMENTATION.md" move "ACCESSIBILITY_IMPLEMENTATION.md" "archive\"
if exist "BANNER_UPLOAD_IMPLEMENTATION.md" move "BANNER_UPLOAD_IMPLEMENTATION.md" "archive\"
if exist "CLIENT_REQUIREMENTS_SIMPLE.md" move "CLIENT_REQUIREMENTS_SIMPLE.md" "archive\"
if exist "COACH_ONBOARDING_ENHANCEMENTS.md" move "COACH_ONBOARDING_ENHANCEMENTS.md" "archive\"
if exist "CORE_VALUES_QUICK_REFERENCE.md" move "CORE_VALUES_QUICK_REFERENCE.md" "archive\"
if exist "CORE_VALUES_SAFETY_SETTINGS.md" move "CORE_VALUES_SAFETY_SETTINGS.md" "archive\"
if exist "DISCOVER_IMPLEMENTATION_SUMMARY.md" move "DISCOVER_IMPLEMENTATION_SUMMARY.md" "archive\"
if exist "DISCOVER_PAGE_ENHANCEMENTS.md" move "DISCOVER_PAGE_ENHANCEMENTS.md" "archive\"
if exist "FEED_PINTEREST_MASONRY_LAYOUT.md" move "FEED_PINTEREST_MASONRY_LAYOUT.md" "archive\"
if exist "HIGHLIGHTS_FEATURE_IMPROVEMENTS.md" move "HIGHLIGHTS_FEATURE_IMPROVEMENTS.md" "archive\"
if exist "IMPLEMENTATION_OVERVIEW.md" move "IMPLEMENTATION_OVERVIEW.md" "archive\"
if exist "IMPLEMENTATION_ROADMAP.md" move "IMPLEMENTATION_ROADMAP.md" "archive\"
if exist "LEAGUE_PAGE_ONBOARDING_MODAL.md" move "LEAGUE_PAGE_ONBOARDING_MODAL.md" "archive\"
if exist "LEAGUE_PAGE_ONBOARDING_SUMMARY.md" move "LEAGUE_PAGE_ONBOARDING_SUMMARY.md" "archive\"
if exist "MANAGE_TEAMS_CONTACT_SECTION.md" move "MANAGE_TEAMS_CONTACT_SECTION.md" "archive\"
if exist "MY_ADS_REDESIGN_AND_DARK_MODE.md" move "MY_ADS_REDESIGN_AND_DARK_MODE.md" "archive\"
if exist "MY_ADS_VISUAL_OVERVIEW.md" move "MY_ADS_VISUAL_OVERVIEW.md" "archive\"
if exist "ONBOARDING_REDESIGN_GUIDE.md" move "ONBOARDING_REDESIGN_GUIDE.md" "archive\"
if exist "POST_DETAIL_NAVIGATION_SHARING.md" move "POST_DETAIL_NAVIGATION_SHARING.md" "archive\"
if exist "POST_DETAIL_QUICK_REFERENCE.md" move "POST_DETAIL_QUICK_REFERENCE.md" "archive\"
if exist "SIX_FEATURES_IMPLEMENTATION_SUMMARY.md" move "SIX_FEATURES_IMPLEMENTATION_SUMMARY.md" "archive\"
if exist "UPLOAD_FLOW_STATUS.md" move "UPLOAD_FLOW_STATUS.md" "archive\"

REM Bug Fix Documentation
if exist "AD_CALENDAR_SAFE_AREA_FIX.md" move "AD_CALENDAR_SAFE_AREA_FIX.md" "archive\"
if exist "AD_PAYMENT_BUTTON_LOADING_FIX.md" move "AD_PAYMENT_BUTTON_LOADING_FIX.md" "archive\"
if exist "AD_PAYMENT_FLOW_FIX.md" move "AD_PAYMENT_FLOW_FIX.md" "archive\"
if exist "AD_SYSTEM_IMPLEMENTATION.md" move "AD_SYSTEM_IMPLEMENTATION.md" "archive\"
if exist "BACKEND_FIXES_ADS_DELETE_AND_PAYMENT.md" move "BACKEND_FIXES_ADS_DELETE_AND_PAYMENT.md" "archive\"
if exist "BACKEND_FIXES_QUICK_REF.md" move "BACKEND_FIXES_QUICK_REF.md" "archive\"
if exist "BUGFIX_EVENT_PAGES_SAFE_AREA.md" move "BUGFIX_EVENT_PAGES_SAFE_AREA.md" "archive\"
if exist "BUGFIX_MANAGE_TEAMS_IMAGE_PATH.md" move "BUGFIX_MANAGE_TEAMS_IMAGE_PATH.md" "archive\"
if exist "BUGFIX_MATCHBANNER_TOPBAR_OVERLAP.md" move "BUGFIX_MATCHBANNER_TOPBAR_OVERLAP.md" "archive\"
if exist "BUGFIX_NAVIGATION_SCREEN_NOT_EXIST.md" move "BUGFIX_NAVIGATION_SCREEN_NOT_EXIST.md" "archive\"
if exist "BUGFIX_SETTINGS_NAVIGATION.md" move "BUGFIX_SETTINGS_NAVIGATION.md" "archive\"
if exist "DELETE_ENDPOINT_AUTH_FIX.md" move "DELETE_ENDPOINT_AUTH_FIX.md" "archive\"
if exist "FIX_RED_DOTS_PERSISTENT.md" move "FIX_RED_DOTS_PERSISTENT.md" "archive\"
if exist "IMAGE_COMPATIBILITY_FIX.md" move "IMAGE_COMPATIBILITY_FIX.md" "archive\"
if exist "IPHONE_IMAGE_FIX_HEIC.md" move "IPHONE_IMAGE_FIX_HEIC.md" "archive\"
if exist "NOTIFICATION_READ_TRACKING_FIX.md" move "NOTIFICATION_READ_TRACKING_FIX.md" "archive\"
if exist "PAYMENT_FINALIZATION_FIX.md" move "PAYMENT_FINALIZATION_FIX.md" "archive\"
if exist "PAYMENT_FLOW_QUICK_REF.md" move "PAYMENT_FLOW_QUICK_REF.md" "archive\"
if exist "PAYMENT_REDIRECT_FIX.md" move "PAYMENT_REDIRECT_FIX.md" "archive\"

REM Setup & Configuration Guides
if exist "ANDROID_SHA1_FINGERPRINTS.md" move "ANDROID_SHA1_FINGERPRINTS.md" "archive\"
if exist "DEPLOYMENT_TIMELINE.md" move "DEPLOYMENT_TIMELINE.md" "archive\"
if exist "EVENT_MAP_COORDINATES_GUIDE.md" move "EVENT_MAP_COORDINATES_GUIDE.md" "archive\"
if exist "EVENT_MAP_GUIDE.md" move "EVENT_MAP_GUIDE.md" "archive\"
if exist "EVENT_MERGE_DETECTION.md" move "EVENT_MERGE_DETECTION.md" "archive\"
if exist "GAME_LOCATION_GUIDE.md" move "GAME_LOCATION_GUIDE.md" "archive\"
if exist "GOOGLE_OAUTH_MOBILE_SETUP.md" move "GOOGLE_OAUTH_MOBILE_SETUP.md" "archive\"
if exist "GOOGLE_OAUTH_SETUP.md" move "GOOGLE_OAUTH_SETUP.md" "archive\"
if exist "INSTANT_MESSAGING_GUIDE.md" move "INSTANT_MESSAGING_GUIDE.md" "archive\"
if exist "PROMO_CODE_USAGE_LIMITS.md" move "PROMO_CODE_USAGE_LIMITS.md" "archive\"
if exist "QUICK_START_EVENT_MAP.md" move "QUICK_START_EVENT_MAP.md" "archive\"
if exist "SECURITY_CREDENTIALS_GUIDE.md" move "SECURITY_CREDENTIALS_GUIDE.md" "archive\"
if exist "TESTING_GUIDE.md" move "TESTING_GUIDE.md" "archive\"
if exist "TRANSACTION_LOGGING_GUIDE.md" move "TRANSACTION_LOGGING_GUIDE.md" "archive\"
if exist "USER_STORY_GAP_CHECKLIST.md" move "USER_STORY_GAP_CHECKLIST.md" "archive\"
if exist "ZIP_CODE_ALTERNATIVES.md" move "ZIP_CODE_ALTERNATIVES.md" "archive\"
if exist "ZIP_CODE_FALLBACK_SYSTEM.md" move "ZIP_CODE_FALLBACK_SYSTEM.md" "archive\"

REM Production Documentation (old versions)
if exist "PRODUCTION_DOCS_INDEX.md" move "PRODUCTION_DOCS_INDEX.md" "archive\"
if exist "PRODUCTION_REQUIREMENTS_CHECKLIST.md" move "PRODUCTION_REQUIREMENTS_CHECKLIST.md" "archive\"

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Old files moved to: docs\archive\
echo.
echo New consolidated documentation structure:
echo   README.md               - Documentation index
echo   01-SETUP.md            - Complete setup guide
echo   02-PROJECT-STRUCTURE.md - Folder organization
echo   03-ENVIRONMENT.md       - Environment configuration
echo   07-PRODUCTION.md        - Production deployment
echo   09-LEGAL.md             - Privacy ^& Terms
echo   11-TROUBLESHOOTING.md   - Common issues
echo   cleanup-docs.bat        - This cleanup script
echo   cleanup-docs-folder.bat - Archive old docs
echo.
echo Optional: Delete archive folder if not needed
echo   rmdir /s /q archive
echo.
pause
