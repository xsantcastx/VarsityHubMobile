# Figma Design Prompt: Account Actions & Appeal Flow UI

## Overview

Design the frontend screens for handling account suspensions, warnings, content removal, and permanent bans. Users will see these screens when they receive account actions and need to appeal.

---

## Screen 1: Account Warning Screen

**Purpose**: Display to user when they receive a warning for a policy violation

**Layout**:

- **Header**
  - VarsityHub logo (top-left)
  - "Account Warning" title (24px, bold, amber color #f59e0b)
  - Close button (top-right)

- **Content**
  - Warning icon (large, amber)
  - Main message: "Your account has received a warning"
  - Subtext: "You violated our Community Guidelines"
  - Violation type badge (e.g., "Harassment", "Abusive Messages")
  - "Why?" expandable section showing the specific reason
  - Community Guidelines link (green, underlined)

- **CTA Buttons** (stacked)
  - Primary: "Understand" (green, full-width)
  - Secondary: "Appeal This" (gray outline, full-width)

- **Footer**
  - "This is your first warning. Your account will be suspended on subsequent violations."

---

## Screen 2: Content Removed Screen

**Purpose**: Notify user that specific content was removed

**Layout**:

- **Header**
  - "Content Removed" title (24px, bold, red color #ef4444)
  - Close button

- **Content**
  - Removed content icon (trash can, red)
  - Main message: "Your content has been removed"
  - Content type badge (e.g., "Post", "Comment", "Message")
  - Reason section: "This violates our Community Guidelines"
  - "What was removed?" expandable with content preview (blurred/redacted)

- **CTA Buttons** (stacked)
  - Primary: "Acknowledge" (red)
  - Secondary: "Appeal This" (gray outline)

- **Footer**
  - "Repeated violations may result in account suspension or permanent ban."

---

## Screen 3: Account Suspended Screen

**Purpose**: Inform user their account is suspended (7 or 45 days)

**Layout**:

- **Header**
  - Alert icon (⚠️)
  - "Account Suspended" title (24px, bold, red #dc2626)
  - Suspension duration badge (e.g., "45 Days Remaining")

- **Suspension Details Box** (red background, white text)
  - Countdown timer: "Your account will be reinstated on [DATE]"
  - "Days remaining: XX"
  - Violation type
  - Suspension date

- **What Can't I Do?** (collapsible section)
  - Cannot log in
  - Cannot post, comment, or message
  - Cannot access profile
  - Content remains visible (unless separately removed)

- **CTA Buttons** (stacked)
  - Primary: "Review Community Guidelines" (green)
  - Secondary: "Appeal Suspension" (gray outline)

- **Footer**
  - Reinstatement info: "Your account will automatically be reinstated on [DATE]"
  - "Repeated violations may result in permanent account termination"

---

## Screen 4: Permanent Ban Screen

**Purpose**: Inform user their account has been permanently banned

**Layout**:

- **Header**
  - Ban icon (🚫)
  - "Account Permanently Banned" title (24px, bold, dark red #7f1d1d)
  - Status badge (red, "PERMANENTLY BANNED")

- **Ban Details Box** (dark red background, white text)
  - Main message: "Your VarsityHub account has been permanently terminated"
  - Reason: "Repeated violations of our Community Guidelines"
  - Ban date
  - No reinstatement date (permanent)

- **What Does This Mean?** (dark red info box)
  - You cannot create a new account with this email
  - All your content will remain visible but you cannot access it
  - No appeals possible (or very limited appeal window)
  - Your activity is logged

- **CTA Buttons**
  - Primary: "Read Full Policy" (dark red)
  - Secondary: "Contact Support" (gray outline) — links to contact form

- **Footer**
  - "If you believe this was made in error, you can contact our support team within 30 days"

---

## Screen 5: Appeal Form / Modal

**Purpose**: Allow user to appeal an account action

**Layout** (Modal overlay):

- **Header**
  - "Submit an Appeal" (20px, bold)
  - Close button

- **Content**
  - Report ID: #VR-123456 (read-only)
  - Violation Type: [Displayed] (read-only)
  - Decision: [Displayed] (read-only)

- **Form Fields**
  - Text area: "Why do you believe this decision was incorrect?" (required, min 20 chars)
  - Optional attachment: "Add evidence/documents" (optional)
  - Checkbox: "I understand appeals are reviewed within 7-10 business days"

- **CTA Buttons**
  - Primary: "Submit Appeal" (green)
  - Secondary: "Cancel" (gray outline)

- **Footer**
  - "Appeals are reviewed by our Trust & Safety team. You'll receive an email update within 7-10 business days."

---

## Screen 6: Appeal Submitted Confirmation

**Purpose**: Confirm appeal was successfully submitted

**Layout**:

- **Header**
  - Success icon (✓ green circle)
  - "Appeal Submitted" title (green)

- **Content**
  - Confirmation message: "Your appeal has been submitted successfully"
  - Appeal reference number: "#APP-789456" (copyable)
  - Timeline: "You'll hear back within 7-10 business days"
  - What to expect section (collapsible)

- **CTA Buttons**
  - Primary: "Return to Home" (green)
  - Secondary: "View Status" (gray outline)

---

## Design System Requirements

**Colors**:

- Warning: #f59e0b (amber)
- Content Removal: #ef4444 (light red)
- Suspension (7/45 days): #dc2626 (medium red)
- Permanent Ban: #7f1d1d (dark red)
- Success: #10b981 (green)
- Neutral: #f3f4f6 (light gray)
- Text: #111827 (dark gray)

**Typography**:

- Titles: 24px, bold, system fonts
- Subtitles: 16px, regular
- Body: 14px, regular
- Labels: 13px, medium

**Spacing**:

- Padding: 16px, 20px, 24px, 32px
- Gaps: 8px, 12px, 16px, 20px

**Components**:

- Buttons: 48px height, 14px font, rounded 8px
- Cards: rounded 8px, 1px border (gray #e5e7eb)
- Modals: centered, max-width 500px, backdrop blur
- Badges: rounded 4px, 12px padding, 12px font

**Responsive**:

- Mobile-first design
- Breakpoint: 640px (tablet/desktop)
- Max width: 600px on desktop
- Full width on mobile (16px margin)

---

## Interactive Elements

**Animations**:

- Entrance: fade-in (200ms)
- Timer countdown: smooth number transitions
- Button hover: 5% background darken
- Modal open: scale-in from center (150ms)

**States**:

- Button hover: opacity change
- Button pressed: brief scale feedback
- Form validation: red border on error
- Loading state: spinner on submit button

---

## Figma Component Library to Create

1. **AccountActionCard** (reusable for all 4 action types)
   - Variant: warning, content_removal, suspension, ban
   - Props: icon, title, subtitle, daysRemaining (optional), reason

2. **AppealButton** (reusable across screens)
   - Variant: primary (green), secondary (gray outline)
   - Text: "Appeal This", "Submit Appeal", "Contact Support"

3. **InfoBox** (reusable for warnings/suspension details)
   - Variant: warning, error, success
   - Props: title, content, icon

4. **CountdownTimer**
   - Props: endDate, format (days remaining / date)

5. **FormField**
   - Variant: text, textarea, file upload
   - Props: label, placeholder, required, error

---

## Integration Notes

- All screens should close via back button or close icon
- Share data from push notification → deep link to appropriate screen
- Store appeal status locally until confirmed via API
- Animate transitions between screens
- Disable buttons while API calls are in progress
- Show error toast if appeal submission fails
- Log user interactions for analytics

---

## Reference Assets

- VarsityHub logo: https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png
- Icon set: Use system icons (SF Symbols for iOS, Material Design for Android)
- Brand guidelines: Refer to existing VarsityHub design system

---

**Deliverables**:

1. Figma file with all 6 screens
2. Component library (reusable patterns)
3. Interactive prototype with basic navigation
4. Exported assets (icons, illustrations)
5. Design documentation (spacing, colors, typography)
