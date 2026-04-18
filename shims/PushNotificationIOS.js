/**
 * Empty shim for @react-native-community/push-notification-ios
 * Referenced by metro.config.js extraNodeModules but never imported in app code.
 * Exists as a safety net in case a transitive dependency tries to resolve it.
 */
const noop = () => {};

module.exports = {
  addEventListener: noop,
  removeEventListener: noop,
  requestPermissions: async () => ({}),
  abandonPermissions: noop,
  checkPermissions: (cb) => cb({ alert: false, badge: false, sound: false }),
  getScheduledLocalNotifications: (cb) => cb([]),
  presentLocalNotification: noop,
  scheduleLocalNotification: noop,
  cancelAllLocalNotifications: noop,
  cancelLocalNotifications: noop,
  getInitialNotification: async () => null,
  getDeliveredNotifications: (cb) => cb([]),
  removeDeliveredNotifications: noop,
  removeAllDeliveredNotifications: noop,
  setApplicationIconBadgeNumber: noop,
  getApplicationIconBadgeNumber: (cb) => cb(0),
};
