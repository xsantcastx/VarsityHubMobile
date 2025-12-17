# Figma Email Design System - Complete Prompt

**Purpose:** Create a comprehensive, production-ready email design system for VarsityHub  
**Deliverable:** Figma component library + 19 production email templates  
**Timeline:** 2-3 weeks for full system + all templates  
**Audit Reference:** `EMAIL_TEMPLATE_AUDIT.md`

---

## PROJECT OVERVIEW

### What You're Building
A complete email design system with:
- **Foundation:** Typography, colors, spacing, icons
- **Components:** Reusable email-specific UI elements
- **Templates:** 19 fully-designed, production-ready email layouts
- **Documentation:** Usage guidelines for developers

### Who Will Use This
- **Developers:** Convert Figma designs to SendGrid dynamic templates
- **Marketers:** Create new emails using component library
- **Product Designers:** Extend system for future email types

---

## DESIGN CONSTRAINTS

### Email-Specific Requirements

#### 1. Technical Constraints
```
- Max width: 600px (most email clients)
- Layout: Table-based (Outlook compatibility)
- CSS: Inline only (no external stylesheets)
- Images: Hosted URLs only (no local files)
- Fonts: Web-safe fallbacks required
```

#### 2. Email Client Support
```
Must render correctly in:
- Gmail (web + mobile app)
- Apple Mail (macOS + iOS)
- Outlook (Windows + Mac + 365)
- Yahoo Mail
- Proton Mail
```

#### 3. Accessibility Requirements
```
- WCAG 2.1 AA compliant
- Color contrast: 4.5:1 minimum
- Alt text for all images
- Semantic HTML structure
- Screen reader friendly
```

---

## FOUNDATION SYSTEM

### Typography

#### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
```

**Rationale:** System fonts ensure consistent rendering across all email clients

#### Type Scale
```
Display (Email Headers):
- Font-size: 28px
- Font-weight: 700
- Line-height: 1.2
- Color: #111827
- Use: Main email subject (e.g., "Password Reset Request")

Title (Section Headers):
- Font-size: 24px
- Font-weight: 700
- Line-height: 1.3
- Color: #111827
- Use: Section headings (e.g., "Event Details")

Subtitle:
- Font-size: 18px
- Font-weight: 600
- Line-height: 1.4
- Color: #374151
- Use: Subsection headings

Body Large:
- Font-size: 16px
- Font-weight: 400
- Line-height: 1.6
- Color: #374151
- Use: Primary content

Body Regular:
- Font-size: 14px
- Font-weight: 400
- Line-height: 1.6
- Color: #374151
- Use: Standard paragraphs

Body Small:
- Font-size: 12px
- Font-weight: 400
- Line-height: 1.5
- Color: #6b7280
- Use: Footnotes, disclaimers, timestamps

Label:
- Font-size: 13px
- Font-weight: 600
- Line-height: 1.4
- Color: #6b7280
- Use: Form labels, metadata

Code/Monospace:
- Font-family: 'Courier New', Courier, monospace
- Font-size: 18px
- Font-weight: 700
- Letter-spacing: 2px
- Use: Verification codes, account numbers
```

---

### Color System

#### Primary Palette
```
Brand Green (Primary CTA):
- Hex: #10b981
- RGB: 16, 185, 129
- Use: Primary buttons, success states, approvals

Brand Purple (Accents):
- Hex: #667eea
- RGB: 102, 126, 234
- Use: Headers, informational highlights

Brand Blue (Info):
- Hex: #3b82f6
- RGB: 59, 130, 246
- Use: Informational messages, secondary CTAs
```

#### Status Colors
```
Success:
- Hex: #10b981
- Use: Approvals, confirmations, resolved states

Warning:
- Hex: #f59e0b
- RGB: 245, 158, 11
- Use: Expiring soon, pending actions

Error:
- Hex: #ef4444
- RGB: 239, 68, 68
- Use: Denials, removals, suspensions, failures

