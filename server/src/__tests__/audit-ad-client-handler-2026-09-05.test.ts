/**
 * Execute the actual ad-calendar handlePayment arrow extracted with TypeScript's
 * AST. This tests handler control flow with mocked UI/provider boundaries; it is
 * not a mounted device/browser test and does not duplicate its implementation.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const path = resolve(process.cwd(), '../app/ad-calendar.tsx');
const source = ts.createSourceFile(
  path,
  readFileSync(path, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
let handlerSource = '';
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === 'handlePayment' &&
    node.initializer
  ) {
    handlerSource = node.initializer.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
const executable = ts.transpileModule(`const handler = ${handlerSource};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(platform: string, response: unknown = { free: true }) {
  const deps = {
    paymentsTemporarilyDisabled: false,
    adId: 'caaaaaaaaaaaaaaaaaaaaaaaa',
    selected: new Set(['2026-09-10']),
    promo: platform === 'web' ? 'FULLCOMP' : '',
    preview: null,
    Platform: { OS: platform },
    getDatesOutsideBookingWindow: () => ({ past: [], future: [] }),
    setDirty: jest.fn(),
    setSubmitting: jest.fn(),
    httpPost: jest.fn(async () => response),
    Alert: { alert: jest.fn() },
    captureBreadcrumb: jest.fn(),
    __DEV__: false,
    getConfig: jest.fn(() => ({ stripePublishableKey: '' })),
    Payments: { getConfig: jest.fn(async () => ({ stripe_publishable_key: '' })) },
    initStripe: jest.fn(async (_options: { publishableKey: string }) => {}),
    initPaymentSheet: jest.fn(async () => ({})),
    presentPaymentSheet: jest.fn(async () => ({})),
    globalThis: { location: { assign: jest.fn() } },
    purchaseAd: jest.fn(async () => ({ ok: true })),
    router: { replace: jest.fn() },
    totalCents: 0,
    getAdBlocks: () => ({ weekdayBlocks: 1, weekendBlocks: 0 }),
  };
  const handler = new Function(...Object.keys(deps), executable + '\nreturn handler;')(
    ...Object.values(deps)
  );
  return { deps, handler };
}

describe('ad checkout acceptance from actual ad calendar payment handler', () => {
  it('web confirms a successfully activated fully complimentary campaign', async () => {
    const { deps, handler } = setup('web');
    await handler();
    expect(deps.httpPost).toHaveBeenCalledWith(
      '/payments/checkout',
      expect.objectContaining({ promo_code: 'FULLCOMP' })
    );
    expect(deps.Alert.alert).not.toHaveBeenCalled();
    expect(deps.initStripe).not.toHaveBeenCalled();
    expect(deps.router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/ad-confirmation',
        params: expect.objectContaining({ totalAmount: '$0.00 (promo)' }),
      })
    );
  });

  it('iOS Apple ad checkout succeeds independently of Stripe configuration', async () => {
    const { deps, handler } = setup('ios');
    await handler();
    expect(deps.Payments.getConfig).not.toHaveBeenCalled();
    expect(deps.initStripe).not.toHaveBeenCalled();
    expect(deps.purchaseAd).toHaveBeenCalled();
    expect(deps.Alert.alert).not.toHaveBeenCalled();
    expect(deps.router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/ad-confirmation' })
    );
  });

  it('Android dispatches SDK configuration with the fallback key before creating an intent', async () => {
    const { deps, handler } = setup('android', {
      paymentIntent: 'pi_fixture_secret',
      amount_cents: 499,
    });
    deps.Payments.getConfig.mockResolvedValue({ stripe_publishable_key: 'pk_live_fixture' });
    let releaseSdkCall!: () => void;
    deps.initStripe.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          releaseSdkCall = resolve;
        })
    );
    const pending = handler();
    await Promise.resolve();
    expect(deps.initStripe).toHaveBeenCalledWith({ publishableKey: 'pk_live_fixture' });
    expect(deps.httpPost).not.toHaveBeenCalled();
    releaseSdkCall();
    await pending;
    expect(deps.httpPost).toHaveBeenCalledWith(
      '/payments/create-payment-sheet',
      expect.objectContaining({ ad_id: deps.adId })
    );
    expect(deps.initPaymentSheet).toHaveBeenCalled();
    expect(deps.presentPaymentSheet).toHaveBeenCalled();
    expect(deps.Alert.alert).not.toHaveBeenCalled();
  });

  it('Android SDK configuration failure surfaces before any intent or sheet is created', async () => {
    const { deps, handler } = setup('android', { paymentIntent: 'pi_fixture_secret' });
    deps.Payments.getConfig.mockResolvedValue({ stripe_publishable_key: 'pk_live_fixture' });
    deps.initStripe.mockRejectedValue(new Error('Stripe initialization unavailable'));
    await handler();
    expect(deps.httpPost).not.toHaveBeenCalled();
    expect(deps.initPaymentSheet).not.toHaveBeenCalled();
    expect(deps.Alert.alert).toHaveBeenCalledWith('Error', 'Stripe initialization unavailable');
    expect(deps.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it.each(['missing key', 'configuration request failed'])(
    'Android fails closed for %s',
    async failure => {
      const { deps, handler } = setup('android', { paymentIntent: 'pi_fixture_secret' });
      if (failure === 'configuration request failed')
        deps.Payments.getConfig.mockRejectedValue(new Error('offline'));
      await handler();
      expect(deps.initStripe).not.toHaveBeenCalled();
      expect(deps.httpPost).not.toHaveBeenCalled();
      expect(deps.Alert.alert).toHaveBeenCalledWith('Payments Not Ready', expect.any(String));
    }
  );

  it('Android with a bundled key keeps the normal provider and PaymentSheet path', async () => {
    const { deps, handler } = setup('android', {
      paymentIntent: 'pi_fixture_secret',
      amount_cents: 499,
    });
    deps.getConfig.mockReturnValue({ stripePublishableKey: 'pk_live_bundled_fixture' });
    await handler();
    expect(deps.Payments.getConfig).not.toHaveBeenCalled();
    expect(deps.initStripe).not.toHaveBeenCalled();
    expect(deps.initPaymentSheet).toHaveBeenCalled();
    expect(deps.presentPaymentSheet).toHaveBeenCalled();
    expect(deps.Alert.alert).not.toHaveBeenCalled();
  });

  it('paid web checkout follows the server URL without native Stripe initialization', async () => {
    const { deps, handler } = setup('web', { url: 'https://checkout.stripe.com/fixture' });
    await handler();
    expect(deps.globalThis.location.assign).toHaveBeenCalledWith(
      'https://checkout.stripe.com/fixture'
    );
    expect(deps.Payments.getConfig).not.toHaveBeenCalled();
    expect(deps.initStripe).not.toHaveBeenCalled();
    expect(deps.initPaymentSheet).not.toHaveBeenCalled();
  });
});
