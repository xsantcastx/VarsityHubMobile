const noopAsync = async () => ({ status: 'undetermined' });

const Notifications = {
  AndroidImportance: { MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  addNotificationResponseReceivedListener: () => ({
    remove: () => {},
  }),
  getPermissionsAsync: noopAsync,
  requestPermissionsAsync: noopAsync,
  setNotificationChannelAsync: async () => undefined,
};

export default Notifications as any;
