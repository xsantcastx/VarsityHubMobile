# 🎨 Figma Email Design System Prompt for VarsityHub

**Project:** VarsityHub Mobile App - Email Template System  
**Total Templates:** 28  
**Design System:** Comprehensive email design framework  
**Deliverable:** Production-ready HTML email templates for SendGrid

---

## 📋 Project Overview

Design a complete email template system for VarsityHub, a sports team management platform. All templates must be mobile-responsive, brand-consistent, and optimized for email clients (Gmail, Outlook, Apple Mail, etc.).

---

## 🎯 Design Requirements

### Brand Identity
- **Primary Color:** #10b981 (Green - trust, growth, sports)
- **Secondary Colors:**
  - Success: #d1fae5 (light green background)
  - Warning: #f59e0b (orange for alerts)
  - Danger: #ef4444 (red for critical actions)
  - Info: #3b82f6 (blue for informational)
- **Typography:**
  - Font Stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`
  - Headings: 24px, bold (700)
  - Body: 16px, regular (400)
  - Small text: 14px
- **Logo:** https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png
  - Size: 100x100px, rounded 8px
  - Placement: Centered at top

### Layout Specifications
- **Max Width:** 600px (email best practice)
- **Background:** #f3f4f6 (light gray)
- **Card Background:** #ffffff (white)
- **Border Radius:** 8px for main container, 6px for buttons
- **Padding:** 40px horizontal, 20px vertical (mobile: 20px all)
- **Box Shadow:** `0 2px 4px rgba(0,0,0,0.1)`

---

## 🏗️ Template Structure (All 28 Templates)

### Standard Template Anatomy
```
┌─────────────────────────────────┐
│         [VH Logo 100x100]       │ ← Always centered
├─────────────────────────────────┤
│         [Badge Label]           │ ← Category badge (color-coded)
├─────────────────────────────────┤
│      [H1 Email Title]           │ ← 24px bold
│                                 │
│  [Body Content with Variables]  │ ← 16px regular, line-height 1.6
│                                 │
│  [Optional Info Box]            │ ← Colored left border
│                                 │
│  [Primary CTA Button]           │ ← Full width, rounded
│                                 │
│  [Secondary Info/Warning]       │ ← 14px, muted
├─────────────────────────────────┤
│        [Social Icons]           │ ← 5 icons, 32x32px
│      [Footer Links]             │ ← Privacy | Guidelines
│      [Copyright]                │ ← © 2025 LIME PRODUCTIONS
└─────────────────────────────────┘
```

---

## 🎨 Component Library to Design

### 1. Category Badges (7 Types)

#### **Team Management** (8 templates)
```
Background: #d1fae5 (light green)
Text: #065f46 (dark green)
Border: 2px solid #10b981
Icon: 👥
Label: "TEAM INVITATION" | "ORGANIZATION INVITATION" | "ATHLETE INVITATION" | "ROLE ASSIGNMENT" | "ROSTER THRESHOLD" | "INVITATION DECLINED" | "TEAM ROSTER UPDATE" | "MEMBER REMOVED"
```

#### **Membership** (5 templates)
```
Background: #dbeafe (light blue)
Text: #1e40af (dark blue)
Border: 2px solid #3b82f6
Icon: 🔐
Label: "PASSWORD RESET" | "PASSWORD CHANGED" | "ACCOUNT RECOVERY" | "REPORT RESOLUTION" | "USER CONFIRMATION"
```

#### **Event Management** (7 templates)
```
Background: #fef3c7 (light yellow)
Text: #92400e (dark yellow)
Border: 2px solid #f59e0b
Icon: 📅
Label: "EVENT SUBMISSION" | "EVENT APPROVED" | "EVENT DENIED" | "EVENT UPDATED" | "EVENT CANCELED" | "EVENT REMINDER" | "EVENT RSVP"
```

#### **Trust & Safety** (5 templates)
```
Background: #fee2e2 (light red)
Text: #991b1b (dark red)
Border: 2px solid #ef4444
Icon: ⚠️
Label: "ACCOUNT WARNING" | "CONTENT REMOVED" | "7-DAY SUSPENSION" | "45-DAY SUSPENSION" | "PERMANENT BAN"
```

#### **Billing** (2 templates)
```
Background: #fce7f3 (light pink)
Text: #831843 (dark pink)
Border: 2px solid #ec4899
Icon: 💳
Label: "PAYMENT FAILED" | "SUBSCRIPTION EXPIRING"
```

#### **Security** (1 template)
```
Background: #e0e7ff (light indigo)
Text: #3730a3 (dark indigo)
Border: 2px solid #6366f1
Icon: 🔒
Label: "LOGIN NEW DEVICE"
```

#### **Onboarding** (1 template)
```
Background: #ddd6fe (light purple)
Text: #5b21b6 (dark purple)
Border: 2px solid #8b5cf6
Icon: 🎉
Label: "STAFF MEMBER JOINED"
```

### 2. Info Boxes (3 Variants)

#### **Success/Info Box**
```
Background: #ecfdf5
Border-Left: 4px solid #10b981
Padding: 20px
Text Color: #047857
Font Weight: 600 for labels, 400 for values
```

#### **Warning Box**
```
Background: #fff7ed
Border-Left: 4px solid #f59e0b
Padding: 20px
Text Color: #92400e
Icon: ⏰
```

#### **Danger Box**
```
Background: #fef2f2
Border-Left: 4px solid #ef4444
Padding: 20px
Text Color: #991b1b
Icon: 🚨
```

### 3. Buttons (3 Sizes)

#### **Primary CTA**
```
Background: #10b981
Color: #ffffff
Padding: 16px 32px
Border-Radius: 6px
Font-Weight: 600
Font-Size: 16px
Width: 100% (mobile), auto (desktop)
Hover: darken 10%
```

#### **Secondary CTA**
```
Background: transparent
Color: #10b981
Border: 2px solid #10b981
Padding: 12px 24px
Border-Radius: 6px
Font-Weight: 600
Font-Size: 14px
```

#### **Text Link**
```
Color: #10b981
Text-Decoration: none
Font-Weight: 500
Hover: underline
```

### 4. Footer Components

#### **Social Media Icons (5 icons)**
```
Size: 32x32px
Spacing: 10px between
Layout: Horizontal row, centered
Icons:
  - Instagram: https://cdn-icons-png.flaticon.com/512/2111/2111463.png
  - TikTok: https://cdn-icons-png.flaticon.com/512/3046/3046120.png
  - YouTube: https://cdn-icons-png.flaticon.com/512/1384/1384060.png
  - Facebook: https://cdn-icons-png.flaticon.com/512/733/733547.png
  - Website: https://cdn-icons-png.flaticon.com/512/1006/1006771.png
