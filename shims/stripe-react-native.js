// Web shim for @stripe/stripe-react-native (native-only module)
const noop = () => {};
const noopHook = () => ({});

module.exports = {
  StripeProvider: ({ children }) => children,
  usePaymentSheet: () => ({
    initPaymentSheet: noop,
    presentPaymentSheet: noop,
  }),
  useStripe: noopHook,
};
