// Ensure __extends exists before loading sentry-expo (Hermes/Metro may omit helpers)
const g = global as any;
if (typeof g.__extends !== 'function') {
  g.__extends = function (d: any, b: any) {
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(d, b);
    } else {
      // fallback for older runtimes
      (d as any).__proto__ = b;
    }
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new (__ as any)());
  };
}

// Ensure tslib export exists for modules that expect require('tslib').__extends
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tslibMod = require('tslib');
if (tslibMod && typeof tslibMod.__extends !== 'function') {
  tslibMod.__extends = g.__extends;
}

// Use require so the helper is in place before sentry-expo executes
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sentry = require('sentry-expo');

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Initialize Sentry only if DSN is provided
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    enableInExpoDevelopment: true,
    debug: __DEV__,
  });
}
