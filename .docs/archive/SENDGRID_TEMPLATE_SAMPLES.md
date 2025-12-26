# SendGrid Email Template Samples

**Purpose**: Ready-to-use HTML templates for SendGrid dynamic templates  
**Last Updated**: December 25, 2025

---

## 📧 1. Email Verification Template (REQUIRED)

**Template ID Variable**: `SENDGRID_VERIFICATION_TEMPLATE_ID`

### Subject Line
```
Verify your VarsityHub account
```

### Template Variables
```json
{
  "verification_code": "123456",
  "verification_link": "https://varsityhub.app/verify?code=123456",
  "user_name": "John Doe"
}
```

### HTML Template
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">VarsityHub</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 700;">Welcome, {{user_name}}!</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thanks for signing up! To complete your registration and start using VarsityHub, please verify your email address.
              </p>
              
              <!-- Verification Code -->
              <div style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="font-size: 36px; font-weight: 700; color: #111827; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  {{verification_code}}
                </div>
              </div>
              
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; text-align: center;">
                Or click the button below to verify automatically:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{{verification_link}}" style="display: inline-block; background-color: #0ea5e9; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.3);">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Note -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>⏱ Expires in 30 minutes</strong><br>
                  This code will expire for security. Request a new code if needed.
                </p>
              </div>
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you didn't create a VarsityHub account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
                VarsityHub - The Ultimate Sports Team Management Platform
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © 2025 VarsityHub. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 🏆 2. Coach Onboarding Template (OPTIONAL)

**Template ID Variable**: `SENDGRID_COACH_ONBOARDING_TEMPLATE_ID`

### Subject Line
```
Welcome to VarsityHub, Coach! Your team awaits 🏆
```

### Template Variables
```json
{
  "user_name": "Coach Smith",
  "plan": "Veteran",
  "team_limit": "Unlimited",
  "authorized_user_limit": "5 per team",
  "dashboard_url": "https://varsityhub.app/dashboard"
}
```

### HTML Template
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome Coach!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Trophy -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px 12px 0 0;">
              <div style="font-size: 64px; margin-bottom: 16px;">🏆</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome, Coach!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px; font-weight: 700;">Hey {{user_name}},</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your VarsityHub account is all set up! You're ready to build your teams, connect with athletes, and manage your organization like never before.
              </p>
              
              <!-- Plan Benefits -->
              <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 16px; color: #166534; font-size: 16px; font-weight: 700;">Your {{plan}} Plan Includes:</p>
                <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 2;">
                  <li><strong>Team Limit:</strong> {{team_limit}} teams</li>
                  <li><strong>Authorized Users:</strong> {{authorized_user_limit}}</li>
                  <li><strong>Athlete Profiles:</strong> Unlimited</li>
                  <li><strong>Media Storage:</strong> Full resolution photos & videos</li>
                  <li><strong>Analytics:</strong> Performance tracking & insights</li>
                </ul>
              </div>
              
              <!-- Quick Start Guide -->
              <h3 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 700;">Quick Start Guide:</h3>
              <ol style="margin: 0 0 24px; padding-left: 24px; color: #4b5563; font-size: 14px; line-height: 2;">
                <li>Create your first team (Varsity, JV, etc.)</li>
                <li>Add authorized users (assistants, managers)</li>
                <li>Invite athletes to join your roster</li>
                <li>Post updates, share photos, and engage your community</li>
              </ol>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{{dashboard_url}}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                Need help? Reply to this email or visit our <a href="https://varsityhub.app/support" style="color: #0ea5e9; text-decoration: none;">Help Center</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
                VarsityHub - The Ultimate Sports Team Management Platform
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © 2025 VarsityHub. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 🎉 3. Fan Welcome Template (OPTIONAL)

**Template ID Variable**: `SENDGRID_FAN_WELCOME_TEMPLATE_ID`

### Subject Line
```
Welcome to VarsityHub! Start following your favorite teams 🎉
```

