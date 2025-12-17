# Report Resolution Email Data – Phase 1

**Status:** Current backend capabilities  
**Last Updated:** December 14, 2025  
**Queue Job Type:** `reports.resolved`

---

## Overview

Sent when an abuse/safety report is reviewed and a resolution decision is made. The same template handles both **resolved** and **dismissed** statuses with conditional logic.

---

## Available Data

| Field | Type | Backend Variable | Example | Notes |
|-------|------|------------------|---------|-------|
| `to` | email | jobData.to | reporter@school.edu | Reporter's email address |
| `user_name` | string | jobData.user_name | "John Smith" | Reporter's name |
| `report_id` | string | jobData.report_id | "rpt_abc123xyz" | Unique report identifier |
| `report_type` | string | jobData.report_type | "inappropriate_content" | Type of report submitted |
| `resolution_status` | enum | jobData.resolution_status | "resolved" \| "dismissed" | **DYNAMIC** - determines message tone |
| `resolution_reason` | string | jobData.resolution_reason | "Content violates community standards" | Explanation of decision |
| `submit_date` | string | jobData.submit_date | "Dec 10, 2025" | Date report was submitted |
| `resolution_date` | string | jobData.resolution_date | "Dec 14, 2025" | Date resolution was determined |
| `appeal_url` | URL | jobData.appeal_url | `https://varsityhub.app/reports/rpt_abc123xyz/appeal` | Link to file appeal |
| `report_detail_link` | URL | jobData.report_detail_link | `https://varsityhub.app/reports/rpt_abc123xyz` | Link to view full report details |

### Important: Phase 1 Limitation
- ❌ **NO** `action_summary` or `admin_notes` from backend
- ❌ **NO** `admin_name` or admin contact info
- Use `resolution_reason` for all explanation text

---

## Dynamic States

### State 1: RESOLVED ✅

**When:** `resolution_status === 'resolved'`

**Example Payload:**
```javascript
{
  to: "reporter@school.edu",
  user_name: "John Smith",
  report_id: "rpt_abc123xyz",
  report_type: "inappropriate_content",
  resolution_status: "resolved",
  resolution_reason: "Thank you for reporting this content. Our team reviewed the post and found it violates our community standards. We have removed the content and taken appropriate action.",
  submit_date: "Dec 10, 2025",
  resolution_date: "Dec 14, 2025",
  appeal_url: "https://varsityhub.app/reports/rpt_abc123xyz/appeal",
  report_detail_link: "https://varsityhub.app/reports/rpt_abc123xyz"
}
```

**Message Tone:**
- ✅ Appreciation for reporting
- Action was taken
- Content/user was addressed
- Option to appeal if disagree

**Template Variables to Display:**
- Green checkmark ✅ icon
- "Your report has been resolved"
- {{user_name}} greeting
- {{resolution_reason}} (full explanation)
- **Links:** "View Full Details" → {{report_detail_link}}, "Appeal Decision" → {{appeal_url}}

---

### State 2: DISMISSED ❌

**When:** `resolution_status === 'dismissed'`

**Example Payload:**
```javascript
{
  to: "reporter@school.edu",
  user_name: "John Smith",
  report_id: "rpt_abc123xyz",
  report_type: "inappropriate_content",
  resolution_status: "dismissed",
  resolution_reason: "We reviewed this content and determined it does not violate our community standards. It remains available on the platform.",
  submit_date: "Dec 10, 2025",
  resolution_date: "Dec 14, 2025",
  appeal_url: "https://varsityhub.app/reports/rpt_abc123xyz/appeal",
  report_detail_link: "https://varsityhub.app/reports/rpt_abc123xyz"
}
```

**Message Tone:**
- Thank you for report (but context is different)
- Content did not violate standards
- It remains available
- Strong emphasis on appeal option

**Template Variables to Display:**
- Different icon (⚠️ or neutral info icon)
- "Your report has been reviewed"
- {{user_name}} greeting
- {{resolution_reason}} (explaining why dismissed)
- **Links:** "View Full Details" → {{report_detail_link}}, "Appeal Decision" → {{appeal_url}}

---

## Report Details Section

Both states should include a **REPORT DETAILS** box showing:

