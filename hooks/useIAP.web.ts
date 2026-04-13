export const IAP_PRODUCT_IDS = {
  veteran: 'MIDTIER',
  legend: 'TOPTIER',
} as const;

export function useVHubIAP() {
  return {
    connected: false,
    subscriptions: [],
    purchasing: false,
    error: null,
    purchase: async () => false,
    getProduct: () => undefined,
    restore: async () => false,
  };
}
