# 📧 VarsityHub Email Template Variables - Complete Reference

**Generated:** December 16, 2025  
**Total Templates:** 28  
**Total Unique Variables:** ~120  
**Naming Convention:** `snake_case` (EXCEPT 3 legacy templates using `UPPER_CASE`)

---

## ⚠️ CRITICAL: Two Naming Formats Currently in Use

### **Format 1: snake_case** ✅ (STANDARD - Use for all new templates)
```handlebars
{{user_name}}
{{team_name}}
{{event_date}}
```

### **Format 2: UPPER_CASE** ⚠️ (LEGACY - Only 3 templates)
```handlebars
{{USERNAME}}
{{RESET_LINK}}
{{CHANGE_DATE}}
```
**Note:** Legacy format used ONLY in Password Reset, Password Changed, and Account Recovery templates.

---

## 🎯 Global Variables (Available in ALL 28 templates)

```handlebars
{{privacy_policy_url}}        → https://varsityhub.app/privacy
{{community_guidelines_url}}  → https://varsityhub.app/community-guidelines
```

---

## 📋 Complete Variable List by Template

### **1. Password Reset - VH** ⚠️ (UPPER_CASE format)

```handlebars
{{USERNAME}}         → User's display name or "VarsityHub member"
{{RESET_LINK}}       → Full URL to reset password page
{{expires_in}}       → How long link is valid (e.g., "1 hour")
{{reset_code}}       → 6-digit verification code
```

---

### **2. Password Changed - VH** ⚠️ (UPPER_CASE format)

```handlebars
{{USERNAME}}         → User's display name or "VarsityHub member"
{{CHANGE_DATE}}      → Formatted date/time (e.g., "December 16, 2025 at 2:30 PM CST")
{{USER_EMAIL}}       → User's email address
```

---

### **3. Account Recovery** ⚠️ (UPPER_CASE format)

```handlebars
{{USERNAME}}         → User's display name or "VarsityHub member"
{{ACCOUNT_EMAIL}}    → User's email address
{{RECOVERY_DATE}}    → Formatted date/time when recovery was initiated
```

---

### **4. Report Resolution**

```handlebars
{{user_name}}           → Reporter's display name
{{report_id}}           → Unique report ID (e.g., "RPT-12345")
{{report_type}}         → Type of report (e.g., "Harassment", "Spam")
{{resolution_status}}   → "resolved" or "dismissed"
{{resolution_reason}}   → Explanation of resolution decision
{{appeal_url}}          → Link to appeal process
{{submit_date}}         → When report was submitted (optional)
{{resolution_date}}     → When report was resolved (optional)
{{report_detail_link}}  → Link to view full report details (optional)
```

---

### **5. Report Resolution Dismissed**
*(Uses same variables as Report Resolution)*

---

### **6. User Confirmation**

```handlebars
{{user_name}}          → User's display name
{{confirmation_link}}  → Link to confirm email/account
{{expires_in}}         → How long link is valid (e.g., "24 hours")
```

---

### **7. Organization Invitation**

```handlebars
{{recipient_name}}     → Person being invited
{{organization_name}}  → Name of organization
{{inviter_name}}       → Person who sent invitation
{{role}}               → Role being offered (e.g., "Organization Administrator")
{{accept_link}}        → Link to accept invitation
{{decline_link}}       → Link to decline invitation
```

---

### **8. Team Invitation**

```handlebars
{{recipient_name}}     → Person being invited
{{team_name}}          → Name of team
{{inviter_name}}       → Person who sent invitation
{{role}}               → Role being offered (e.g., "Assistant Coach")
{{accept_link}}        → Link to accept invitation
{{decline_link}}       → Link to decline invitation
```

---

### **9. Athlete Invitation**

```handlebars
{{athlete_name}}       → Athlete being invited
{{team_name}}          → Name of team
{{coach_name}}         → Coach extending invitation
{{sport}}              → Sport name (e.g., "Basketball", "Football")
{{accept_link}}        → Link to accept invitation
{{decline_link}}       → Link to decline invitation
```

