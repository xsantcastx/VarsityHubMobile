# VarsityHub Mobile - Repository Structure

This document explains the organized structure of the VarsityHub Mobile repository.

## 📁 Directory Overview

### Root Level (Production Code)
```
VarsityHubMobile/
├── src/                    # Main React Native source code
├── components/             # Reusable UI components
├── screens/                # Screen components (if organized)
├── hooks/                  # Custom React hooks
├── context/                # Context API for state management
├── utils/                  # Utility functions
├── constants/              # App constants and config
├── assets/                 # Images, fonts, icons
├── locales/                # i18n translations
├── app/                    # Expo app entry point
├── android/                # Android native code
├── ios/                    # iOS native code
├── api/                    # API client code
├── server/                 # Backend server code (if included)
├── scripts/                # Build and automation scripts
└── tools/                  # Development tools
```

### Documentation (`.docs/`)
Organized by purpose and workflow:

```
.docs/
├── guides/                 # Setup and implementation guides
│   ├── IMPLEMENTATION_GUIDE.md
│   ├── DEVELOPER_TOOLKIT_QUICKREF.md
│   ├── DEBUGGING_AND_MONITORING_QUICKSTART.md
│   ├── SNYK_SETUP_GUIDE.md
│   ├── DOCKER_DEPLOYMENT.md
│   └── VSCODE_EXTENSIONS_SETUP.md
│
├── checklists/             # QA and verification checklists
│   ├── DAY_3_QA_CHECKLIST.md
│   ├── SETUP_CHECKLIST.md
│   ├── PRODUCTION_LAUNCH_CHECKLIST.md
│   ├── READINESS_CHECKLIST.md
│   └── MORNING_REVIEW_CHECKLIST.md
│
├── plans/                  # Project plans and roadmaps
│   ├── MASTER_LAUNCH_ACTION_PLAN.md
│   ├── CATCH_BLOCK_CLEANUP_ROADMAP.md
│   ├── WEEK_1_PROGRESS.md
│   └── VERIFICATION_PLAN_EXECUTION.md
│
├── architecture/           # System design and implementation
│   ├── AUTH_FLOW_UNIFIED.md
│   ├── BACKEND_LOCATION_INTEGRATION.md
│   ├── LOCATION_SYSTEM_INTEGRATION.md
│   ├── ORGANIZATION_JOIN_SYSTEM.md
│   ├── EMAIL_SMS_IMPLEMENTATION_COMPLETE.md
│   ├── PAYMENT_SECURITY_VERIFICATION.md
│   └── VETERAN_BILLING_IMPLEMENTATION.md
│
├── security/               # Security and compliance docs
│   ├── MOBILE_SECURITY_HARDENING.md
│   ├── SECURITY_GOVERNANCE.md
│   ├── SNYK_REMEDIATION_GUIDE.md
│   ├── PRIVACY_POLICY.md
│   └── TERMS_OF_SERVICE.md
│
├── qa/                     # QA procedures and monitoring
│   ├── DAY_3_QA_EXECUTION.md
│   ├── QA_QUICK_COMMANDS.md
│   ├── QA_LIVE_MONITORING_DASHBOARD.md
│   └── CRITICAL_FLOWS_TEST.md
│
├── launch/                 # Launch procedures and timeline
│   ├── LAUNCH_DASHBOARD.md
│   ├── LAUNCH_GUIDE.md
│   ├── DAY_4_RELEASE_GUIDE.md
│   └── PRE_QA_PRODUCTION_READINESS_AUDIT.md
│
└── automation/             # Overnight automation scripts and guides
    ├── OVERNIGHT_AUTOMATION.md
    ├── OVERNIGHT_AUTOMATION_ARCHITECTURE.md
    ├── NIGHTLY_AUTOMATION_GUIDE.md
    └── OVERNIGHT_QUICKSTART.md
```

### Logs and Cache (`.logs/` and `.cache/`)
```
.logs/
├── overnight/              # Overnight automation run logs
│   ├── overnight-results.txt
│   ├── overnight-lint.log
│   └── overnight-security-audit.log
│
.cache/
└── expo/                   # Expo cache files
```

### Configuration Files (Root)
```
.env                        # Environment variables (git ignored)
.env.example                # Example environment template
.gitignore                  # Git ignore rules
.railwayignore              # Railway deployment ignores
eslint.config.js            # ESLint configuration
tsconfig.json               # TypeScript configuration
babel.config.js             # Babel configuration
metro.config.js             # Metro bundler configuration
app.json                    # Expo app configuration
eas.json                    # EAS build configuration
```

### GitHub Configuration (`.github/`)
```
.github/
├── workflows/              # GitHub Actions CI/CD workflows
│   └── snyk-security.yml
│
└── instructions/           # Special instructions for automated tools
    └── snyk_rules.instructions.md
```

## 🎯 How to Navigate