Info:
- Hex: #3b82f6
- Use: Neutral notifications, reminders
```

#### Neutral Grays
```
Gray 900 (Primary Text):
- Hex: #111827

Gray 700 (Secondary Text):
- Hex: #374151

Gray 500 (Tertiary Text):
- Hex: #6b7280

Gray 300 (Borders):
- Hex: #d1d5db

Gray 200 (Dividers):
- Hex: #e5e7eb

Gray 100 (Backgrounds):
- Hex: #f3f4f6

Gray 50 (Light Backgrounds):
- Hex: #f9fafb

White:
- Hex: #ffffff
```

#### Background Colors
```
Success Background:
- Hex: #d1fae5 (green tint)

Warning Background:
- Hex: #fef3c7 (amber tint)

Error Background:
- Hex: #fee2e2 (red tint)

Info Background:
- Hex: #dbeafe (blue tint)
```

---

### Spacing System

#### 8px Grid
```
Use multiples of 8px for all spacing:

4px:  Micro spacing (between inline elements)
8px:  Tight spacing (list items)
12px: Compact spacing (form fields)
16px: Standard spacing (paragraphs)
20px: Comfortable spacing (card padding)
24px: Section spacing (between content blocks)
32px: Large spacing (between major sections)
40px: Extra large (header/footer margins)
48px: Maximum spacing (dramatic separation)
```

#### Component-Specific Spacing
```
Buttons:
- Padding: 14px 28px (vertical horizontal)
- Margin bottom: 12px (between stacked buttons)

Cards:
- Padding: 20px
- Margin bottom: 24px
- Border-radius: 8px

Sections:
- Margin bottom: 32px

