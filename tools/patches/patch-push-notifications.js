#!/usr/bin/env node
/**
 * Patches React Native's index.js to prevent PushNotificationIOS from being loaded
 * This prevents the "new NativeEventEmitter() requires a non-null argument" error
 */

const fs = require('fs');
const path = require('path');

const reactNativeIndexPath = path.join(
  __dirname,
  '../../node_modules/react-native/index.js'
);

if (!fs.existsSync(reactNativeIndexPath)) {
  console.log('[patch-push-notifications] React Native not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(reactNativeIndexPath, 'utf8');

// Check if already patched
if (content.includes('// PATCHED: PushNotificationIOS removed')) {
  console.log('[patch-push-notifications] Already patched');
  process.exit(0);
}

// Replace the PushNotificationIOS getter with a stub
const original = `  get PushNotificationIOS() {
    warnOnce(
      'pushNotificationIOS-moved',
      'PushNotificationIOS has been extracted from react-native core and will be removed in a future release. ' +
        "It can now be installed and imported from '@react-native-community/push-notification-ios' instead of 'react-native'. " +
        'See https://github.com/react-native-push-notification/ios',
    );
    return require('./Libraries/PushNotificationIOS/PushNotificationIOS')
      .default;
  },`;

const replacement = `  // PATCHED: PushNotificationIOS removed to prevent NativeEventEmitter errors
  get PushNotificationIOS() {
    return {
      addEventListener: () => ({ remove: () => {} }),
      removeEventListener: () => {},
      requestPermissions: () => Promise.resolve({}),
      getInitialNotification: () => Promise.resolve(null),
      getDeliveredNotifications: () => Promise.resolve([]),
      removeDeliveredNotifications: () => {},
      removeAllDeliveredNotifications: () => {},
      setApplicationIconBadgeNumber: () => {},
      getApplicationIconBadgeNumber: () => Promise.resolve(0),
      cancelAllLocalNotifications: () => {},
      cancelLocalNotifications: () => {},
      getScheduledLocalNotifications: () => Promise.resolve([]),
      scheduleLocalNotification: () => {},
      presentLocalNotification: () => {},
      addListener: () => ({ remove: () => {} }),
      removeListeners: () => {},
    };
  },`;

if (content.includes(original)) {
  content = content.replace(original, replacement);
  fs.writeFileSync(reactNativeIndexPath, content, 'utf8');
  console.log('[patch-push-notifications] ✅ Patched React Native index.js');
} else {
  console.log('[patch-push-notifications] ⚠️  Pattern not found, React Native may have changed');
}
