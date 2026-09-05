#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { isIP } = require('node:net');

function remoteHttpsUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid production HTTPS URL`);
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  if (
    url.protocol !== 'https:' ||
    isIP(host) ||
    !host.includes('.') ||
    /(^|\.)(localhost|local|internal|test|example|invalid)$/.test(host) ||
    /(^|\.)example\.(com|net|org)$/.test(host)
  ) {
    throw new Error(`${name} must use a public production HTTPS hostname`);
  }
  return url;
}

async function main() {
  const [executable, ...args] = process.argv.slice(2);
  if (!executable) throw new Error('Usage: with-production-client-env.js <executable> [args...]');

  // EAS Update does not apply build.production.env. Reuse only its public
  // client defaults; credentials and build-only controls stay in their own env.
  const defaults = require('../eas.json').build.production.env;
  for (const [key, value] of Object.entries(defaults)) {
    if (key.startsWith('EXPO_PUBLIC_') && !process.env[key]?.trim()) {
      process.env[key] = String(value);
    }
  }
  process.env.NODE_ENV = 'production';
  process.env.EXPO_PUBLIC_NODE_ENV = 'production';
  process.env.EXPO_NO_DOTENV = '1';

  // Validate the effective Expo config, including the existing API/flag
  // defaults, rather than introducing another set of fallback URLs.
  const { extra } = require('../app.config.js')({ config: require('../app.json').expo });
  const api = remoteHttpsUrl(extra.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
  if (api.username || api.password || api.search || api.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must not contain credentials, a query or a fragment');
  }
  const truthy = value => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  const falsy = value => ['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
  if (!truthy(extra.EXPO_PUBLIC_FORCE_REMOTE_API) || !falsy(extra.EXPO_PUBLIC_USE_LOCAL_API)) {
    throw new Error('Production requires force-remote API enabled and local API disabled');
  }
  const dsn = remoteHttpsUrl(extra.EXPO_PUBLIC_SENTRY_DSN, 'EXPO_PUBLIC_SENTRY_DSN');
  if (
    !/^[a-f0-9]{32}$/i.test(dsn.username) ||
    dsn.password ||
    !dsn.hostname.endsWith('.sentry.io') ||
    !/^\/\d+$/.test(dsn.pathname) ||
    dsn.search ||
    dsn.hash
  ) {
    throw new Error('EXPO_PUBLIC_SENTRY_DSN must be a valid Sentry project DSN');
  }

  let stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!stripeKey) {
    let paymentConfig;
    try {
      const response = await fetch(`${api.href.replace(/\/$/, '')}/payments/config`, {
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Payment config unavailable');
      paymentConfig = await response.json();
    } catch {
      throw new Error(
        'Could not load production payment configuration; release command was not started'
      );
    }
    if (paymentConfig.stripe_configured !== true || paymentConfig.payments_enabled !== true) {
      throw new Error('Production API does not report enabled Stripe payments');
    }
    stripeKey = paymentConfig.stripe_publishable_key;
  }
  if (typeof stripeKey !== 'string' || !/^pk_live_[a-zA-Z0-9]{16,}$/.test(stripeKey)) {
    throw new Error('Production requires a live Stripe publishable key');
  }
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = stripeKey;

  const child = spawn(executable, args, { shell: false, stdio: 'inherit', env: process.env });
  const forwardInt = () => child.kill('SIGINT');
  const forwardTerm = () => child.kill('SIGTERM');
  const clearSignals = () => {
    process.off('SIGINT', forwardInt);
    process.off('SIGTERM', forwardTerm);
  };
  process.on('SIGINT', forwardInt);
  process.on('SIGTERM', forwardTerm);
  child.once('error', () => {
    clearSignals();
    console.error('[production-client-env] Could not start release command');
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    clearSignals();
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

main().catch(error => {
  console.error(`[production-client-env] ${error.message}`);
  process.exitCode = 1;
});