| Label | Variable |
|-------|----------|
| Report ID: | {{report_id}} |
| Report Type: | {{report_type}} |
| Submitted: | {{submit_date}} |
| Resolved: | {{resolution_date}} |
| Status: | {{resolution_status}} (displays as "Resolved" or "Dismissed") |

---

## Layout Recommendations

```
Header: VH Logo
Greeting: Hi {{user_name}},

[CONDITIONAL ICON]
Heading: "Your report has been [resolved/reviewed]"

Body copy explaining {{resolution_reason}}

REPORT DETAILS BOX
├─ Report ID: {{report_id}}
├─ Report Type: {{report_type}}
├─ Submitted: {{submit_date}}
└─ Status: {{resolution_status}}

[Two CTAs]
├─ "View Full Details" → {{report_detail_link}}
└─ "Appeal Decision" → {{appeal_url}}

Footer: Contact / Social / Copyright
```

---

## Phase 2 Enhancements (Future)

- ❌ Evidence/screenshots attachment
- ❌ History of reporter's previous reports
- ❌ Escalation workflow for appeals
- ❌ Admin name/contact who reviewed
- ❌ Customized templates per report type
- ❌ Automatic appeal deadline notification

---

## ⚠️ Important: Backend Variable Names

**Figma mentioned these names, but backend sends:**

| Figma Name | Backend Name | Actual Value |
|------------|--------------|--------------|
| reporter_name | `user_name` | Reporter's display name |
| reported_content_type | `report_type` | Type of report (e.g., "inappropriate_content") |
| action_summary | `resolution_reason` | Full explanation of decision |
| admin_notes | ❌ NOT SENT | Use `resolution_reason` instead |

**Phase 1 does NOT include:**
- Admin name or signature
- Separate action summary field
- Admin notes/private comments
- Content preview or screenshots

---

## Implementation Notes

**Key Points for Design:**
1. **One template, two states** - Use `resolution_status` to control conditional visibility
   - Show "resolved" tone/icon/copy when `status === 'resolved'`
   - Show "dismissed" tone/icon/copy when `status === 'dismissed'`
2. **Both links are required** - Don't hide `appeal_url` or `report_detail_link` (backend always sends them)
3. **Status field must be dynamic** - Don't hardcode "Resolved" (can be "Dismissed")
4. **Resolution reason is always present** - It explains the decision for both states

**When to Trigger (Backend):**
- Sent via emailQueue when admin marks a report as resolved/dismissed
- Automatic, no manual intervention needed

**Test Data:**
```javascript
// RESOLVED example
{
  to: "test@example.com",
  user_name: "Test Reporter",
  report_id: "rpt_test_resolved_123",
  report_type: "inappropriate_content",
  resolution_status: "resolved",
  resolution_reason: "Thank you for reporting. We reviewed this content and it violates our community standards. Action has been taken.",
  submit_date: "Dec 12, 2025",
  resolution_date: "Dec 14, 2025",
  appeal_url: "https://varsityhub.app/reports/rpt_test_resolved_123/appeal",
  report_detail_link: "https://varsityhub.app/reports/rpt_test_resolved_123"
}

// DISMISSED example
{
  to: "test@example.com",
  user_name: "Test Reporter",
  report_id: "rpt_test_dismissed_456",
  report_type: "user_harassment",
  resolution_status: "dismissed",
  resolution_reason: "We reviewed this report and determined the content does not violate our community standards. If you believe this decision is incorrect, you may appeal.",
  submit_date: "Dec 10, 2025",
  resolution_date: "Dec 14, 2025",
  appeal_url: "https://varsityhub.app/reports/rpt_test_dismissed_456/appeal",
  report_detail_link: "https://varsityhub.app/reports/rpt_test_dismissed_456"
}
```

---

## Next Steps

1. ✅ Design updates mock with dynamic status field (resolved/dismissed)
2. ✅ Add both action links (View Full Details, Appeal Decision)
3. ✅ Create conditional copy/icon logic for the two states
4. 🔜 Backend: Un-stub `sendReportResolutionEmail()` in email.ts
5. 🔜 Add template IDs to server/.env (SENDGRID_REPORT_RESOLVED_TEMPLATE_ID, etc.)
6. 🔜 Test via emailWorker with both state scenarios
