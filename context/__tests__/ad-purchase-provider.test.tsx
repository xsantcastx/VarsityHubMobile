import React from 'react';
import { act, create } from 'react-test-renderer';
import { AdPurchaseProvider, useAdPurchaseContext } from '../AdPurchaseProvider';
import { createAdIntent, recoverAdReceipt, reconcileAdIntents } from '@/lib/adPurchaseRecovery';

let mockOwner = 'account-a';
let mockCallbacks: any;
let mockPurchases: any[] = [];
const mockPending = jest.fn(async () => mockPurchases);
const mockRequest = jest.fn(async () => undefined);
const mockFinish = jest.fn(async () => undefined);
const mockFetch = jest.fn(async () => undefined);
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-constants', () => ({ executionEnvironment: 'standalone' }));
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: { id: mockOwner } }) }));
jest.mock('react-native-iap', () => ({
  useIAP: (callbacks: any) => {
    mockCallbacks = callbacks;
    return {
      connected: true,
      products: [],
      requestPurchase: mockRequest,
      finishTransaction: mockFinish,
      fetchProducts: mockFetch,
    };
  },
  getPendingTransactionsIOS: () => mockPending(),
}));
jest.mock('@/lib/adPurchaseRecovery', () => ({
  createAdIntent: jest.fn(),
  recoverAdReceipt: jest.fn(),
  reconcileAdIntents: jest.fn(async () => undefined),
}));
jest.mock('@/lib/adVerificationQueue', () => ({
  flushPendingAdVerifications: jest.fn(async () => undefined),
  hasPendingAdVerification: jest.fn(async () => false),
}));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));
let value: ReturnType<typeof useAdPurchaseContext>;
function Child() {
  value = useAdPurchaseContext();
  return null;
}
const intent: any = {
  id: 'intent-a',
  ad_id: 'ad-a',
  status: 'pending',
  items: [
    { sku: 'MOND_THURS', remaining: 0 },
    { sku: 'FRI_SUN', remaining: 1 },
  ],
};
const flush = async () => {
  for (let n = 0; n < 20; n++) await Promise.resolve();
};
beforeEach(() => {
  jest.clearAllMocks();
  mockOwner = 'account-a';
  mockPurchases = [];
  mockPending.mockReset().mockImplementation(async () => mockPurchases);
});
it('recovers receipts on sign-in without charging an unpaid remaining product', async () => {
  mockPurchases = [{ id: 'tx-a', productId: 'MOND_THURS', appAccountToken: intent.id }];
  jest.mocked(recoverAdReceipt).mockResolvedValue(intent);
  let tree: any;
  await act(async () => {
    tree = create(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  expect(recoverAdReceipt).toHaveBeenCalledTimes(1);
  expect(reconcileAdIntents).toHaveBeenCalled();
  expect(mockRequest).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it('creates a durable intent before checkout and charges only the remaining product', async () => {
  let persisted!: (value: any) => void;
  jest.mocked(createAdIntent).mockImplementation(
    () =>
      new Promise(resolve => {
        persisted = resolve;
      })
  );
  let tree: any;
  await act(async () => {
    tree = create(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  let checkout: Promise<any>;
  await act(async () => {
    checkout = value.purchaseAd({
      adId: 'ad-a',
      dates: ['2026-09-11'],
      weekdayBlocks: 1,
      weekendBlocks: 1,
    });
    await flush();
  });
  expect(mockRequest).not.toHaveBeenCalled();
  await act(async () => {
    persisted(intent);
    await flush();
  });
  expect(mockRequest).toHaveBeenCalledWith({
    type: 'in-app',
    request: { apple: { sku: 'FRI_SUN', quantity: 1, appAccountToken: intent.id } },
  });
  let accepted!: (value: any) => void;
  jest.mocked(recoverAdReceipt).mockImplementation(
    () =>
      new Promise(resolve => {
        accepted = resolve;
      })
  );
  await act(async () => {
    for (let i = 0; i < 5; i++)
      mockCallbacks.onPurchaseSuccess({
        id: 'tx-b',
        productId: 'FRI_SUN',
        appAccountToken: intent.id,
      });
    await flush();
  });
  expect(recoverAdReceipt).toHaveBeenCalledTimes(1);
  await act(async () => {
    accepted({ ...intent, status: 'completed' });
    await flush();
  });
  await expect(checkout!).resolves.toEqual({ ok: true });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it('does not start a store charge when the account changes during intent creation', async () => {
  let persisted!: (value: any) => void;
  jest.mocked(createAdIntent).mockImplementation(
    () =>
      new Promise(resolve => {
        persisted = resolve;
      })
  );
  let tree: any;
  await act(async () => {
    tree = create(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  let checkout: Promise<any>;
  await act(async () => {
    checkout = value.purchaseAd({ adId: 'ad-a', dates: [], weekdayBlocks: 1, weekendBlocks: 1 });
    await flush();
  });
  await act(async () => {
    mockOwner = 'account-b';
    tree.update(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  await act(async () => {
    persisted(intent);
    await flush();
  });
  expect(mockRequest).not.toHaveBeenCalled();
  await expect(checkout!).resolves.toMatchObject({ ok: false });
  act(() => tree.unmount());
});

it('starts recovery for a newly signed-in account after superseded recovery finishes', async () => {
  let release!: (value: any[]) => void;
  mockPending.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = resolve;
      })
  );
  let tree: any;
  await act(async () => {
    tree = create(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  await act(async () => {
    mockOwner = 'account-b';
    tree.update(
      <AdPurchaseProvider>
        <Child />
      </AdPurchaseProvider>
    );
    await flush();
  });
  await act(async () => {
    release([]);
    await flush();
  });
  expect(mockPending).toHaveBeenCalledTimes(2);
  expect(reconcileAdIntents).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
