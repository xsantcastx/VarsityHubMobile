// Web shim for react-native-iap (native-only module)
const noop = () => {};

module.exports = {
  useIAP: () => ({
    connected: false,
    products: [],
    subscriptions: [],
    availablePurchases: [],
    currentPurchase: undefined,
    currentPurchaseError: undefined,
    finishTransaction: noop,
    getProducts: noop,
    getSubscriptions: noop,
    getAvailablePurchases: noop,
    requestPurchase: noop,
    requestSubscription: noop,
    fetchProducts: noop,
  }),
  getReceiptIOS: async () => '',
  getAvailablePurchases: async () => [],
  restorePurchases: async () => {},
  initConnection: async () => true,
  endConnection: noop,
  setup: noop,
};