---

### **10. Role Assignment**

```handlebars
{{user_name}}          → Person receiving new role
{{new_role}}           → New role title (e.g., "Head Coach")
{{team_name}}          → Team name
{{assigned_by}}        → Person who assigned role
{{assigned_date}}      → Date role was assigned
{{dashboard_link}}     → Link to user's dashboard
```

---

### **11. Roster Threshold Alert**

```handlebars
{{coach_name}}         → Coach's display name
{{team_name}}          → Team name
{{current_roster_count}} → Current number of roster members (number)
{{max_roster_count}}   → Maximum allowed roster members (number)
{{upgrade_link}}       → Link to upgrade plan
```

---

### **12. Invitation Declined**

```handlebars
{{sender_name}}        → Original inviter (receives this email)
{{declined_by_name}}   → Person who declined
{{team_name}}          → Team name
{{role}}               → Role that was declined
{{declined_date}}      → Date invitation was declined
{{reason_provided}}    → Optional decline reason or "No reason provided"
{{view_team_url}}      → Link to view team
{{resend_invitation_url}} → Link to send new invitation
```

---

### **13. Team Roster Update**

```handlebars
{{coach_name}}         → Coach receiving notification
{{team_name}}          → Team name
{{update_type}}        → Type of update (e.g., "Player Added", "Player Removed")
{{player_name}}        → Name of player affected
{{update_date}}        → Date of roster change
{{view_roster_link}}   → Link to view full roster
```

---

### **14. Member Removed**

```handlebars
{{user_name}}          → Person removed from team
{{team_name}}          → Team name
{{organization_name}}  → Organization name
{{removed_by}}         → Person who removed them
{{removal_date}}       → Date of removal
{{removal_reason}}     → Reason for removal or "No reason provided"
{{contact_email}}      → Support/contact email
```

---

### **15. Event Submission Confirmation**

```handlebars
{{coach_name}}         → Coach who submitted event
{{event_name}}         → Name of event (e.g., "Basketball Game vs Lincoln High")
{{event_date}}         → Formatted date (e.g., "Friday, January 24, 2025")
{{event_time}}         → Formatted time (e.g., "7:00 PM CT")
{{event_location}}     → Venue/location
{{submission_date}}    → When event was submitted (e.g., "Jan 15, 2025 · 2:30 PM CT")
{{organization_name}}  → Organization name
{{status_link}}        → Link to check approval status
```

---

### **16. Event Approved**

```handlebars
{{coach_name}}         → Coach receiving approval
{{event_name}}         → Event name
{{event_date}}         → Event date
{{event_time}}         → Event time
{{event_location}}     → Event location
{{opponent}}           → Opponent name or "TBD"
{{organization_name}}  → Organization name
{{approval_notes}}     → Admin's approval message or default message
{{event_link}}         → Link to view event
{{manage_link}}        → Link to manage event
```

---

### **17. Event Denied**

```handlebars
{{coach_name}}         → Coach receiving denial
{{event_name}}         → Event name
{{event_date}}         → Event date
{{denial_reason}}      → Reason for denial
{{resubmit_link}}      → Link to resubmit event
{{support_link}}       → Link to contact support
{{organization_name}}  → Organization name
```

---

### **18. Event Updated**

```handlebars
{{recipient_name}}     → Person receiving update
{{event_name}}         → Event name
{{event_date}}         → Updated date
{{event_time}}         → Updated time
{{event_location}}     → Updated location
{{organization_name}}  → Organization name
{{updated_at}}         → When update occurred
{{change_summary}}     → Description of what changed
{{event_detail_link}}  → Link to view full event
{{calendar_link}}      → Link to add to calendar
```

---

### **19. Event Canceled**

