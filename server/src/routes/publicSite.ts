import express, { type Request, type Response, Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const publicSiteRouter = Router();
const MARKETING_SITE_URL = 'https://varsityhub.app/';
const FALLBACK_WEB_APP_ORIGIN = 'https://www.varsityhub.app';
const FALLBACK_WEB_HOSTS = ['varsityhub.app', 'www.varsityhub.app'];
const WEB_APP_REDIRECT_PATHS = new Set([
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/reset',
  '/create-team',
  '/manage-users',
  '/organizations',
  '/organization-invites',
  '/request-join-organization',
]);

const pageStyle = `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1F2937;line-height:1.6;background:#F8FAFC}h1{color:#1B3A6B;margin-bottom:8px}h2{color:#2563EB;margin-top:24px}a{color:#2563EB}.card{background:#fff;border:1px solid #E5E7EB;border-radius:18px;padding:28px 24px;box-shadow:0 12px 32px rgba(15,23,42,.08)}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.btn{display:inline-block;background:#1B3A6B;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600}.btn-secondary{background:#EFF6FF;color:#1D4ED8}.meta{font-size:14px;color:#64748B;margin-top:20px}`;

function renderLandingPage() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub</h1><p>The home for teams, events, and sports communities.</p><p>The web app bundle is not available on this deployment yet. Privacy and support pages are still online.</p><div class="actions"><a class="btn" href="/support">Support</a><a class="btn btn-secondary" href="/privacy-policy">Privacy Policy</a></div><p class="meta">Deploy the exported web bundle to this host to replace this fallback shell.</p></div></body></html>`;
}

let cachedWebAppOriginKey: string | null = null;
let cachedWebAppOrigin: string | null = null;
let cachedWebHostsKey: string | null = null;
let cachedWebHosts: Set<string> | null = null;
let cachedWebDistDirKey: string | null = null;
let cachedWebDistDir: string | null | undefined;
let cachedIndexHtmlPathKey: string | null = null;
let cachedIndexHtmlPath: string | null | undefined;

function getWebAppOrigin(): string {
  const raw = process.env.WEB_APP_ORIGIN?.trim();
  const cacheKey = raw || '';
  if (cachedWebAppOrigin !== null && cachedWebAppOriginKey === cacheKey) return cachedWebAppOrigin;
  cachedWebAppOriginKey = cacheKey;
  cachedWebAppOrigin = raw ? raw.replace(/\/+$/, '') : FALLBACK_WEB_APP_ORIGIN;
  return cachedWebAppOrigin;
}

function getWebHosts(): Set<string> {
  const raw = process.env.PUBLIC_WEB_HOSTS || process.env.WEB_HOSTS || '';
  if (cachedWebHosts && cachedWebHostsKey === raw) return cachedWebHosts;
  cachedWebHostsKey = raw;
  const configured = raw
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
  cachedWebHosts = new Set(configured.length > 0 ? configured : FALLBACK_WEB_HOSTS);
  return cachedWebHosts;
}

function normalizeHostname(hostname: string | undefined): string {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function isWebHost(hostname: string | undefined): boolean {
  return getWebHosts().has(normalizeHostname(hostname));
}

function shouldRedirectToCanonicalWebHost(req: Request): boolean {
  if (!isWebHost(req.hostname)) return false;
  try {
    return (
      normalizeHostname(req.hostname) !== normalizeHostname(new URL(getWebAppOrigin()).hostname)
    );
  } catch {
    return false;
  }
}

function redirectToCanonicalWebHost(req: Request, res: Response): void {
  res.redirect(308, `${getWebAppOrigin()}${req.originalUrl}`);
}

function getWebDistDir(): string | null {
  const configured = process.env.WEB_DIST_DIR?.trim() || '';
  if (cachedWebDistDir !== undefined && cachedWebDistDirKey === configured) {
    return cachedWebDistDir;
  }
  cachedWebDistDirKey = configured;
  const candidates = [
    configured || undefined,
    path.resolve(process.cwd(), 'web-dist'),
    path.resolve(process.cwd(), '../web-dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), '../dist'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue through candidates.
    }
  }

  cachedWebDistDir = null;
  return cachedWebDistDir;
}

function getIndexHtmlPath(distDir: string): string {
  return path.join(distDir, 'index.html');
}

function getResolvedIndexHtmlPath(): string | null {
  const distDir = getWebDistDir();
  const cacheKey = distDir || 'none';
  if (cachedIndexHtmlPath !== undefined && cachedIndexHtmlPathKey === cacheKey) {
    return cachedIndexHtmlPath;
  }
  cachedIndexHtmlPathKey = cacheKey;
  if (!distDir) {
    cachedIndexHtmlPath = null;
    return cachedIndexHtmlPath;
  }
  const indexHtmlPath = getIndexHtmlPath(distDir);
  cachedIndexHtmlPath = fs.existsSync(indexHtmlPath) ? indexHtmlPath : null;
  return cachedIndexHtmlPath;
}

function canServeWebDist(): boolean {
  return Boolean(getResolvedIndexHtmlPath());
}

function shouldKeepServerPage(pathname: string): boolean {
  return (
    pathname === '/privacy-policy' ||
    pathname === '/terms-of-service' ||
    pathname === '/dmca' ||
    pathname === '/support' ||
    pathname === '/account-deletion'
  );
}

function shouldRedirectToWebApp(pathname: string): boolean {
  return WEB_APP_REDIRECT_PATHS.has(pathname) || pathname.startsWith('/organizations/');
}

function maybeRedirectToWebApp(req: Request, res: Response): boolean {
  if (isWebHost(req.hostname) && canServeWebDist()) {
    return false;
  }
  if (!shouldRedirectToWebApp(req.path)) return false;

  const targetOrigin = getWebAppOrigin();
  try {
    const targetHost = new URL(targetOrigin).hostname;
    if (req.hostname === targetHost) return false;
  } catch {
    return false;
  }

  res.redirect(307, `${targetOrigin}${req.originalUrl}`);
  return true;
}

const serveWebAssets = (() => {
  let cachedDir: string | null = null;
  let cachedMiddleware:
    | ((req: Request, res: Response, next: (err?: unknown) => void) => void)
    | null = null;

  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    const distDir = getWebDistDir();
    if (!distDir) return next();

    if (!cachedMiddleware || cachedDir !== distDir) {
      cachedDir = distDir;
      cachedMiddleware = express.static(distDir, {
        extensions: ['html'],
        index: false,
      });
    }

    return cachedMiddleware(req, res, next);
  };
})();

publicSiteRouter.use((req, res, next) => {
  if (!isWebHost(req.hostname)) return next();
  if (shouldRedirectToCanonicalWebHost(req)) {
    return redirectToCanonicalWebHost(req, res);
  }
  if (!canServeWebDist()) return next();
  return serveWebAssets(req, res, next);
});

publicSiteRouter.get('/', (req, res) => {
  if (isWebHost(req.hostname)) {
    const indexHtmlPath = getResolvedIndexHtmlPath();
    if (indexHtmlPath) {
      return res.redirect(307, '/feed');
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(renderLandingPage());
    return;
  }

  res.redirect(308, MARKETING_SITE_URL);
});

publicSiteRouter.get('*', (req, res, next) => {
  const indexHtmlPath = getResolvedIndexHtmlPath();
  if (isWebHost(req.hostname) && indexHtmlPath && !shouldKeepServerPage(req.path)) {
    return res.sendFile(indexHtmlPath);
  }
  if (isWebHost(req.hostname) && !canServeWebDist() && !shouldKeepServerPage(req.path)) {
    if (maybeRedirectToWebApp(req, res)) return;
    res.setHeader('Content-Type', 'text/html');
    res.send(renderLandingPage());
    return;
  }
  if (maybeRedirectToWebApp(req, res)) return;
  next();
});

publicSiteRouter.get('/privacy-policy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Privacy Policy</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub Privacy Policy</h1><p><em>Last updated: July 6, 2026</em></p><h2>1. Introduction</h2><p>This Privacy Policy describes how Lime Productions ("VarsityHub," "we," "us," or "our") collects, uses, and discloses information in connection with the VarsityHub application and related services (the "Service"). By using the Service, you agree to the practices described in this Policy.</p><h2>2. Information We Collect</h2><p><strong>Account Information.</strong> Information you provide when creating or maintaining an account, such as your email address, username, and profile details. You may sign in using your email address or a supported third-party sign-in service.</p><p><strong>Content You Submit.</strong> Posts, photographs, videos, messages, team and event information, and other materials you choose to upload or share through the Service.</p><p><strong>Transaction Information.</strong> Records of purchases and subscriptions. Payments are processed by the applicable app store or our third-party payment processor; we do not receive or store full payment card numbers.</p><p><strong>Technical and Usage Information.</strong> Device and diagnostic information, identifiers, and information about how you interact with the Service, collected to operate, secure, and improve the Service.</p><p><strong>Location Information.</strong> With your permission, approximate location to surface nearby games and events, and, at the moment you use certain location-based posting features, precise device location solely to verify eligibility to use that feature. We do not track your location in the background.</p><h2>3. How We Use Information</h2><p>We use the information we collect to provide, maintain, and improve the Service; process transactions; deliver notifications and communications; personalize your experience; verify eligibility for certain features; maintain the safety and integrity of the Service, including fraud and abuse prevention; and comply with legal obligations.</p><h2>4. How We Share Information</h2><p>We do not sell your personal information. We disclose information only: (a) to service providers performing services on our behalf — such as cloud hosting, media storage, payment processing, analytics, diagnostics, and communications delivery — under obligations limiting their use of that information; (b) when you choose to share content publicly or with other users; (c) as required by law, legal process, or to protect the rights, property, or safety of VarsityHub, our users, or others; and (d) in connection with a merger, acquisition, or sale of assets, in which case this Policy will continue to apply to your information.</p><h2>5. User Content and Sporting Events</h2><p>VarsityHub is an independent platform and is not affiliated with, endorsed by, or sponsored by any sports league, conference, team, venue, broadcaster, or governing body. Content shared through the Service is created and submitted by users. Each user is solely responsible for the content they record, upload, or share — including recordings made at sporting events — and for complying with applicable laws, venue policies, and third-party rights. Content you share publicly may be viewed, and further shared, by others.</p><h2>6. Data Retention and Deletion</h2><p>We retain personal information for as long as your account is active or as needed to provide the Service and meet legal obligations. You may delete your account at any time in Settings. Upon deletion, personal data associated with your account is anonymized, and residual copies are removed from backup systems within 90 days.</p><h2>7. Your Rights and Choices</h2><p>Subject to applicable law, you may request access to, correction of, deletion of, or a portable copy of your personal information. You may manage location and notification permissions in your device settings at any time. To exercise your rights, contact <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a>.</p><h2>8. Children's Privacy</h2><p>The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. Users between 13 and 17 must have parental or guardian consent to use the Service. If we learn that information has been collected from a child under 13, we will delete it promptly.</p><h2>9. Security</h2><p>We use commercially reasonable administrative, technical, and physical safeguards designed to protect your information, including encryption of data in transit. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p><h2>10. International Users</h2><p>The Service is operated from the United States. If you access the Service from outside the United States, you understand that your information will be transferred to, stored, and processed in the United States.</p><h2>11. Changes to This Policy</h2><p>We may update this Policy from time to time. If we make material changes, we will provide notice through the Service or by other reasonable means. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.</p><h2>12. Contact</h2><p>Questions about this Policy or requests concerning your information: <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a><br>To report content: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
  );
});

publicSiteRouter.get('/support', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Support</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub Support</h1><p>Need help? We are here for you.</p><h2>Contact Us</h2><p><strong>Customer Service</strong> (account, billing, subscriptions):<br><a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a></p><p><strong>Report Content or Users</strong> (abuse, moderation, safety issues):<br><a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p><h2>Common Topics</h2><ul><li><strong>Account issues:</strong> password reset, email verification, account deletion</li><li><strong>Team management:</strong> creating teams, inviting members, managing rosters</li><li><strong>Subscriptions:</strong> upgrading, downgrading, billing questions</li><li><strong>Content:</strong> reporting abuse or content issues</li><li><strong>Technical:</strong> app crashes, bugs, feature requests</li></ul><p>We typically respond within 24 hours.</p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
  );
});

publicSiteRouter.get('/account-deletion', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Account Deletion</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub Account Deletion</h1><p>To delete your VarsityHub account and all associated data, please follow the steps below.</p><h2>How to Delete Your Account</h2><p>You can delete your account directly in the app:</p><ol><li>Open the VarsityHub app</li><li>Go to <strong>Settings</strong></li><li>Tap <strong>Account</strong></li><li>Tap <strong>Delete Account</strong> and confirm</li></ol><p>Your personal data is anonymized immediately, and residual backup copies are purged within 90 days, in accordance with our <a href="/privacy-policy">Privacy Policy</a>.</p><h2>Need Help?</h2><p>If you are unable to access the app, contact us at <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a> and we will process your deletion request manually.</p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
  );
});

publicSiteRouter.get('/terms-of-service', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Terms of Service</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub Terms of Service</h1><p><em>Last updated: March 25, 2026</em></p><h2>1. Agreement</h2><p>By using VarsityHub you agree to these Terms. If you disagree, do not use the app. You must be 13 or older to use VarsityHub.</p><h2>2. The Service</h2><p>VarsityHub lets you create/manage sports teams, schedule games, share content, and access premium features via paid subscriptions.</p><h2>3. Your Account</h2><p>Provide accurate info. Keep your credentials secure. You are responsible for all activity on your account. Do not share accounts.</p><h2>4. Rules</h2><p>Do not: post illegal, abusive, or harassing content; impersonate others; upload content you don't own; spam; interfere with the app; bully or threaten users; share others' private info; or upload broadcast/official sports footage.</p><h2>5. Content</h2><p>You own your content. By posting, you grant us a license to display it in the app. All fan content must be personally filmed from your own vantage point. Official broadcast content (ESPN, CBS, Fox, NBC, etc.) is prohibited. VarsityHub has no affiliation with any league, conference, or broadcast partner.</p><h2>6. Subscriptions</h2><p>Rookie: Free (4 teams). Veteran: $0.99/month per team over 4. Legend: $19.99/year unlimited. Auto-renew unless cancelled. Payments via Apple IAP (iOS), Google Play (Android), or Stripe. Refunds case-by-case. Cancel anytime in Settings.</p><h2>7. Ads</h2><p>Advertisers promote via our Ad Calendar. Ads must comply with content guidelines. We may reject or remove any ad.</p><h2>8. DMCA</h2><p>We are a registered DMCA Designated Service Provider (No. DMCA-1070362). Takedown notices: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a>. Response within 24 hours. Second violation = permanent ban. See our <a href="/dmca">Copyright &amp; DMCA</a> page for the full process.</p><h2>9. Termination</h2><p>We may suspend or terminate accounts that violate these Terms. Upon termination: access stops, content may be deleted, payment obligations remain.</p><h2>10. Disclaimers &amp; Liability</h2><p>The app is provided "AS IS." We are not liable for indirect or consequential damages. Total liability capped at what you paid us in the past 12 months. You indemnify us against claims from your use or content.</p><h2>11. Disputes</h2><p>Governed by Connecticut law. Disputes resolved via binding arbitration (small claims excepted). Class action waiver applies.</p><h2>12. Changes</h2><p>We may update these Terms. Material changes notified via app or email. Continued use = acceptance.</p><h2>Contact</h2><p>Customer service: <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a><br>Report content or users: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
  );
});

publicSiteRouter.get('/dmca', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Copyright &amp; DMCA</title><style>${pageStyle}</style></head><body><div class="card"><h1>Copyright &amp; DMCA</h1><h2>DMCA Designated Service Provider</h2><p>VarsityHub is registered with the U.S. Copyright Office as a DMCA Designated Service Provider (Registration No. DMCA-1070362).</p><h2>Report Copyright Infringement</h2><p>To report copyright infringement, contact our Designated Agent:</p><p>Name: Emil Mancero-Sanchez<br>Organization: VarsityHub LLC<br>Email: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a><br>Website: varsityhub.app<br>Location: Stamford, Connecticut, United States</p><h2>What to Include</h2><p>Your notice must include:</p><ol><li>Identification of the copyrighted work you claim is infringed</li><li>The specific URL of the infringing content on VarsityHub</li><li>Your name, address, phone number, and email</li><li>A statement of good faith belief that the use is unauthorized</li><li>A statement under penalty of perjury that you are authorized to act on behalf of the rights holder</li></ol><h2>Response &amp; Enforcement</h2><p>VarsityHub will respond within 24 hours and remove infringing content promptly. Repeat infringers are permanently banned.</p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
  );
});

export { publicSiteRouter };
