# Email System Documentation

**Last Updated**: December 14, 2025  
**Status**: Phase 1 Ready for Implementation

---

## 📂 Structure

```
.docs/email-system/
├── README.md                           ← You are here
├── EMAIL_TEMPLATE_MATRIX.md            ← Status matrix (all templates)
├── EMAIL_TEMPLATES_STATUS.md           ← Visual dashboard
├── IMPLEMENTATION_SUMMARY_PHASE1.md    ← Technical analysis
├── INDEX_EMAIL_IMPLEMENTATION.md       ← Full navigation guide
│
├── phase1/                             ← Ready NOW
│   ├── EMAIL_TEMPLATES_PHASE1.md       ← Production HTML templates
│   └── EMAIL_PHASE1_QUICK_START.md     ← Implementation steps
│
└── phase2/                             ← Future enhancements
    └── EMAIL_TEMPLATES_PHASE2_VISION.md ← Roadmap & requirements
```

---

## 🚀 Quick Start

### For Implementation (Backend Engineers)
Start here → `phase1/EMAIL_PHASE1_QUICK_START.md`

### For Design Review
Start here → `phase1/EMAIL_TEMPLATES_PHASE1.md`

### For Status Overview
Start here → `EMAIL_TEMPLATES_STATUS.md`

### For Full Context
Start here → `INDEX_EMAIL_IMPLEMENTATION.md`

---

## 📧 What's In Phase 1

**Three production-ready email templates**:

1. **Join Request → Admin Notification**
   - Sent to org owner when coach requests to join
   - Contains: requester info, message, approve/deny buttons
   
2. **Join Request → Approved**
   - Sent to coach when request approved
   - Contains: success message, org dashboard link
   
3. **Join Request → Denied**
   - Sent to coach when request denied
   - Contains: optional reason, next steps

**Implementation time**: ~1-2 hours  
**Backend changes needed**: Un-stub 3 functions, add 3 template IDs to .env

---

## 🔮 What's In Phase 2

Enhanced features requiring backend schema changes:
- Team-level join requests
- Role selection in join flow
- Seat/billing tracking in emails
- Request expiration logic
- Email preference center

See `phase2/EMAIL_TEMPLATES_PHASE2_VISION.md` for details.

---

## 📊 Current Status

| Template | Status | Location |
|----------|--------|----------|
| Join Request → Admin | 🟡 Ready to ship | phase1/ |
| Join Request → Approved | 🟡 Ready to ship | phase1/ |
| Join Request → Denied | 🟡 Ready to ship | phase1/ |
| Enhanced features | 🔵 Future (Phase 2) | phase2/ |

---

## 🔗 Related Files

**Backend**:
- `server/src/lib/email.ts` - Email functions (need un-stubbing)
- `server/src/routes/organizations.ts` - Join request routes (already wired)
- `server/src/routes/test-emails.ts` - Test endpoints

**Docs**:
- `docs/SENDGRID_TEMPLATES.md` - SendGrid setup guide
- `.docs/architecture/ORGANIZATION_JOIN_SYSTEM.md` - Join flow architecture

---

**Next Action**: Create SendGrid templates from Phase 1 docs