### For Development
- **Start here:** `.docs/guides/IMPLEMENTATION_GUIDE.md`
- **Quick setup:** `.docs/guides/DEVELOPER_TOOLKIT_QUICKREF.md`
- **Debugging:** `.docs/guides/DEBUGGING_AND_MONITORING_QUICKSTART.md`

### For QA and Testing
- **QA checklist:** `.docs/checklists/DAY_3_QA_CHECKLIST.md`
- **API commands:** `.docs/qa/QA_QUICK_COMMANDS.md`
- **Live monitoring:** `.docs/qa/QA_LIVE_MONITORING_DASHBOARD.md`

### For Security
- **Security hardening:** `.docs/security/MOBILE_SECURITY_HARDENING.md`
- **Snyk setup:** `.docs/security/SNYK_SETUP_GUIDE.md`
- **Privacy/Legal:** `.docs/security/PRIVACY_POLICY.md`

### For Launch
- **Launch procedures:** `.docs/launch/LAUNCH_GUIDE.md`
- **Pre-launch audit:** `.docs/launch/PRE_QA_PRODUCTION_READINESS_AUDIT.md`
- **Day 4 release:** `.docs/launch/DAY_4_RELEASE_GUIDE.md`

### For Automation
- **Overnight automation:** `.docs/automation/OVERNIGHT_AUTOMATION.md`
- **Setup automation:** `.docs/automation/OVERNIGHT_QUICKSTART.md`

## 📊 Document Organization Rules

| Pattern | Location | Purpose |
|---------|----------|---------|
| `*_GUIDE.md` | `guides/` | Implementation guides and tutorials |
| `*_CHECKLIST.md` | `checklists/` | Verification and testing checklists |
| `*_PLAN.md` | `plans/` | Project plans and roadmaps |
| `*_IMPLEMENTATION.md` | `architecture/` | Feature implementation docs |
| `*_SECURITY.md` | `security/` | Security-related documentation |
| `*_VERIFICATION.md` | `checklists/` | Verification and audit docs |
| `QA_*.md` | `qa/` | QA and testing procedures |
| `DAY_*.md` | Root `.docs/` | Daily progress (can be archived later) |
| `LAUNCH_*.md` | `launch/` | Launch procedures |
| `OVERNIGHT_*.md` | `automation/` | Overnight automation docs |

## 🧹 Housekeeping

### Daily Logs
Production logs are stored in:
- `.logs/overnight/` - Overnight automation results
- `.cache/expo/` - Expo temporary files (can be safely deleted)

### Cleanup
When starting fresh or before major milestones:
```bash
# Safe to delete (regeneratable)
rm -rf .cache/
rm -rf node_modules/
rm -rf .expo/

# Archive old daily logs
mv .logs/overnight .logs/overnight-archive-DATE

# Keep important docs in .docs/
```

## 🎓 Entry Points by Role

### **Backend Developer**
1. `.docs/architecture/` - Understand system design
2. `.docs/guides/IMPLEMENTATION_GUIDE.md` - Setup
3. `api/` - API client code

### **Mobile Developer**
1. `.docs/guides/DEVELOPER_TOOLKIT_QUICKREF.md` - Quick start
2. `.docs/architecture/` - Feature architectures
3. `src/` and `components/` - Main code

### **QA Engineer**
1. `.docs/checklists/DAY_3_QA_CHECKLIST.md` - QA steps
2. `.docs/qa/QA_QUICK_COMMANDS.md` - Testing commands
3. `.docs/qa/QA_LIVE_MONITORING_DASHBOARD.md` - Monitoring

### **DevOps/Infrastructure**
1. `.docs/guides/DOCKER_DEPLOYMENT.md` - Deployment
2. `.docs/security/SNYK_SETUP_GUIDE.md` - Security scanning
3. `.github/workflows/` - CI/CD pipelines

### **Product Manager**
1. `.docs/launch/LAUNCH_GUIDE.md` - Launch timeline
2. `.docs/plans/MASTER_LAUNCH_ACTION_PLAN.md` - Project plan
3. `.docs/security/PRIVACY_POLICY.md` - Legal docs

## 📈 Update Frequency

| Folder | Update Frequency | Purpose |
|--------|------------------|---------|
| `.docs/guides/` | Rarely | Long-term reference |
| `.docs/checklists/` | Per release | Operational procedures |
| `.docs/plans/` | Weekly | Project tracking |
| `.docs/architecture/` | As needed | Design updates |
| `.docs/security/` | Monthly | Compliance updates |
| `.logs/` | Daily | Temporary results |

## ✅ Benefits of This Organization

✅ **Easy Navigation** - Find docs by purpose, not filename
✅ **Clear Hierarchy** - Understand which docs relate to each other
✅ **Scalable** - Easy to add new categories as project grows
✅ **Role-Based** - Each person knows where to look
✅ **Professional** - Clean, organized repository
✅ **Maintainable** - Easy to archive and clean up old docs

---

**Last Updated:** Dec 5, 2025
**Structure Version:** 1.0
**Total Files Organized:** 90+ markdown documents
