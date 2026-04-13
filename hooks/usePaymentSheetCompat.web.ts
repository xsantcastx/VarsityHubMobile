export function usePaymentSheet() {
  return {
    initPaymentSheet: async () => ({
      error: {
        code: 'Unavailable',
        message: 'PaymentSheet is not available on web.',
      },
    }),
    presentPaymentSheet: async () => ({
      error: {
        code: 'Unavailable',
        message: 'PaymentSheet is not available on web.',
      },
    }),
  };
}