Email Container:
- Padding: 20px (mobile)
- Padding: 40px (desktop - if width > 640px)
```

---

### Border System

#### Border Radius
```
Small:  4px  (badges, small elements)
Medium: 6px  (cards, info boxes)
Large:  8px  (buttons, primary cards)
XL:     12px (hero sections - use sparingly)
```

#### Border Widths
```
Thin:   1px  (dividers, card borders)
Medium: 2px  (emphasis borders)
Thick:  4px  (left-accent borders on callouts)
```

---

### Iconography

#### Icon Library
**Recommendation:** Use Heroicons (https://heroicons.com) or Lucide Icons (https://lucide.dev)

**Why:** Free, consistent, professional, and have outlined + solid variants

#### Icon Sizes
```
Small:  16x16px (inline with text)
Medium: 24x24px (standard - most common)
Large:  32x32px (section headers)
XL:     48x48px (hero icons in email headers)
```

#### Required Icons (24x24px)

**Authentication & Security:**
- 🔒 Lock (password reset)
- ✅ Check circle (success confirmation)
- ⚠️ Alert triangle (warning, recovery)
- 🔐 Shield (security alert)

**Team & Organization:**
- 👋 Hand wave (welcome, new member)
- 👤 User (profile, member)
- 👥 Users (team, organization)
- ✉️ Envelope (invitation)
- 🗑️ Trash (removal)

**Events:**
- 📅 Calendar (event submission)
- ✅ Check (approval)
- ❌ X circle (denial)
- ⏰ Clock (reminder)
- 🔄 Refresh (update)
- 🚫 Cancel/slash (cancellation)

**Reports & Safety:**
- ⚠️ Warning triangle (account warning)
- 🗑️ Trash (content removed)
- 🔒 Lock (suspension)
- 🚫 Prohibition (ban)
- ✅ Check shield (resolved)

**Billing:**
- 💳 Credit card (payment)
- ⏰ Clock (expiring)
- ⚠️ Alert (failed payment)

#### Icon Colors
```
Match the semantic meaning:
- Success icons: #10b981 (green)
- Warning icons: #f59e0b (amber)
- Error icons: #ef4444 (red)
- Info icons: #3b82f6 (blue)
- Neutral icons: #6b7280 (gray)
```

---

## COMPONENT LIBRARY

### Component 1: Email Container

**Description:** Main wrapper for all email content

**Specifications:**
```
Width: 100% (max-width: 600px)
Background: #ffffff
Padding: 20px (mobile), 40px 20px (desktop)
Border: none
Box-shadow: none (emails don't support)
```

**Figma Setup:**
- Create auto-layout frame
- Width: 600px (fixed)
- Background: white
- Padding: 20px all sides

---

### Component 2: Email Header

**Description:** Top section with VarsityHub logo

**Specifications:**
```
Logo:
- URL: https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png
- Size: 100x100px
- Position: Center
- Margin-bottom: 32px

Optional Icon (for status emails):
- Size: 48x48px
- Position: Below logo (centered)
- Margin-bottom: 16px
- Color: Semantic (green/red/amber/blue)
```

**Variants:**
1. Logo Only (standard)
2. Logo + Success Icon (green check)
3. Logo + Warning Icon (amber triangle)
4. Logo + Error Icon (red X)
5. Logo + Info Icon (blue info)

---

### Component 3: Email Title

**Description:** Main heading for email

**Specifications:**
```
Typography: Display (28px, bold)
Color: #111827
Alignment: Center
Margin-bottom: 24px
Max-width: 500px (prevents long lines)
```

**Variants:**
1. Standard (centered)
2. Left-aligned (for dense layouts)

---

### Component 4: Status Badge

**Description:** Colored pill showing status

**Specifications:**
```
Padding: 8px 16px
Border-radius: 6px
Font-size: 14px
Font-weight: 700
Text-transform: uppercase
Letter-spacing: 0.5px
Display: inline-block
```

**Variants:**
```
Success:
- Background: #d1fae5
- Text: #065f46 (dark green)
- Use: "APPROVED", "CONFIRMED", "RESOLVED"

Warning:
- Background: #fef3c7
- Text: #92400e (dark amber)
- Use: "PENDING", "EXPIRING SOON"

Error:
- Background: #fee2e2
- Text: #991b1b (dark red)
- Use: "DENIED", "SUSPENDED", "REMOVED"

Info:
- Background: #dbeafe
- Text: #1e40af (dark blue)
- Use: "UPDATED", "REMINDER"
```

---

### Component 5: Info Card

**Description:** Gray box for displaying details

**Specifications:**
```
Background: #f9fafb
Border: 1px solid #e5e7eb
Border-radius: 8px
Padding: 20px
Margin: 16px 0
```

**Content Structure:**
```
Title (optional):
- Font-size: 16px
- Font-weight: 700
- Color: #111827
- Margin-bottom: 12px

Rows:
- Label + Value pairs
- Label: 13px, semibold, #6b7280
- Value: 14px, regular, #111827
- Spacing: 8px between rows
```

**Example:**
```
┌─────────────────────────────┐
│ Event Details               │
│                             │
│ Event Name:  Spring Game    │
│ Date:        March 15       │
│ Time:        7:00 PM CT     │
│ Location:    Main Stadium   │
└─────────────────────────────┘
```

---

### Component 6: Callout Box

**Description:** Colored accent box for important info

**Specifications:**
```
Border-left: 4px solid [color]
Background: [tinted color]
Padding: 16px
Border-radius: 4px
Margin: 20px 0
```

**Variants:**
```
Success Callout:
- Border: #10b981
- Background: #f0fdf4
- Text: #065f46

Warning Callout:
- Border: #f59e0b
- Background: #fffbeb
- Text: #92400e

Error Callout:
- Border: #ef4444
- Background: #fef2f2
- Text: #991b1b

Info Callout:
- Border: #3b82f6
- Background: #eff6ff
- Text: #1e40af
```

---

### Component 7: Button - Primary

**Description:** Main call-to-action button

**Specifications:**
```
Background: #10b981 (green)
Color: #ffffff (white text)
Padding: 14px 28px
Border-radius: 8px
Font-size: 15px
Font-weight: 600
Text-decoration: none
Display: inline-block
Border: none
```

**States:**
```
Default: background #10b981
Hover: background #059669 (darker green)
```

**Variants:**
```
Full-width (mobile):
- Width: 100%
- Text-align: center

Inline (desktop):
- Width: auto
- Margin: 0 8px (for side-by-side)
```

---

### Component 8: Button - Secondary

**Description:** Alternative action button

**Specifications:**
```
Background: #f3f4f6 (light gray)
Color: #374151 (dark gray text)
Border: 1px solid #d1d5db
Padding: 14px 28px
Border-radius: 8px
Font-size: 15px
Font-weight: 600
Text-decoration: none
Display: inline-block
```

**States:**
```
Default: background #f3f4f6
Hover: background #e5e7eb
```

---

### Component 9: Button - Destructive

**Description:** For dangerous actions (deny, remove, cancel)

**Specifications:**
```
Background: #ef4444 (red)
Color: #ffffff
Padding: 14px 28px
Border-radius: 8px
Font-size: 15px
Font-weight: 600
Text-decoration: none
Display: inline-block
Border: none
```

**States:**
```
Default: background #ef4444
Hover: background #dc2626 (darker red)
```

---

### Component 10: Divider

**Description:** Horizontal line separator

**Specifications:**
```
Width: 100%
Height: 1px
Background: #e5e7eb
Margin: 32px 0
Border: none
```

---

### Component 11: Social Icons Row

**Description:** Footer social media links

**Specifications:**
```
Layout: Horizontal flex
Spacing: 16px between icons
Icon size: 24x24px
Margin: 16px 0

Icons (grayscale recommended):
- Instagram: https://cdn-icons-png.flaticon.com/512/174/174855.png
- TikTok: https://cdn-icons-png.flaticon.com/512/3046/3046126.png
- YouTube: https://cdn-icons-png.flaticon.com/512/174/174883.png
- Facebook: https://cdn-icons-png.flaticon.com/512/174/174848.png
- Website: https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Globe_icon_2.svg/240px-Globe_icon_2.svg.png
```

---

### Component 12: Footer

**Description:** Standard email footer (REQUIRED IN ALL EMAILS)

**Specifications:**
```
Background: #f9fafb
Padding: 32px 20px
Border-top: 1px solid #e5e7eb
Text-align: center

Structure:
1. Social icons row (24x24px, 16px spacing)
2. Footer links (12px, #6b7280, 12px spacing)
   - Privacy Policy
   - Community Guidelines
3. Copyright (12px, #6b7280)
   - "© 2025 LIME PRODUCTIONS"
```

**Required Links:**
```
Privacy Policy: {{privacy_policy_url}}
Community Guidelines: {{community_guidelines_url}}
```

---

### Component 13: Code Display

**Description:** For verification codes

**Specifications:**
```
Font-family: 'Courier New', Courier, monospace
Font-size: 32px
Font-weight: 700
Letter-spacing: 4px
Color: #111827
Background: #f9fafb
Padding: 16px 24px
Border: 2px dashed #d1d5db
Border-radius: 8px
Text-align: center
Margin: 24px 0
```

**Example:**
```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                   │
│    1  2  3  4  5  6│
│                   │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

### Component 14: Countdown Timer

**Description:** Days remaining display

**Specifications:**
```
Font-size: 48px
Font-weight: 700
Color: #ef4444 (red for urgency)
Text-align: center
Margin: 16px 0

Label below:
- Font-size: 14px
- Color: #6b7280
- Text: "Days Remaining"
```

**Example:**
```
     45
 Days Remaining
```

---

### Component 15: Two-Column Layout

**Description:** Side-by-side content (desktop only)

**Specifications:**
```
Layout: 2 equal columns (50% each)
Gap: 16px
Min-width: 280px per column
Stacks on mobile (< 640px)
```

**Use Cases:**
- Before/After comparisons
- Side-by-side buttons
- Dual info cards

---

## TEMPLATE DESIGNS (19 Total)

### Category 1: Authentication (3 Templates)

#### 1.1 Password Reset Email
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   🔒                      │
│                           │
│ Password Reset Request    │
│                           │
│ Hi {{USERNAME}},          │
│                           │
│ We received a request...  │
│                           │
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│ │  1  2  3  4  5  6 │    │ [Code Display]
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│                           │
│ [Reset Password] →        │ [Primary Button]
│                           │
│ Expires in 1 hour         │
│                           │
│ [Footer: Social + Links]  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + lock icon)
- Email Title
- Code Display
- Button - Primary
- Footer

---

#### 1.2 Password Changed
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   ✅                      │
│                           │
│ Password Successfully     │
│ Changed                   │
│                           │
│ [Success Badge: CONFIRMED]│
│                           │
│ Hi {{USERNAME}},          │
│                           │
│ Your password was...      │
│                           │
│ ┌────────────────────┐   │
│ │ Changed:           │   │ [Info Card]
│ │ Dec 15, 2:30 PM    │   │
│ │ From: Chrome/macOS │   │
│ └────────────────────┘   │
│                           │
│ [Contact Support]         │ [Secondary Button]
│                           │
│ [Footer]                  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + checkmark)
- Email Title
- Status Badge (success)
- Info Card
- Button - Secondary
- Footer

---

#### 1.3 Account Recovery
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   ⚠️                      │
│                           │
│ Account Recovery Request  │
│                           │
│ ┌────────────────────┐   │
│ │ IMPORTANT:         │   │ [Warning Callout]
│ │ This is a security │   │
│ │ sensitive action   │   │
│ └────────────────────┘   │
│                           │
│ Use code: 123456          │
│ OR click link below:      │
│                           │
│ [Recover Account] →       │ [Primary Button]
│                           │
│ Expires in 1 hour         │
│                           │
│ [Footer]                  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + warning icon)
- Email Title
- Callout Box (warning)
- Button - Primary
- Footer

