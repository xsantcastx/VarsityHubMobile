# SendGrid Email Template Verification

## Current Status

Your backend generates:

```
appeal_url = "mailto:customerservice@varsityhub.app?subject=Appeal+for+Report+%23VR-482917&body=..."
```

But test data shows HTTPS URL — **this needs to be fixed**.

## Fix: Update Test Data in SendGrid

Go to your SendGrid template editor and update the test data to:

```json
{
  "user_name": "Coach Ramirez",
  "report_id": "VR-482917",
  "report_type": "Abusive Messages",
  "submit_date": "Jan 10, 2025 · 8:42 PM CT",
  "resolution_date": "Jan 12, 2025 · 9:15 AM CT",
  "resolution_status": "resolved",
  "resolution_reason": "The offending user's direct messaging access has been revoked for 60 days and the conversation history was archived for compliance review.",
  "report_detail_link": "https://varsityhub.app/reports/VR-482917",
  "appeal_url": "mailto:customerservice@varsityhub.app?subject=Appeal%20for%20Report%20%23VR-482917&body=Hi%20VarsityHub%20Team%2C%0A%0AI%20am%20appealing%20the%20decision%20for%20Report%20%23VR-482917.%0A%0AReport%20Type%3A%20Abusive%20Messages%0AResolution%20Status%3A%20RESOLVED%0A%0AReason%20for%20Appeal%3A%0A%5BPlease%20explain%20why%20you%20believe%20this%20decision%20was%20incorrect%20or%20provide%20new%20information%5D%0A%0AThank%20you%2C%0ACoach%20Ramirez"
}
```

## Checklist: Button Configuration

In SendGrid Design Editor:

- [ ] Click "Appeal This Decision" button
- [ ] Open right sidebar → find **Link** field
- [ ] **Remove any hardcoded URL** (should be empty)
- [ ] Type: `{{appeal_url}}`
- [ ] Save template

**Result**: Button will open default email client with prefilled subject/body.

## Checklist: HTML Code View

If using HTML editor, verify the anchor tag looks like:

```html
<a
  href="{{appeal_url}}"
  class="button"
  style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;"
>
  Appeal This Decision
</a>
```

**NOT**:

```html
<a href="https://varsityhub.app/reports/appeal"> Appeal This Decision </a>
```

## Test End-to-End

1. **In SendGrid**: Click "Send Test" with corrected test data
2. **Check your email**: Hover over "Appeal This Decision" button
3. **Browser status bar** should show: `mailto:customerservice@varsityhub.app?subject=...`
4. **Click button** → Opens email client with prefilled form
5. **Verify fields**:
   - To: `customerservice@varsityhub.app`
   - Subject: `Appeal for Report #VR-482917`
   - Body: Pre-filled with report context

## If Template Still Shows Wrong URL

1. Go to template HTML source
2. Search for the hardcoded URL
3. Replace with `{{appeal_url}}`
4. Save and re-test

---

**Status**: Backend code ✅ | Test data ❌ (needs update) | Template ❓ (verify button href)
