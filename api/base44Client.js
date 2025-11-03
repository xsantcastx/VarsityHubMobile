import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
const rawClient = createClient({
  appId: "6882fc92fd0a7f42af271770",
  // On native, automatic redirect to login isn't supported; we handle auth in-app.
  requiresAuth: false,
});

// Guard against accidental access to service-role getter in web dev
// Some tooling may enumerate or shallow-clone the client, which would invoke
// the `asServiceRole` getter and throw if no serviceToken is configured.
export const base44 = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'asServiceRole') return undefined;
    return Reflect.get(target, prop, receiver);
  },
  has(target, prop) {
    if (prop === 'asServiceRole') return false;
    return prop in target;
  },
  ownKeys(target) {
    return Reflect.ownKeys(target).filter((k) => k !== 'asServiceRole');
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === 'asServiceRole') {
      return { configurable: true, enumerable: false, value: undefined, writable: false };
    }
    return Object.getOwnPropertyDescriptor(target, prop);
  },
});