---

### Category 2: Team & Organization (6 Templates)

#### 2.1 Join Request → Admin
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   [Org Logo if available] │
│                           │
│ New Join Request          │
│                           │
│ Hi {{admin_name}},        │
│                           │
│ {{requester_name}} wants  │
│ to join {{org_name}}      │
│                           │
│ ┌────────────────────┐   │
│ │ Name: John Smith   │   │ [Info Card]
│ │ Email: john@...    │   │
│ └────────────────────┘   │
│                           │
│ ┌────────────────────┐   │
│ │ MESSAGE:           │   │ [Callout Box]
│ │ "I would love..."  │   │
│ └────────────────────┘   │
│                           │
│ [Approve Request] →       │ [Primary Button]
│ [Deny Request]            │ [Destructive Button]
│                           │
│ [Footer]                  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + optional org logo)
- Email Title
- Info Card (requester details)
- Callout Box (message)
- Button - Primary
- Button - Destructive
- Footer

---

#### 2.2 Join Request Approved
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   ✅                      │
│                           │
│ Welcome to {{org_name}}!  │
│                           │
│ [Badge: REQUEST APPROVED] │
│                           │
│ Hi {{user_name}},         │
│                           │
│ Great news! {{admin_name}}│
│ approved your request.    │
│                           │
│ You can now access all    │
│ organization features.    │
│                           │
│ [View Organization] →     │ [Primary Button]
│                           │
│ [Footer]                  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + checkmark)
- Email Title
- Status Badge (success)
- Button - Primary
- Footer