Links:
  - https://www.instagram.com/varsityhub/
  - https://www.tiktok.com/@varsityhub
  - https://www.youtube.com/@varsityhub
  - https://www.facebook.com/varsityhub
  - https://varsityhub.app
```

#### **Footer Links**
```
Font-Size: 16px
Color: #10b981
Text-Align: center
Separator: " | "
Links: "Privacy Policy" | "Community Guidelines"
```

#### **Copyright**
```
Font-Size: 14px
Color: #9ca3af
Text-Align: center
Text: "© 2025 LIME PRODUCTIONS"
```

---

## 📐 Responsive Design Rules

### Desktop (600px width)
- Two-column layouts for data tables
- Full-width buttons with max-width
- 40px horizontal padding

### Mobile (320px - 480px)
- Single column layouts only
- Stack all elements vertically
- 20px horizontal padding
- Touch-friendly button sizing (min 44px height)
- Font-size increase for readability

### Email Client Compatibility
- **Table-based layout** (no CSS Grid/Flexbox)
- **Inline CSS only** (no external stylesheets)
- **No JavaScript**
- **Web-safe fonts** with fallbacks
- **Alt text for all images**
- **Dark mode friendly** (test in Gmail/Outlook dark mode)

---

## 🔤 Variable Formatting Rules

### All Variables Use This Format:
```handlebars
{{variable_name}}  ✅ Correct (snake_case with double curly braces)
```

### **EXCEPTION: 3 Legacy Templates** (to be updated)
```handlebars
{{USERNAME}}       ⚠️ Legacy format (UPPER_CASE)
{{RESET_LINK}}     ⚠️ Only in Password Reset, Password Changed, Account Recovery
```

### Variable Display Guidelines:

#### **User Names**
```
Max Length: 50 characters
Overflow: Ellipsis (...)
Font-Weight: 700 (bold)
Color: #111827
```

#### **Dates/Times**
```
Format: "December 16, 2025 at 2:30 PM CST"
Font-Weight: 600
Color: #374151
```

#### **Event/Team Names**
```
Max Length: 100 characters
Font-Weight: 700
Color: #111827
Overflow: Wrap to new line
```

#### **Reasons/Messages**
```
Max Length: 500 characters
Line-Height: 1.6
Color: #374151
Container: Scrollable if exceeds 10 lines
```

#### **Numeric Values**
```
Format: Comma-separated (e.g., "1,234")
Font-Weight: 700
Color: #10b981
```

#### **Currency**
```
Format: "$29.99"
Font-Weight: 700
Color: #10b981
```

#### **Links/URLs**
```
Style: Button or underlined text
Color: #10b981
Never show raw URL text (use button labels)
```

---

## 🎯 Template-Specific Design Notes

### **Invitation Templates** (Organization, Team, Athlete)
- Prominent "Accept" button (green)
- Secondary "Decline" button (gray/outline)
- Info box showing: Team/Org name, Role, Inviter, Expiration
- Warm, welcoming tone in imagery

### **Event Templates** (7 templates)
- Clear date/time display in colored box
- Location with map icon
- "Add to Calendar" button
- Event-specific icons (calendar, clock, location pin)

### **Safety Templates** (Warning, Suspension, Ban)
- Severity color coding (yellow → orange → red)
- Clear policy violation explanation
- Appeal process CTA
- Professional, serious tone

### **Billing Templates**
- Payment amount in large, bold text
- Credit card last 4 digits
- "Update Payment Method" prominent button
- Urgency indicators without being alarming

---

## 📊 Accessibility Requirements

### WCAG 2.1 AA Compliance
- **Color Contrast:** Minimum 4.5:1 for body text, 3:1 for large text
- **Alt Text:** All images must have descriptive alt attributes
- **Semantic HTML:** Proper heading hierarchy (H1 → H2 → H3)
- **Keyboard Navigation:** All links/buttons accessible via keyboard
- **Screen Reader:** Logical reading order, descriptive link text

### Color Blind Friendly
- Don't rely on color alone for meaning
- Use icons + text labels
- Test with color blindness simulator

---

## 🔧 Technical Specifications

### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>[Template Name] - VarsityHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <!-- All content uses TABLE layout -->
</body>
</html>
```

