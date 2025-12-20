# SendGrid Click Tracking Fix

## Branded link tracking (preferred)
1) In SendGrid, go to Settings → Tracking → Click Tracking.
2) Add a branded domain (e.g., `email.varsityhub.app`). SendGrid will provide a CNAME target like `u123456.wl.sendgrid.net`.
3) Create the CNAME in DNS for the chosen subdomain. Wait for propagation.
4) Return to SendGrid and verify the branded domain. Once verified, links will be wrapped with the branded host instead of the failing `urlxxxx.varsityhub.app` host.
5) After verification, you may re-enable click tracking for templates if desired.

## Security emails
- Password reset and password changed templates now set `data-analytics="false"` on every anchor to bypass SendGrid link wrapping for these security flows.
- Keep click tracking off for these templates even after branding is configured unless there is a compliance need to re-enable it.

## Testing
- Send a test from each template after DNS verification.
- Confirm links resolve directly (no `Safari can’t find the server`), and that the branded tracking host works if enabled.
