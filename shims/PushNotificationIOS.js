// Shim for deprecated PushNotificationIOS to prevent errors
// This prevents React Native from trying to load the deprecated module
module.exports = {
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