---

#### 2.3 Join Request Denied
```
STRUCTURE:
┌───────────────────────────┐
│   [VarsityHub Logo]       │
│   ❌                      │
│                           │
│ Request Update            │
│                           │
│ Hi {{user_name}},         │
│                           │
│ Your request to join      │
│ {{org_name}} was not      │
│ approved at this time.    │
│                           │
│ ┌────────────────────┐   │
│ │ REASON:            │   │ [Error Callout]
│ │ {{reason}}         │   │
│ └────────────────────┘   │
│                           │
│ You're welcome to apply   │
│ again in the future.      │
│                           │
│ [Explore Organizations]   │ [Secondary Button]
│                           │
│ [Footer]                  │
└───────────────────────────┘
```

**Components Used:**
- Email Container
- Email Header (logo + X icon)
- Email Title
- Callout Box (error)
- Button - Secondary
- Footer

---

*(Continue this pattern for all 19 templates...)*

---

## IMPLEMENTATION GUIDELINES

### For Developers Converting to SendGrid

#### 1. Table-Based Layout
```html
<!-- Use tables for layout (email client compatibility) -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center">
      <!-- Content here -->
    </td>
  </tr>
</table>
```

#### 2. Inline CSS Only
```html
<!-- ✅ CORRECT -->
<p style="font-size: 14px; color: #374151; line-height: 1.6;">
  Content here
</p>

<!-- ❌ WRONG -->
<p class="body-text">Content here</p>
```

