// Web shim for expo-haptics (native-only module)
// Haptics are not available on web — all methods are silent no-ops.
const noop = () => Promise.resolve();

module.exports = {
  // Impact feedback
  impactAsync: noop,
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  // Selection feedback
  selectionAsync: noop,
  // Notification feedback
  notificationAsync: noop,
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
};
