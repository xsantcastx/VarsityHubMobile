# FINAL SENDGRID HTML (DO NOT MODIFY IN THE UI)

Paste these verbatim into the active Dynamic Templates. Both use the same variable names the backend already sends (`name`, `resetLink`, `mobileResetLink`, `expiresIn`, `code`, `email`, `date`).

---

## 1️⃣ Password Reset – Template `d-97a704ec6a35434195364e0ed9dfaf21`
Subject: **Reset Your VarsityHub Password**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your VarsityHub Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" role="presentation" style="background-color:#f3f4f6;">
    <tr>
        <td align="center" style="padding:32px 16px;">
            <table width="600" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                    <td style="background-color:#111827;color:#f9fafb;text-align:center;padding:12px 24px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">
                        VarsityHub Security Alert
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:32px 32px 16px;">
                        <img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png" alt="VarsityHub" width="72" height="72" style="display:block;border:0;margin:0 auto 12px;">
                        <h1 style="margin:0 0 8px;font-size:26px;color:#111827;">Reset your password</h1>
                        <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280;">Hi {{name}}, we received a request to reset your password. Use the secure link below within {{expiresIn}}.</p>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:24px 32px 8px;">
                        <a href="{{resetLink}}" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:999px;font-weight:600;font-size:16px;">Reset Password</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 24px;text-align:center;">
                        <p style="margin:12px 0 4px;font-size:13px;color:#6b7280;">If the button does not work, copy this URL into your browser:</p>
                        <p style="margin:0;font-size:13px;color:#0ea5e9;word-break:break-all;"><a href="{{resetLink}}" style="color:#0ea5e9;text-decoration:none;">{{resetLink}}</a></p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 24px;">
                        <table width="100%" role="presentation" style="background-color:#f3f4f6;border-radius:12px;">
                            <tr>
                                <td style="padding:20px;text-align:center;">
                                    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Prefer the app?</p>
                                    <a href="{{mobileResetLink}}" style="color:#10b981;font-size:15px;text-decoration:none;word-break:break-all;">Open reset in VarsityHub mobile</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 24px;text-align:center;">
                        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or enter this code manually:</p>
                        <div style="display:inline-block;padding:14px 28px;border:1px dashed #d1d5db;border-radius:10px;font-size:24px;font-weight:700;letter-spacing:0.4em;color:#111827;">{{code}}</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 32px;">
                        <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:10px;padding:14px 18px;">
                            <p style="margin:0;font-size:13px;color:#92400e;">⏰ For security, this password reset link and code expire in <strong>{{expiresIn}}</strong>.</p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 32px;border-top:1px solid #f3f4f6;">
                        <p style="margin:24px 0 8px;font-size:13px;color:#6b7280;">Didn't request a reset? Contact <a href="mailto:support@varsityhub.app" style="color:#10b981;text-decoration:none;">support@varsityhub.app</a>.</p>
                        <p style="margin:0;font-size:12px;color:#9ca3af;">We will never ask for this code outside the VarsityHub app.</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 32px 8px;border-top:1px solid #f3f4f6;">
                        <p style="margin:0 0 16px;text-align:center;font-size:12px;color:#6b7280;">Follow us on social media</p>
                        <table role="presentation" align="center">
                            <tr>
                                <td style="padding:0 6px;"><a href="https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="32" height="32" alt="Instagram" style="display:block;border:0;"></a></td>
                                <td style="padding:0 6px;"><a href="https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" width="32" height="32" alt="TikTok" style="display:block;border:0;"></a></td>
                                <td style="padding:0 6px;"><a href="https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32" alt="YouTube" style="display:block;border:0;"></a></td>
                                <td style="padding:0 6px;"><a href="https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="32" height="32" alt="Facebook" style="display:block;border:0;"></a></td>
                                <td style="padding:0 6px;"><a href="https://limeprod.com" target="_blank" rel="noopener"><img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png" width="32" height="32" alt="LimeProd.com" style="display:block;border:0;"></a></td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:12px 32px 0;text-align:center;font-size:12px;color:#9ca3af;">
                        <a href="https://limeprod.com/VarsityHubPrivacy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 32px;text-align:center;font-size:12px;color:#9ca3af;">
                        © 2025 LIME PRODUCTIONS. All rights reserved.
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

