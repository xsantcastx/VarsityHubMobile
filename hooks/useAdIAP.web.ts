/**
 * useAdIAP — Web stub.
 * IAP is not available on web. This stub provides the same interface
 * so that components importing useAdIAP don't break the Metro web bundle.
 */

export const AD_IAP_PRODUCT_IDS = {
  weekday: 'MOND_THURS',
  weekend: 'FRI_SUN',
} as const;

export function useAdIAP() {
  return {
    connected: false,
    products: [] as any[],
    purchasing: false,
    error: 'IAP is not available on web' as string | null,
    purchaseAd: async (_params: {
      adId: string;
      dates: string[];
      weekdayBlocks: number;
      weekendBlocks: number;
    }) => ({ ok: false, error: 'IAP is not available on web' }),
    getProduct: (_type: 'weekday' | 'weekend') => undefined as any,
  };
}
