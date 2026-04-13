export const AD_IAP_PRODUCT_IDS = {
  weekday: 'MOND_THURS',
  weekend: 'FRI_SUN',
} as const;

export function useAdIAP() {
  return {
    connected: false,
    products: [],
    purchasing: false,
    error: null,
    purchaseAd: async () => ({
      ok: false,
      error: 'Ad IAP is not available on web.',
    }),
    getProduct: () => undefined,
  };
}