### Template Variables
```json
{
  "user_name": "Sarah Johnson",
  "explore_url": "https://varsityhub.app/explore"
}
```

### HTML Template
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome Fan!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to VarsityHub!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px; font-weight: 700;">Hey {{user_name}},</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You're now part of the VarsityHub community! Discover local teams, follow your favorite athletes, and stay connected with the sports you love.
              </p>
              
              <!-- Features -->
              <div style="background-color: #faf5ff; border: 2px solid #d8b4fe; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 16px; color: #6b21a8; font-size: 16px; font-weight: 700;">What You Can Do:</p>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 24px;">📍</span> <strong style="color: #7c3aed;">Explore</strong> teams near you
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 24px;">👥</span> <strong style="color: #7c3aed;">Follow</strong> your favorite athletes
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 24px;">💬</span> <strong style="color: #7c3aed;">Engage</strong> with team updates & highlights
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style="font-size: 24px;">📅</span> <strong style="color: #7c3aed;">Track</strong> games and events
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{{explore_url}}" style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);">
                      Explore Teams
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                Questions? We're here to help! Email us anytime at <a href="mailto:support@varsityhub.app" style="color: #6366f1; text-decoration: none;">support@varsityhub.app</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
                VarsityHub - Connect with Local Sports
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © 2025 VarsityHub. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 📝 How to Upload Templates to SendGrid

### Step 1: Access Dynamic Templates
1. Log in to SendGrid: https://app.sendgrid.com/
2. Navigate to **Email API** → **Dynamic Templates**
3. Click **Create a Dynamic Template**

### Step 2: Create Template
1. Enter template name (e.g., "VarsityHub - Email Verification")
2. Click **Add Version**
3. Choose **Blank Template** or **Code Editor**
4. Select **Code Editor** for full control

### Step 3: Paste HTML
1. Copy the HTML from above
2. Paste into the editor
3. Add template variables in the **Test Data** section (right panel)
4. Click **Preview** to verify rendering

### Step 4: Test Send
1. Add a test email address
2. Fill in test data with realistic values
3. Click **Send Test** to verify email delivery
4. Check formatting, links, and template variables

### Step 5: Copy Template ID
1. Once saved, the template ID appears at the top (format: `d-xxxxxxxxxxxxx`)
2. Copy this ID to your Railway environment variables
3. Set in Railway: `SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxx`

---

## ✅ Template Verification Checklist

### Email Verification Template (REQUIRED)
- [ ] Template created in SendGrid
- [ ] All 3 variables working: `verification_code`, `verification_link`, `user_name`
- [ ] Test email delivered successfully
- [ ] Code displays correctly (6 digits, monospace font)
- [ ] Button link navigates to verification page
- [ ] Template ID added to Railway environment

### Coach Onboarding (OPTIONAL)
- [ ] Template created in SendGrid
- [ ] All 5 variables working
- [ ] Test email delivered successfully
- [ ] Plan benefits render correctly
- [ ] Dashboard link works
- [ ] Template ID added to Railway (optional)

### Fan Welcome (OPTIONAL)
- [ ] Template created in SendGrid
- [ ] Both variables working
- [ ] Test email delivered successfully
- [ ] Explore link works
- [ ] Template ID added to Railway (optional)

---

## 🚨 Common Issues

### Issue: Template variables show as `{{variable_name}}`
**Solution**: Ensure template is set to "Dynamic" (not "Legacy")

### Issue: Test email not received
**Solution**: Check SendGrid Activity Feed for delivery status and errors

### Issue: Links don't work
**Solution**: Verify `APP_BASE_URL` environment variable is set correctly

### Issue: 500 error on send
**Solution**: Verify `SENDGRID_API_KEY` is valid and has full access permissions

---

## 📞 Support

If you encounter issues setting up templates:
1. Check SendGrid Activity Feed for detailed error logs
2. Verify API key has "Full Access" permissions
3. Ensure sender email is verified in SendGrid
4. Contact SendGrid support for template-specific issues

