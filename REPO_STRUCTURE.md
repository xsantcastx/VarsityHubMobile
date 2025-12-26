# VarsityHub Mobile — Repository Structure

**Current State (December 25, 2025) — Phase 1 Complete**

## Phase 2 Kickoff (feature-first layout)
- New `src/features/profile/screens/` owns `ProfileScreen`, `EditProfileScreen`, and `StoryViewerScreen`; `app/profile.tsx`, `app/edit-profile.tsx`, and `app/story-viewer.tsx` now delegate to these feature modules.
- New `src/features/auth/screens/` owns `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, and `ResetScreen`; `app/sign-in.tsx`, `app/sign-up.tsx`, `app/forgot-password.tsx`, `app/reset-password.tsx`, and `app/reset.tsx` delegate to these modules.
- New `src/features/posts/screens/` owns `FeedScreen`, `PostDetailScreen`, and `CreatePostScreen`; `app/feed.tsx`, `app/post-detail.tsx`, and `app/create-post.tsx` delegate to these modules.
- Path aliases added for `@/features/*`, `@/shared/*`, and `@/* → src/*` across TypeScript, Babel, and Jest to support feature-first imports.
- `src/features/profile/index.ts` exports the profile screens for reuse; future features should follow the same pattern (`screens/`, `components/`, `hooks/`, `services/`, `types/`).
- `src/features/auth/index.ts` exports auth screens; future feature folders should mirror this export pattern.
- `src/features/posts/index.ts` exports posts screens.
- Next targets: migrate auth/events/teams flows into `src/features`, and move shared UI/hook/utilities into `src/shared`.

```
VarsityHubMobile/
│
├── 📋 DOCUMENTATION_INDEX.md          ← Main entry point for all docs
├── 📋 STYLE.md                        ← Code conventions & naming patterns
├── 📋 REPO_STRUCTURE.md               ← This file
├── 📋 README.md                       ← Project overview
│
├── 🔧 Configuration Files (Root Only)
│   ├── package.json                   ← Dependencies & npm scripts
│   ├── tsconfig.json                  ← TypeScript config
│   ├── app.json                       ← Expo app manifest
│   ├── babel.config.js                ← Babel transpilation
│   ├── metro.config.js                ← Metro bundler config
│   ├── jest.config.js                 ← Jest testing config
│   ├── eslint.config.js               ← ESLint rules
│   ├── eas.json                       ← EAS Build config
│   ├── playwright.config.ts           ← E2E testing config
│   ├── .gitignore                     ← Git ignore rules
│   └── webpack.config.js              ← Webpack (if used)
│
├── .docs/                             ← ALL DOCUMENTATION (100+ files)
│   ├── guides/                        ← How-to & setup guides
│   │   ├── QUICK_START.md
│   │   ├── EXTENSIONS_QUICK_START.md
│   │   ├── SNYK_SETUP_GUIDE.md
│   │   ├── SECURITY_GOVERNANCE.md
│   │   ├── IMPLEMENTATION_GUIDE.md
│   │   ├── DOCKER_DEPLOYMENT.md
│   │   ├── DEBUGGING_AND_MONITORING_QUICKSTART.md
│   │   └── ... (8 more guides)
│   │
│   ├── launch/                        ← Release & production
│   │   ├── DAY_4_RELEASE_GUIDE.md
│   │   ├── LAUNCH_GUIDE.md
│   │   ├── LAUNCH_DASHBOARD.md
│   │   ├── PRODUCTION_GRADE_A.md
│   │   ├── PRODUCTION_READINESS.md
│   │   ├── PRE_QA_PRODUCTION_READINESS_AUDIT.md
│   │   └── ... (5 more launch docs)
│   │
│   ├── checklists/                    ← Verification lists
│   │   ├── DAY_3_QA_CHECKLIST.md
│   │   ├── LAUNCH_CHECKLIST.md
│   │   ├── SETUP_CHECKLIST.md
│   │   ├── MORNING_REVIEW_CHECKLIST.md
│   │   ├── LOCATION_CHECKLIST.md
│   │   └── ... (8 more checklists)
│   │
│   ├── plans/                         ← Strategic plans & timelines
│   │   ├── MASTER_LAUNCH_ACTION_PLAN.md
│   │   ├── PUBLISHING_TIMELINE.md
│   │   ├── AUTH_ROLES_TEST_PLAN.md
│   │   ├── ANDROID_OVERNIGHT_TESTING_PLAN.md
│   │   └── ... (4 more plans)
│   │
│   ├── qa/                            ← Quality assurance & testing
│   │   ├── CRITICAL_FLOWS_TEST.md
│   │   ├── EMAIL_SMS_VERIFICATION_AUDIT.md
│   │   ├── QA_LIVE_MONITORING_DASHBOARD.md
│   │   └── QA_QUICK_COMMANDS.md
│   │
│   ├── security/                      ← Security & compliance
│   │   ├── SNYK_REMEDIATION_GUIDE.md
│   │   ├── SNYK_SETUP_COMPLETE.md
│   │   ├── HARDENING_COMPLETE.md
│   │   ├── PRIVACY_POLICY.md
│   │   ├── TERMS_OF_SERVICE.md
│   │   └── ... (6 more security docs)
│   │
│   ├── email-system/                  ← Email templates & config
│   │   ├── COMPLETE_VARIABLE_REFERENCE.md
│   │   ├── EMAIL_TEMPLATE_AUDIT.md
│   │   ├── EMAIL_TEMPLATES_STATUS.md
│   │   ├── EMAIL_TEMPLATE_MATRIX.md
│   │   ├── phase1/
│   │   ├── phase2/
│   │   └── ... (9 more email docs)
│   │
│   ├── architecture/                  ← System design & implementation
│   │   ├── AUTH_FLOW_UNIFIED.md
│   │   ├── AUTH_ROLES_EXECUTION_LOG.md
│   │   ├── ACCOUNT_PERMISSIONS_IMPLEMENTATION.md
│   │   ├── BACKEND_LOCATION_INTEGRATION.md
│   │   ├── EMAIL_SMS_IMPLEMENTATION_COMPLETE.md
│   │   ├── LOCATION_SYSTEM_INTEGRATION.md
│   │   ├── PAYMENT_SECURITY_VERIFICATION.md
│   │   └── ... (11 more architecture docs)
│   │
│   ├── automation/                    ← CI/CD & automated testing
│   │   ├── OVERNIGHT_AUTOMATION.md
│   │   ├── OVERNIGHT_AUTOMATION_ARCHITECTURE.md
│   │   ├── NIGHTLY_AUTOMATION_SUITE_READY.md
│   │   └── OVERNIGHT_QUICKSTART.md
│   │
│   ├── archive/                       ← Dated & historical reports
│   │   ├── reports/
│   │   └── ... (100+ old files)
│   │
│   ├── reports/                       ← Quality & audit reports
│   │   └── (empty - for new reports)
│   │
│   └── ... (miscellaneous standalone docs migrated from root)
│
├── logs/                              ← Build logs & output files
│   ├── metro-fix.log
│   ├── eas-build.log
│   ├── eas-build-output.txt
│   ├── lint-output.txt
│   ├── typecheck-output.txt
│   ├── build-output.log
│   ├── SENDGRID_VERIFICATION_SUMMARY.txt
│   └── ... (80 log files total)
│
├── artifacts/                         ← Build artifacts & binaries
│   └── build-1765427087772.ipa        ← iOS build artifact
│
├── 🎯 Source Code
│   ├── app/                           ← React Native screens & navigation (Expo Router)
│   │   ├── (auth)/
│   │   │   ├── login.tsx
│   │   │   ├── signup.tsx
│   │   │   ├── forgot-password.tsx
│   │   │   └── verify-email.tsx
│   │   │
│   │   ├── (main)/
│   │   │   ├── _layout.tsx            ← Tab navigation layout
│   │   │   ├── profile.tsx            ← Profile screen (updated: Twitter-style)
│   │   │   ├── events.tsx
│   │   │   ├── teams.tsx
│   │   │   ├── discover.tsx
│   │   │   └── messages.tsx
│   │   │
│   │   ├── event-details.tsx
│   │   ├── team-profile.tsx
│   │   ├── edit-profile.tsx           ← Profile editor (fixed: teamId redirect)
│   │   ├── organization.tsx
│   │   ├── story-viewer.tsx           ← Story viewer (new)
│   │   ├── _layout.tsx                ← Root navigation layout
│   │   ├── +html.tsx
│   │   └── App.tsx                    ← App entry point
│   │
│   ├── components/                    ← Shared UI components
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   ├── HelloWave.tsx
│   │   ├── ParallaxScrollView.tsx
│   │   ├── TextField.tsx
│   │   ├── ThemedText.tsx
│   │   ├── ThemedView.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── StoryRing.tsx              ← Story indicator ring (new)
│   │   ├── RoleBadge.tsx              ← Role badge component (new)
│   │   ├── tabs/
│   │   │   ├── ProfileTabs.tsx        ← Simplified tabs (new)
│   │   │   └── TabBar.tsx
│   │   │
│   │   ├── layouts/
│   │   │   └── (layout components)
│   │   │
│   │   ├── ui/                        ← Design system primitives
│   │   │   ├── Text.tsx
│   │   │   ├── View.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── ... (design system tokens)
│   │   │
│   │   └── modals/
│   │       ├── ImagePickerModal.tsx
│   │       └── SettingsModal.tsx
│   │
│   ├── api/                           ← API clients & services
│   │   ├── client.ts                  ← HTTP client (Axios)
│   │   ├── userApi.ts
│   │   ├── eventApi.ts
│   │   ├── teamApi.ts
│   │   ├── postApi.ts
│   │   ├── authApi.ts
│   │   └── entities/
│   │       ├── User.ts
│   │       ├── Event.ts
│   │       ├── Team.ts
│   │       └── Post.ts
│   │
│   ├── hooks/                         ← Custom React hooks
│   │   ├── useAuth.ts                 ← Auth context hook
│   │   ├── useNavigation.ts
│   │   ├── useApiFetch.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useTheme.ts
│   │   ├── useLocation.ts
│   │   └── ... (10+ hooks)
│   │
│   ├── context/                       ← React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   ├── UserContext.tsx
│   │   └── LocationContext.tsx
│   │
│   ├── utils/                         ← Utility functions
│   │   ├── formatDate.ts
│   │   ├── formatCurrency.ts
│   │   ├── validators.ts
│   │   ├── parsing.ts
│   │   ├── storage.ts
│   │   └── logging.ts
│   │
│   ├── constants/                     ← App constants
│   │   ├── API_BASE_URL.ts
│   │   ├── API_ENDPOINTS.ts
│   │   ├── theme.ts                   ← Colors, spacing, typography
│   │   ├── APP_VERSION.ts
│   │   └── PERMISSIONS.ts
│   │
│   ├── types/                         ← Global TypeScript types
│   │   ├── index.ts
│   │   ├── user.types.ts
│   │   ├── event.types.ts
│   │   ├── team.types.ts
│   │   └── common.types.ts
│   │
│   ├── config/                        ← App configuration
│   │   ├── appConfig.ts
│   │   ├── apiConfig.ts
│   │   └── featureFlags.ts
│   │
│   └── __tests__/                     ← Project-level tests
│       ├── hooks/
│       │   ├── useAuth.test.ts
│       │   └── useApiFetch.test.ts
│       │
│       ├── utils/
│       │   ├── formatDate.test.ts
│       │   └── validators.test.ts
│       │
│       ├── api/
│       │   └── client.test.ts
│       │
│       ├── integration/
│       │   └── auth-flow.integration.test.ts
│       │
│       └── e2e/
│           └── profile.e2e.test.ts
│
├── assets/                            ← Images, fonts, icons
│   ├── images/
│   │   ├── logo.png
│   │   ├── splash-screen.png
│   │   └── ...
│   │
│   ├── fonts/
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-Bold.ttf
│   │   └── ...
│   │
│   └── icons/
│       ├── home.svg
│       ├── profile.svg
│       └── ...
│
├── .github/                           ← GitHub Actions & templates
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy.yml
│   │   └── test.yml
│   │
│   ├── instructions/
│   │   ├── snyk_rules.instructions.md ← Security at inception
│   │   └── ...
│   │
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── node_modules/                      ← Dependencies (auto-generated)
├── dist/                              ← Compiled output (auto-generated)
├── web-build/                         ← Web build output (auto-generated)
│
└── .expo/                             ← Expo CLI metadata (auto-generated)
```

---

## Quick Stats

| Category | Count | Status |
|----------|-------|--------|
| **Screens** | 12+ | ✅ Active |
| **Components** | 20+ | ✅ Shared library |
| **Custom Hooks** | 10+ | ✅ Reusable |
| **API Endpoints** | 5+ | ✅ Organized |
| **Documentation Files** | 100+ | ✅ Organized in `.docs/` |
| **Build Logs/Artifacts** | 80+ | ✅ In `logs/` & `artifacts/` |
| **Root Config Files** | 13 | ✅ Minimal, essential only |
| **Lines of Code** | ~10k | 📊 (TypeScript + React) |

---

## Key Directories Explained

### `/app` — Screens & Navigation
- **Purpose:** Expo Router screens that users interact with
- **Pattern:** Each route is a file or folder with layout
- **Naming:** Use `.tsx` extension, PascalCase for screens
- **Note:** `(main)` groups screens into a tab-based layout

### `/components` — Reusable UI
- **Purpose:** Shared components used across multiple screens
- **Pattern:** One component = one file
- **Types:**
  - Functional components (buttons, inputs, cards)
  - Layout components (sidebars, headers)
  - UI primitives in `components/ui/`

### `/api` — Backend Communication
- **Purpose:** HTTP clients and API service methods
- **Pattern:** One entity = one API file (`userApi.ts`, `eventApi.ts`)
- **Exports:** Namespaced functions (`userApi.getProfile()`)

### `/hooks` — Custom React Hooks
- **Purpose:** Reusable logic extracted from components
- **Pattern:** Start with `use` prefix
- **Exports:** Named exports, can be multiple hooks per file

### `/context` — State Management
- **Purpose:** React Context providers for global state
- **Pattern:** Context creation + Provider component
- **Use Cases:** Auth, theme, user preferences, notifications

### `/utils` — Helper Functions
- **Purpose:** Pure functions with no side effects
- **Pattern:** Organized by concern (format, parse, validate)
- **Examples:** `formatDate()`, `parseUrl()`, `validateEmail()`

### `/types` — TypeScript Definitions
- **Purpose:** Shared type interfaces and enums
- **Pattern:** One file per entity or grouped by concern
- **Naming:** Use `.types.ts` suffix or `index.ts`

### `.docs/` — Documentation
- **Purpose:** All project knowledge (guides, plans, reports)
- **Organized By:** Category (guides, launch, security, qa, etc.)
- **Entry Point:** `DOCUMENTATION_INDEX.md` (at root)

### `logs/` — Build Outputs
- **Purpose:** Build logs, test results, verification output
- **Contents:** All `.log`, `.txt`, `*output*` files
- **Policy:** Ignored by Git, local-only

### `artifacts/` — Build Artifacts
- **Purpose:** IPA, APK, binaries, compiled outputs
- **Contents:** Build products (`.ipa`, `.apk`)
- **Policy:** Ignored by Git, local-only

---

## Phase 2 Future State (Post-Submission)

Once code is refactored to feature-first structure:

```
src/
├── features/
│   ├── auth/              ← Auth feature module
│   ├── profile/           ← Profile feature module
│   ├── teams/             ← Teams feature module
│   ├── events/            ← Events feature module
│   ├── posts/             ← Posts/feed feature module
│   └── discover/          ← Discovery feature module
│
├── shared/
│   ├── components/        ← Reusable across features
│   ├── ui/                ← Design system
│   ├── hooks/             ← Shared hooks
│   ├── utils/             ← Utility functions
│   ├── constants/         ← Constants
│   └── types/             ← Global types
│
├── app/                   ← Navigation & entry points
├── assets/                ← Media & fonts
├── config/                ← Configuration
└── __tests__/             ← Project-level tests
```

---

## How to Navigate

1. **Starting development?** Read `.docs/guides/QUICK_START.md`
2. **Adding a feature?** Follow patterns in `STYLE.md` → Create in feature folder → Write tests
3. **Deploying?** Check `.docs/launch/DAY_4_RELEASE_GUIDE.md`
4. **Debugging?** See `.docs/guides/DEBUGGING_AND_MONITORING_QUICKSTART.md`
5. **Security?** Review `.docs/security/SNYK_REMEDIATION_GUIDE.md`

---

## Last Updated
- **Date:** December 25, 2025
- **Version:** 2.0 (Phase 1 Complete)
- **Status:** ✅ Documentation consolidated, code structure documented
- **Next:** Phase 2 feature-first refactor (post-submission)