#### 3. Image Handling
```html
<!-- Always use absolute URLs -->
<img src="https://res.cloudinary.com/..." 
     alt="VarsityHub Logo" 
     width="100" 
     height="100" 
     style="display: block; margin: 0 auto;">
```

#### 4. Variable Syntax
```html
<!-- SendGrid dynamic template variables -->
<p>Hi {{user_name}},</p>

<!-- Conditional blocks -->
{{#if message}}
  <p>{{message}}</p>
{{/if}}

<!-- Loops -->
{{#each features_losing}}
  <li>{{this}}</li>
{{/each}}
```

---

## RESPONSIVE DESIGN

### Mobile Breakpoint: 640px

```css
/* Desktop (> 640px) */
.button {
  width: auto;
  margin: 0 8px;
}

/* Mobile (< 640px) */
@media (max-width: 640px) {
  .button {
    width: 100% !important;
    margin: 0 0 12px 0 !important;
  }
  
  .two-column {
    display: block !important;
  }
  
  .column {
    width: 100% !important;
  }
}
```

---

## DELIVERABLES CHECKLIST

### Phase 1: Foundation (Week 1)
- [ ] Typography system (6 text styles)
- [ ] Color palette (15+ colors documented)
- [ ] Spacing tokens (8px grid)
- [ ] Icon library (30+ icons)

### Phase 2: Components (Week 1-2)
- [ ] 15 reusable components
- [ ] All variants documented
- [ ] Auto-layout configured
- [ ] Mobile responsive versions

### Phase 3: Templates (Week 2-3)
- [ ] 19 fully-designed templates
- [ ] All variables labeled
- [ ] Mobile + desktop views
- [ ] SendGrid-ready specs

### Phase 4: Documentation (Week 3)
- [ ] Usage guidelines
- [ ] Component library README
- [ ] Developer handoff docs
- [ ] QA testing guide

---

## FINAL NOTES

### What Makes This Different from Web Design

1. **No JavaScript:** Emails can't run scripts
2. **No External CSS:** Must be inline
3. **Table Layouts:** Flexbox/Grid not supported everywhere
4. **Hosted Images Only:** Can't bundle assets
5. **Limited Fonts:** Stick to web-safe fonts
6. **No Animations:** No CSS transitions/animations
7. **Testing Required:** Must test in real email clients

### Testing Recommendations

**Tools:**
- Litmus (email testing platform)
- Email on Acid
- SendGrid preview mode

**Test Matrix:**
- Gmail (web + Android + iOS app)
- Apple Mail (macOS + iOS)
- Outlook (Windows + Mac + Web)
- Yahoo Mail
- Dark mode variants

---

## QUESTIONS & SUPPORT

**For Clarifications:**
- Review: `EMAIL_TEMPLATE_AUDIT.md`
- Check: Backend variable names in `server/src/lib/email.ts`
- Reference: Existing templates in `.docs/email-system/phase1/`

**Approval Process:**
1. Design → share Figma link for review
2. Feedback → iterate on components
3. Final approval → export assets for development
4. Handoff → provide HTML structure notes

---

**Ready to Start?** Begin with the Foundation system (typography + colors), then build the 15 components, then design all 19 templates using those components.

**Timeline:** 2-3 weeks for complete system + all production templates.
