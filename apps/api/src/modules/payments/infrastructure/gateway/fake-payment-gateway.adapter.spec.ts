import { FakePaymentGatewayAdapter } from './fake-payment-gateway.adapter';

describe('FakePaymentGatewayAdapter', () => {
  it('returns deterministic, well-formed acceptance tokens', async () => {
    const adapter = new FakePaymentGatewayAdapter();

    const tokens = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

    expect(tokens.acceptance.token).toBeTruthy();
    expect(tokens.acceptance.permalink).toMatch(/^https?:\/\//);
    expect(tokens.personalDataAuthorization.token).toBeTruthy();
  });

  it('returns the exact same values on every call, so tests never see flaky data', async () => {
    const adapter = new FakePaymentGatewayAdapter();

    const first = (await adapter.getAcceptanceTokens())._unsafeUnwrap();
    const second = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

    expect(first).toEqual(second);
  });
});
