/**
 * Reactotron — local debug console for API calls, state, and navigation.
 * Only active in __DEV__ mode. Never runs in production builds.
 *
 * Setup:
 *  1. Download Reactotron desktop app from https://github.com/infinitered/reactotron/releases
 *  2. On a physical device, set HOST below to your machine's LAN IP (e.g. 192.168.1.100)
 *     Find it with: ifconfig | grep "inet " (Mac) or ipconfig (Windows)
 *  3. Run the app — events appear in the Reactotron desktop window in real time
 */

import Reactotron, {
  asyncStorage,
  networking,
} from 'reactotron-react-native';

// ─── CHANGE THIS to your machine's LAN IP when testing on a physical device ───
const REACTOTRON_HOST = '192.168.1.100';
// ────────────────────────────────────────────────────────────────────────────────

if (__DEV__) {
  Reactotron.configure({
    name: 'VarsityHub',
    host: REACTOTRON_HOST,
    port: 9090,
  })
    .useReactNative({
      networking: {
        // Ignore noise — health checks and asset fetches
        ignoreUrls: /\/health$|\.png|\.jpg|\.svg|\.ttf|\.woff/,
      },
    })
    .use(asyncStorage())
    .use(networking())
    .connect();

  // Make Reactotron available globally in DEV so you can call
  //   console.tron.log('hello') from anywhere in the codebase.
  (console as any).tron = Reactotron;

  // Clear Reactotron between reloads for a clean slate
  Reactotron.clear?.();
}
