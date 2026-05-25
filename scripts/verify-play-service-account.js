#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function resolveConfig() {
  const eas = readJson('eas.json');
  const app = readJson('app.json');
  const serviceAccountKeyPath = eas?.submit?.production?.android?.serviceAccountKeyPath;
  const packageName = app?.expo?.android?.package;

  if (!serviceAccountKeyPath) {
    console.error('eas.json is missing submit.production.android.serviceAccountKeyPath');
    process.exit(1);
  }

  if (!packageName) {
    console.error('app.json is missing expo.android.package');
    process.exit(1);
  }

  return {
    packageName,
    keyPath: path.resolve(root, serviceAccountKeyPath),
    configuredKeyPath: serviceAccountKeyPath,
  };
}

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let output = '';
      res.on('data', (chunk) => {
        output += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = output ? JSON.parse(output) : null;
        } catch {
          parsed = output;
        }
        resolve({ status: res.statusCode || 0, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function main() {
  const { packageName, keyPath, configuredKeyPath } = resolveConfig();

  if (!fs.existsSync(keyPath)) {
    console.error(`Configured Play service account key is missing: ${configuredKeyPath}`);
    process.exit(1);
  }

  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (!key.client_email || !key.private_key) {
    console.error(`${configuredKeyPath} is missing required service account fields`);
    process.exit(1);
  }

  if (key.client_email.includes('-compute@developer.gserviceaccount.com')) {
    console.error(
      `Configured Play service account is a default compute account: ${key.client_email}`
    );
    console.error(
      `Create a dedicated Play service account, link it in Play Console API access, and replace ${configuredKeyPath}.`
    );
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode(claim)}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(input), key.private_key)
    .toString('base64url');
  const assertion = `${input}.${signature}`;
  const tokenBody =
    'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + assertion;

  const tokenRes = await requestJson(
    {
      method: 'POST',
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(tokenBody),
      },
    },
    tokenBody
  );

  if (tokenRes.status !== 200 || !tokenRes.body?.access_token) {
    console.error('Failed to mint Android Publisher access token');
    console.error(JSON.stringify(tokenRes.body, null, 2));
    process.exit(1);
  }

  const editRes = await requestJson({
    method: 'POST',
    hostname: 'androidpublisher.googleapis.com',
    path: `/androidpublisher/v3/applications/${packageName}/edits`,
    headers: {
      authorization: `Bearer ${tokenRes.body.access_token}`,
    },
  });

  if (editRes.status === 200 && editRes.body?.id) {
    console.log(`Play service account can access Android Publisher edits for ${packageName}`);
    process.exit(0);
  }

  console.error(`Play Android Publisher access check failed for ${packageName}`);
  console.error(`HTTP ${editRes.status}`);
  console.error(JSON.stringify(editRes.body, null, 2));
  console.error(
    `Grant the service account Play Console app access for ${packageName}, or replace ${configuredKeyPath} with a linked service account key.`
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
