@echo off
REM VarsityHub Documentation Cleanup Script
REM Moves old root-level .md files to docs/archive/

echo ========================================
echo VarsityHub Documentation Cleanup
echo ========================================
echo.

echo Creating archive folder...
if not exist "docs\archive" mkdir "docs\archive"

echo.
echo Moving root-level documentation files to archive...

REM Production & Launch Docs
if exist "PRODUCTION_STATUS.md" move "PRODUCTION_STATUS.md" "docs\archive\"
if exist "PRODUCTION_LAUNCH_CHECKLIST.md" move "PRODUCTION_LAUNCH_CHECKLIST.md" "docs\archive\"
if exist "LAUNCH_GUIDE.md" move "LAUNCH_GUIDE.md" "docs\archive\"

REM Architecture & Design Docs
if exist "ARCHITECTURE_OPTIMIZATION_REPORT.md" move "ARCHITECTURE_OPTIMIZATION_REPORT.md" "docs\archive\"
if exist "ARCHITECTURE_REVIEW.md" move "ARCHITECTURE_REVIEW.md" "docs\archive\"
if exist "BOOMER_FRIENDLY_DESIGN.md" move "BOOMER_FRIENDLY_DESIGN.md" "docs\archive\"

REM Guide Docs
if exist "COACH_QUICK_REF.md" move "COACH_QUICK_REF.md" "docs\archive\"
if exist "COACH_SIMPLIFICATION.md" move "COACH_SIMPLIFICATION.md" "docs\archive\"
if exist "COMPONENT_LIBRARY_GUIDE.md" move "COMPONENT_LIBRARY_GUIDE.md" "docs\archive\"
if exist "THEME_SYSTEM_GUIDE.md" move "THEME_SYSTEM_GUIDE.md" "docs\archive\"

REM Status & Progress Docs
if exist "FINAL_IMPLEMENTATION_STATUS.md" move "FINAL_IMPLEMENTATION_STATUS.md" "docs\archive\"
if exist "PHASE1_COMPLETION.md" move "PHASE1_COMPLETION.md" "docs\archive\"
if exist "PHASE1_PROGRESS.md" move "PHASE1_PROGRESS.md" "docs\archive\"
if exist "QUICK_REFERENCE_COMPLIANCE.md" move "QUICK_REFERENCE_COMPLIANCE.md" "docs\archive\"
if exist "SCREEN_AUDIT_CHECKLIST.md" move "SCREEN_AUDIT_CHECKLIST.md" "docs\archive\"

REM Bug Fix Docs
if exist "GAME_DETAILS_DARK_MODE_FIX.md" move "GAME_DETAILS_DARK_MODE_FIX.md" "docs\archive\"
if exist "PAYMENT_AND_SETTINGS_FIXES.md" move "PAYMENT_AND_SETTINGS_FIXES.md" "docs\archive\"

REM Git Summary
if exist "GIT_COMMIT_SUMMARY.md" move "GIT_COMMIT_SUMMARY.md" "docs\archive\"

REM Legal docs (keep these, just inform user)
echo.
echo NOTE: PRIVACY_POLICY.md and TERMS_OF_SERVICE.md are kept in root.
echo (Required for app store submissions and may need to be public)

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Files moved to: docs\archive\
echo.
echo New documentation structure:
echo   docs\README.md               - Main index
echo   docs\01-SETUP.md            - Setup guide
echo   docs\02-PROJECT-STRUCTURE.md - Folder organization
echo   docs\03-ENVIRONMENT.md       - Environment variables
echo   docs\04-DEVELOPMENT.md       - Development workflow
echo   docs\05-FEATURES.md          - Feature documentation
echo   docs\06-API.md              - API reference
echo   docs\07-PRODUCTION.md        - Production deployment
echo   docs\08-BACKEND.md           - Backend setup
echo   docs\09-LEGAL.md             - Privacy ^& Terms
echo   docs\11-TROUBLESHOOTING.md   - Common issues
echo.
echo Next steps:
echo   1. Review archived files in docs\archive\
echo   2. Delete archive folder if not needed
echo   3. Commit changes: git add -A ^&^& git commit -m "Clean up documentation"
echo.
pause
