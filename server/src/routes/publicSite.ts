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
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub - Privacy Policy</title><style>${pageStyle}</style></head><body><div class="card"><h1>VarsityHub Privacy Policy</h1><p><em>Last updated: July 9, 2026</em></p><h2>1. Introduction</h2><p>This Privacy Policy describes how Lime Productions ("VarsityHub," "we," "us," or "our") collects, uses, and discloses information in connection with the VarsityHub application and related services (the "Service"). By using the Service, you agree to the practices described in this Policy.</p><h2>2. Information We Collect</h2><p><strong>Account Information.</strong> Information you provide when creating or maintaining an account, such as your email address, username, and profile details. You may sign in using your email address or a supported third-party sign-in service.</p><p><strong>Content You Submit.</strong> Posts, photographs, videos, messages, team and event information, and other materials you choose to upload or share through the Service.</p><p><strong>Transaction Information.</strong> Records of purchases and subscriptions. Payments are processed by the applicable app store or our third-party payment processor; we do not receive or store full payment card numbers.</p><p><strong>Technical and Usage Information.</strong> Device and diagnostic information, identifiers, IP address, and browser or device user-agent, along with information about how you interact with the Service, collected to operate, secure, and improve the Service.</p><p><strong>Location Information.</strong> With your permission, approximate location to surface nearby games and events, and, at the moment you use certain location-based posting features, precise device location solely to verify eligibility to use that feature. We do not track your location in the background.</p><h2>3. How We Use Information</h2><p>We use the information we collect to provide, maintain, and improve the Service; process transactions; deliver notifications and communications; personalize your experience; verify eligibility for certain features; maintain the safety and integrity of the Service, including fraud and abuse prevention; and comply with legal obligations.</p><h2>4. How We Share Information</h2><p>We do not sell your personal information. We disclose information only: (a) to service providers performing services on our behalf — such as cloud hosting, media storage, payment processing, analytics, diagnostics, communications delivery, and content safety and automated moderation — under obligations limiting their use of that information; (b) when you choose to share content publicly or with other users; (c) as required by law, legal process, or to protect the rights, property, or safety of VarsityHub, our users, or others; and (d) in connection with a merger, acquisition, or sale of assets, in which case this Policy will continue to apply to your information.</p><h2>5. User Content and Sporting Events</h2><p>VarsityHub is an independent platform and is not affiliated with, endorsed by, or sponsored by any sports league, conference, team, venue, broadcaster, or governing body. Content shared through the Service is created and submitted by users. Each user is solely responsible for the content they record, upload, or share — including recordings made at sporting events — and for complying with applicable laws, venue policies, and third-party rights. Content you share publicly may be viewed, and further shared, by others.</p><h2>6. Data Retention and Deletion</h2><p>We retain personal information for as long as your account is active or as needed to provide the Service and meet legal obligations. You may delete your account at any time in Settings. Upon deletion, personal data associated with your account is anonymized, and residual copies are removed from backup systems within 90 days.</p><h2>7. Your Rights and Choices</h2><p>Subject to applicable law, you may request access to, correction of, deletion of, or a portable copy of your personal information. You may manage location and notification permissions in your device settings at any time. To exercise your rights, contact <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a>.</p><h2>8. Children's Privacy</h2><p>The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. Users between 13 and 17 must have parental or guardian consent to use the Service. If we learn that information has been collected from a child under 13, we will delete it promptly.</p><h2>9. Security</h2><p>We use commercially reasonable administrative, technical, and physical safeguards designed to protect your information, including encryption of data in transit. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p><h2>10. International Users</h2><p>The Service is operated from the United States. If you access the Service from outside the United States, you understand that your information will be transferred to, stored, and processed in the United States.</p><h2>11. Changes to This Policy</h2><p>We may update this Policy from time to time. If we make material changes, we will provide notice through the Service or by other reasonable means. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.</p><h2>12. Contact</h2><p>Questions about this Policy or requests concerning your information: <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a><br>To report content: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p><p>&copy; 2025 Lime Productions. All rights reserved.</p></div></body></html>`
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

export { publicSiteRouter };
