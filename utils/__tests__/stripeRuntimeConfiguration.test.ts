import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
  jest.dontMock('@stripe/stripe-react-native');
});

function loadAdapter(sdk: Record<string, unknown>) {
  jest.resetModules();
  jest.doMock('@stripe/stripe-react-native', () => ({
    StripeProvider: ({ children }: any) => children,
    usePaymentSheet: () => ({}),
    ...sdk,
  }));
  return require('../stripe.native-shared') as typeof import('../stripe.native-shared');
}

describe('Stripe runtime configuration adapter', () => {
  it('dispatches only the resolved publishable key through the public SDK', async () => {
    const initialize = jest.fn(async (_params: unknown) => {});
    const adapter = loadAdapter({ initStripe: initialize });
    await adapter.initStripe({ publishableKey: 'pk_live_local_fixture' });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith({ publishableKey: 'pk_live_local_fixture' });
  });

  it.each([undefined, 'not callable'])(
    'rejects an unavailable SDK initialization function (%s)',
    async initStripe => {
      const adapter = loadAdapter({ initStripe });
      await expect(adapter.initStripe({ publishableKey: 'pk_live_local_fixture' })).rejects.toThrow(
        'Stripe initialization is unavailable'
      );
    }
  );

  it('propagates SDK rejection so checkout cannot create an intent', async () => {
    const failure = new Error('SDK initialization failed');
    const adapter = loadAdapter({
      initStripe: jest.fn(async () => {
        throw failure;
      }),
    });
    await expect(adapter.initStripe({ publishableKey: 'pk_live_local_fixture' })).rejects.toBe(
      failure
    );
  });

  it.each(['ios', 'web'])(
    'keeps native Stripe initialization unavailable on %s',
    async platform => {
      const adapter = platform === 'ios' ? require('../stripe.ios') : require('../stripe.web');
      await expect(adapter.initStripe({ publishableKey: 'pk_live_local_fixture' })).rejects.toThrow(
        'unavailable on this platform'
      );
      await expect(adapter.usePaymentSheet().initPaymentSheet()).resolves.toMatchObject({
        error: { code: 'Unavailable' },
      });
    }
  );
});