### CSS Rules
- **ALL styles must be inline** (no `<style>` tags)
- Use `style=""` attribute on every element
- Table-based layout (role="presentation")
- No CSS Grid, Flexbox, or modern layout techniques
- Safe fonts with system fallbacks

### SendGrid Integration
- Variables use `{{variable_name}}` syntax
- Optional variables need conditional handling in SendGrid
- Arrays (like `{{features_losing}}`) need SendGrid loop syntax
- Test templates in SendGrid preview tool

---

## 📦 Deliverables

### For Each of 28 Templates:

1. **Figma Design File**
   - Desktop version (600px)
   - Mobile version (375px)
   - All states (default, hover, active)
   - Variable placeholders clearly marked

2. **HTML File**
   - Production-ready HTML
   - Inline CSS only
   - SendGrid variables properly formatted
   - Tested in Litmus/Email on Acid

3. **Variable Mapping Document**
   - List of all variables used in template
   - Expected data types
   - Optional vs required fields
   - Fallback values

4. **Preview Screenshots**
   - Gmail (light + dark mode)
   - Outlook (Windows)
   - Apple Mail (iOS)
   - All major email clients

---

## 🎨 Design System Assets to Create

### Icons Needed
- ✅ Checkmark (success)
- ⚠️ Warning triangle
- 🚨 Alert circle
- 📅 Calendar
- 🕐 Clock
- 📍 Location pin
- 👥 People/team
- 🔐 Lock/security
- 💳 Credit card
- 📧 Email/message