```handlebars
{{recipient_name}}     → Person receiving cancellation notice
{{event_name}}         → Event name
{{event_date}}         → Original event date
{{event_time}}         → Original event time
{{event_location}}     → Original location
{{canceled_at}}        → When cancellation occurred
{{organization_name}}  → Organization name
{{cancel_reason}}      → Reason for cancellation
{{reschedule_info}}    → Reschedule details or "No reschedule information available"
{{upcoming_events_link}} → Link to view other events
{{contact_organizer_link}} → Link to contact organizer
```

---

### **20. Event Reminder (24hr)**

```handlebars
{{recipient_name}}     → Person receiving reminder
{{event_name}}         → Event name
{{event_date}}         → Event date
{{event_time}}         → Event time
{{event_location}}     → Event location
{{opponent}}           → Opponent or "TBD"
{{organization_name}}  → Organization name
{{check_in_link}}      → Link to check in
{{calendar_link}}      → Link to add to calendar
{{directions_link}}    → Link to get directions
{{preferences_link}}   → Link to email preferences
```

---

### **21. Event RSVP Confirmation**

```handlebars
{{user_name}}          → Person who RSVP'd
{{event_name}}         → Event name
{{event_date}}         → Event date
{{event_time}}         → Event time
{{event_location}}     → Event location
{{rsvp_confirmed_at}}  → When RSVP was confirmed
{{organization_name}}  → Organization name
{{event_detail_link}}  → Link to event details
{{calendar_link}}      → Link to add to calendar
{{cancel_rsvp_link}}   → Link to cancel RSVP
```

---

### **22. Account Warning (Level 1)**

```handlebars
{{user_name}}          → User receiving warning
{{report_id}}          → Report ID that triggered warning
{{violation_type}}     → Type of violation (e.g., "Community Guidelines")
{{warning_reason}}     → Explanation of warning or default message
{{appeal_url}}         → Link to appeal warning
{{community_guidelines_url}} → Link to guidelines (can be custom)
```

---

### **23. Content Removed (Level 2)**

```handlebars
{{user_name}}          → User whose content was removed
{{report_id}}          → Report ID
{{content_type}}       → Type of content (e.g., "Post", "Comment", "Photo")
{{report_type}}        → Type of violation or "Policy Violation"
{{removal_date}}       → Date content was removed or current date
{{content_preview}}    → Preview of removed content (optional)
{{removal_reason}}     → Explanation of removal
{{appeal_url}}         → Link to appeal
{{community_guidelines_url}} → Link to guidelines
```

---

### **24. 7-Day Suspension (Level 3a)**

```handlebars
{{user_name}}          → Suspended user
{{report_id}}          → Report ID
{{violation_type}}     → Violation type
{{report_type}}        → Alias for violation_type (template compatibility)
{{suspension_days}}    → Number 7
{{suspension_duration}} → "7 days"
{{suspension_date}}    → When suspension started
{{reinstatement_date}} → When account will be restored
{{suspension_reason}}  → Explanation of suspension
{{appeal_url}}         → Link to appeal
{{community_guidelines_url}} → Link to guidelines
```

---

### **25. 45-Day Suspension (Level 3b)**
*(Uses same variables as 7-Day Suspension, with suspension_days = 45)*

---

### **26. Permanent Ban (Level 5)**

```handlebars
{{user_name}}          → Banned user
{{report_id}}          → Report ID
{{violation_type}}     → Violation type
{{report_type}}        → Alias for violation_type
{{ban_date}}           → Formatted date/time of ban
{{ban_reason}}         → Explanation of permanent ban
{{appeal_url}}         → Link to appeal (may have limited window)
{{support_email}}      → Support email or default "customerservice@varsityhub.app"
{{community_guidelines_url}} → Link to guidelines
```

---

### **27. Payment Failed**

```handlebars
{{user_name}}          → User with failed payment
{{payment_method_last4}} → Last 4 digits of payment method
{{failed_amount}}      → Amount that failed (e.g., "$29.99")
{{failed_date}}        → Date payment failed
{{plan_name}}          → Subscription plan name
{{retry_date}}         → When retry will occur
{{update_payment_link}} → Link to update payment method
{{contact_support_link}} → Link to contact support
```