## 2️⃣ Password Changed – Template `d-6f11ea835053413296e159c91204b658`
Subject: **Your VarsityHub Password Was Changed**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your VarsityHub Password Was Changed</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" role="presentation" style="background-color:#f3f4f6;">
    <tr>
        <td align="center" style="padding:32px 16px;">
            <table width="600" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                    <td style="background-color:#111827;color:#f9fafb;text-align:center;padding:12px 24px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">
                        Password updated
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:32px 32px 12px;">
                        <img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png" alt="VarsityHub" width="72" height="72" style="display:block;border:0;margin:0 auto 16px;">
                        <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Password changed successfully</h1>
                        <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280;">Hi {{name}}, your VarsityHub password was updated on {{date}}.</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 24px;">
                        <table width="100%" role="presentation" style="background-color:#f3f4f6;border-radius:12px;">
                            <tr>
                                <td style="padding:18px 24px;">
                                    <p style="margin:0;font-size:13px;color:#6b7280;">Account email</p>
                                    <p style="margin:4px 0 0;font-size:16px;color:#111827;word-break:break-all;">{{email}}</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:0 32px 24px;">
                        <a href="https://varsityhub.app/security" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 34px;border-radius:999px;font-weight:600;font-size:15px;">Review account activity</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 32px;">
                        <div style="background-color:#fee2e2;border-left:4px solid #ef4444;border-radius:10px;padding:14px 18px;">
                            <p style="margin:0;font-size:13px;color:#7f1d1d;">⚠️ If you did not make this change, reset your password immediately or contact <a href="mailto:support@varsityhub.app" style="color:#dc2626;text-decoration:none;">support@varsityhub.app</a>. We lock suspicious sessions automatically.</p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 32px 8px;border-top:1px solid #f3f4f6;">
                        <p style="margin:0 0 16px;text-align:center;font-size:12px;color:#6b7280;">Follow us on social media</p>
                        <table role="presentation" align="center">
                            <tr>
                                <td style="padding:0 6px;"><a href="https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="32" height="32" alt="Instagram"></a></td>
                                <td style="padding:0 6px;"><a href="https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" width="32" height="32" alt="TikTok"></a></td>
                                <td style="padding:0 6px;"><a href="https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32" alt="YouTube"></a></td>
                                <td style="padding:0 6px;"><a href="https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="32" height="32" alt="Facebook"></a></td>
                                <td style="padding:0 6px;"><a href="https://limeprod.com" target="_blank" rel="noopener"><img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png" width="32" height="32" alt="LimeProd.com"></a></td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:12px 32px 0;text-align:center;font-size:12px;color:#9ca3af;">
                        <a href="https://limeprod.com/VarsityHubPrivacy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 32px;text-align:center;font-size:12px;color:#9ca3af;">
                        © 2025 LIME PRODUCTIONS. All rights reserved.
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

## 3️⃣ Account Recovery – Template `d-36ff36687ae8433ba49ae88e533904d6`
Subject: **Recover your VarsityHub account**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Recovery Confirmed - VarsityHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table width="600" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; max-width: 100%; width: 100%;">
                    <tr>
                        <td style="padding: 0 0 30px; text-align: center;">
                            <img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png" alt="VarsityHub" width="80" height="80" style="display: block; margin: 0 auto; max-width: 80px; height: auto;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 20px; text-align: left;">
                            <p style="margin: 0 0 8px; color: #1f2937; font-size: 16px; line-height: 1.5;">Hi {{USERNAME}},</p>
                            <h1 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: 600; line-height: 1.3;">Your account has been successfully recovered.</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px; text-align: center;">
                            <div style="width: 60px; height: 60px; background-color: #10b981; border-radius: 50%; margin: 0 auto; display: inline-flex; align-items: center; justify-content: center; color: #ffffff; font-size: 32px;">✓</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px; text-align: left;">
                            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600; line-height: 1.5;">Great news! We've successfully verified your identity and restored access to your account.</p>
                            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">You can now log in to VarsityHub using your credentials. If you experience any issues, please don't hesitate to reach out to our support team.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <div style="background-color: #f3f4f6; border-left: 3px solid #10b981; border-radius: 6px; padding: 16px;">
                                <p style="margin: 0 0 8px; color: #1f2937; font-size: 13px; line-height: 1.5;"><strong>Recovered on:</strong> {{RECOVERY_DATE}}</p>
                                <p style="margin: 0; color: #1f2937; font-size: 13px; line-height: 1.5;"><strong>Account Email:</strong> {{ACCOUNT_EMAIL}}</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <div style="background-color: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 16px;">
                                <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600; line-height: 1.5;">⚠️ Didn't request account recovery?</p>
                                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">If you did not request account recovery, please contact us immediately so we can secure your account.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px; text-align: left;">
                            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">Email us at <a href="mailto:support@varsityhub.app" style="color: #10b981; text-decoration: underline;">support@varsityhub.app</a></p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px;">
                            <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                <tr>
                                    <td style="border-top: 1px solid #e5e7eb; font-size: 1px; line-height: 1px;">&nbsp;</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px 10px; text-align: center;">
                            <p style="margin: 0 0 16px; color: #6b7280; font-size: 12px; line-height: 1.5;">Follow us on social media</p>
                            <table role="presentation" align="center">
                                <tr>
                                    <td style="padding:0 6px;"><a href="https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="32" height="32" alt="Instagram" style="display:block;border:0;"></a></td>
                                    <td style="padding:0 6px;"><a href="https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" width="32" height="32" alt="TikTok" style="display:block;border:0;"></a></td>
                                    <td style="padding:0 6px;"><a href="https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32" alt="YouTube" style="display:block;border:0;"></a></td>
                                    <td style="padding:0 6px;"><a href="https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr" target="_blank" rel="noopener"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="32" height="32" alt="Facebook" style="display:block;border:0;"></a></td>
                                    <td style="padding:0 6px;"><a href="https://limeprod.com" target="_blank" rel="noopener"><img src="https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png" width="32" height="32" alt="LimeProd.com" style="display:block;border:0;"></a></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 40px 20px; text-align: center;">
                            <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                                <a href="{{privacy_policy_url}}" style="color: #9ca3af; text-decoration: underline;">Privacy Policy</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; text-align: center; color: #9ca3af;">© 2025 LIME PRODUCTIONS</p>
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

### SendGrid Steps
1. Open each template ID above in **SendGrid → Dynamic Templates**.
2. Replace the HTML with the matching block and click **Save**.
3. Use “Send Test” with the JSON payloads in `sendgrid-templates/test-data/*.json` to confirm buttons + links.  
   - Password Reset JSON: `sendgrid-templates/test-data/password-reset.json`  
   - Password Changed JSON: `sendgrid-templates/test-data/password-changed.json`
4. Once saved, the backend is already pointing at these template IDs, so no code changes are required.