### Color Palette Export
```css
/* Primary */
--green-600: #10b981;
--green-50: #d1fae5;
--green-800: #065f46;

/* Danger */
--red-600: #ef4444;
--red-50: #fee2e2;
--red-800: #991b1b;

/* Warning */
--yellow-600: #f59e0b;
--yellow-50: #fff7ed;
--yellow-900: #92400e;

/* Info */
--blue-600: #3b82f6;
--blue-50: #dbeafe;
--blue-800: #1e40af;

/* Neutral */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-400: #9ca3af;
--gray-600: #6b7280;
--gray-900: #111827;
```

---

## ✅ Design Checklist (Per Template)

- [ ] Logo properly sized and positioned
- [ ] Category badge matches template type
- [ ] All variables clearly marked with {{variable_name}}
- [ ] Primary CTA button prominent and accessible
- [ ] Info boxes use correct colors for severity
- [ ] Mobile responsive (stacks properly at 375px)
- [ ] Footer has all 5 social icons
- [ ] Privacy Policy and Community Guidelines links present
- [ ] Copyright text "© 2025 LIME PRODUCTIONS"
- [ ] Color contrast ratio ≥ 4.5:1 for body text
- [ ] Alt text on all images
- [ ] Tested in email preview tool
- [ ] HTML validates (W3C)
- [ ] Works in Gmail, Outlook, Apple Mail
- [ ] Dark mode compatible
- [ ] Printable (looks good when printed)

---

## 🚀 Priority Order (Build in This Sequence)

### Phase 1: Core Templates (Week 1)
1. Password Reset ⚠️ (legacy format - needs conversion)
2. Team Invitation
3. Event Submission Confirmation
4. Payment Failed
5. Account Warning

### Phase 2: Invitations & Events (Week 2)
6. Organization Invitation
7. Athlete Invitation
8. Event Approved
9. Event Denied
10. Event Reminder

### Phase 3: Safety & Moderation (Week 3)
11. Content Removed
12. 7-Day Suspension
13. 45-Day Suspension
14. Permanent Ban
15. Report Resolution

### Phase 4: Remaining Templates (Week 4)
16-28. All remaining templates

---

## 📞 Support & Questions

- **Variable Reference:** See `COMPLETE_VARIABLE_REFERENCE.md`
- **Backend Code:** `/server/src/lib/email.ts`
- **Test Data:** Available in AllEmailsViewer.tsx
- **Brand Guidelines:** VarsityHub Design System

---

**Created:** December 16, 2025  
**Version:** 1.0  
**Status:** Ready for Design  
**Est. Completion:** 4 weeks (28 templates)

---

## 💡 Pro Tips for Designers

1. **Start with the component library** - Build reusable elements first
2. **Use Auto Layout in Figma** - Makes responsive design easier
3. **Create template variants** - Desktop + Mobile for each
4. **Export HTML early** - Test email rendering frequently
5. **Dark mode testing** - Critical for Gmail/Outlook users
6. **Keep it simple** - Email HTML is limited, avoid complex layouts
7. **Variable states** - Show examples with real data + placeholder data
8. **Link styling** - Always underline or button-ify links
9. **Mobile first** - Design for mobile, enhance for desktop
10. **Test, test, test** - Use Litmus or Email on Acid before delivery

Good luck! 🎨✨