---

### **28. Subscription Expiring**

```handlebars
{{user_name}}          → Subscriber
{{plan_name}}          → Plan name (e.g., "Premium Plan")
{{expires_date}}       → Expiration date
{{days_remaining}}     → Days until expiration
{{renewal_price}}      → Price to renew (e.g., "$29.99/month")
{{features_losing}}    → Array of features that will be lost
{{renew_link}}         → Link to renew subscription
{{manage_subscription_link}} → Link to manage subscription
```

---

### **29. Login from New Device**

```handlebars
{{user_name}}          → User who logged in
{{device_type}}        → Device type (e.g., "iPhone", "Windows PC")
{{device_location}}    → Location (e.g., "Austin, TX")
{{login_date}}         → Date of login
{{login_time}}         → Time of login
{{ip_address}}         → IP address used
{{secure_account_link}} → Link to security settings
{{change_password_link}} → Link to change password
{{contact_support_link}} → Link to report unauthorized access
```

---

### **30. Staff Member Joined**

```handlebars
{{recipient_name}}     → Team admin/owner receiving notification
{{new_member_name}}    → Staff member who joined
{{member_role}}        → Their role (e.g., "Assistant Coach")
{{team_name}}          → Team name
{{joined_date}}        → Date they joined
{{organization_name}}  → Organization name
{{view_team_link}}     → Link to view team
{{manage_staff_link}}  → Link to manage staff
```

---

## 📊 Variable Statistics

### By Category:
- **User Names:** 15 different name variables
- **Dates/Times:** 20+ date/time fields
- **Links/URLs:** 40+ action links
- **Team/Org Info:** 8 org/team variables
- **Event Info:** 12 event-specific variables
- **Safety/Moderation:** 15+ report/violation variables
- **Billing:** 8 payment/subscription variables

### By Data Type:
- **Strings:** ~110 variables
- **Numbers:** 2 variables (current_roster_count, max_roster_count)
- **Arrays:** 1 variable (features_losing)
- **Booleans:** 0 (all handled by template selection)

---

## 🎨 Design Considerations

### Variable Length Guidelines:
- **User/Team Names:** Max 50 characters, truncate with ellipsis
- **Event Names:** Max 100 characters
- **Reasons/Messages:** Max 500 characters, use scrollable containers
- **URLs:** Variable length, always use full width buttons
- **Dates:** Consistent format across all templates

### Required vs Optional:
- **Always Present:** user_name, privacy_policy_url, community_guidelines_url
- **Often Optional:** opponent, approval_notes, reschedule_info, reasonProvided
- **Template-Specific:** Each template has unique required set

---

## 🔄 Standardization Recommendations

### URGENT: Fix Legacy Templates
Convert these 3 templates to snake_case:
1. Password Reset: `USERNAME` → `user_name`, `RESET_LINK` → `reset_link`
2. Password Changed: `USERNAME` → `user_name`, `CHANGE_DATE` → `change_date`, `USER_EMAIL` → `user_email`
3. Account Recovery: `USERNAME` → `user_name`, `ACCOUNT_EMAIL` → `account_email`, `RECOVERY_DATE` → `recovery_date`

### Naming Pattern:
```
✅ CORRECT: snake_case
{{user_name}}
{{event_date}}
{{team_name}}

❌ WRONG: camelCase
{{userName}}
{{eventDate}}
{{teamName}}

❌ WRONG: UPPER_CASE (except legacy)
{{USER_NAME}}
{{EVENT_DATE}}
{{TEAM_NAME}}
```

---

## 📝 Notes for Designers

1. All variables use double curly braces: `{{variable_name}}`
2. Optional variables should have fallback text in design
3. Arrays (like `features_losing`) need loop handling in SendGrid
4. Links should always be styled as buttons or underlined text
5. Dates/times follow US Central Time Zone format
6. All templates have footer with social links and legal links

---

**Last Updated:** December 16, 2025  
**Maintained By:** Engineering Team  
**Next Review:** After legacy template migration
