type NotificationResponseListener = (response: unknown) => void;

const noopAsync = async () => {};

const Notifications = {
  AndroidImportance: {
    DEFAULT: 'default',
    MAX: 'max',
  },
  AndroidNotificationVisibility: {
    PUBLIC: 'public',
  },
  addNotificationResponseReceivedListener: (_listener: NotificationResponseListener) => ({
    remove() {},
  }),
  getPermissionsAsync: async () => ({ status: 'denied' as const }),
  requestPermissionsAsync: async () => ({ status: 'denied' as const }),
  setNotificationChannelAsync: noopAsync,
};

export default Notifications;
