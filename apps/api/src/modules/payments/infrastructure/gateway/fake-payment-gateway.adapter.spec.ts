import { FakePaymentGatewayAdapter } from './fake-payment-gateway.adapter';

const CHARGE_INPUT = {
  reference: 'TX-1',
  amountInCents: 1_000_000,
  currency: 'COP',
  customerEmail: 'ana@example.com',
  acceptanceToken: 'acc',
  acceptPersonalAuthToken: 'priv',
  installments: 1,
};

describe('FakePaymentGatewayAdapter', () => {
  const adapter = new FakePaymentGatewayAdapter({ apiBasePath: '/api/v1' });

  describe('getAcceptanceTokens', () => {
    it('returns deterministic, well-formed acceptance tokens', async () => {
      const tokens = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

      expect(tokens.acceptance.token).toBeTruthy();
      expect(tokens.acceptance.permalink).toMatch(/^https?:\/\//);
      expect(tokens.personalDataAuthorization.token).toBeTruthy();
    });

    it('points the tokenisation URL at our own dev-tokenize stub, under the configured API prefix', async () => {
      const tokens = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

      expect(tokens.tokenizationUrl).toBe('/api/v1/checkout/dev-tokenize');
    });

    it('returns the exact same values on every call, so tests never see flaky data', async () => {
      const first = (await adapter.getAcceptanceTokens())._unsafeUnwrap();
      const second = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

      expect(first).toEqual(second);
    });
  });

  describe('chargeCard', () => {
    it('approves a token minted for a card ending in 4242, mirroring the real sandbox test card', async () => {
      const result = (
        await adapter.chargeCard({ ...CHARGE_INPUT, cardToken: 'tok_fake_4242_abc123' })
      )._unsafeUnwrap();

      expect(result.status).toBe('APPROVED');
      expect(result.failureReason).toBeNull();
      expect(result.gatewayTransactionId).toContain(CHARGE_INPUT.reference);
    });

    it('declines a token minted for a card ending in 1111, mirroring the real sandbox test card', async () => {
      const result = (
        await adapter.chargeCard({ ...CHARGE_INPUT, cardToken: 'tok_fake_1111_abc123' })
      )._unsafeUnwrap();

      expect(result.status).toBe('DECLINED');
      expect(result.failureReason).not.toBeNull();
    });

    it('errors for any other card, matching the real sandbox convention', async () => {
      const result = (
        await adapter.chargeCard({ ...CHARGE_INPUT, cardToken: 'tok_fake_9999_abc123' })
      )._unsafeUnwrap();

      expect(result.status).toBe('ERROR');
    });

    it('fails with GatewayUnavailable for a token this adapter did not itself issue', async () => {
      const error = (
        await adapter.chargeCard({ ...CHARGE_INPUT, cardToken: 'tok_prod_real_xyz' })
      )._unsafeUnwrapErr();

      expect(error.kind).toBe('GatewayUnavailable');
    });
  });

  describe('getTransactionStatus', () => {
    it('fails with GatewayUnavailable: every fake charge resolves synchronously, so there is never a status to poll', async () => {
      const error = (await adapter.getTransactionStatus('fake_gw_TX-1'))._unsafeUnwrapErr();

      expect(error.kind).toBe('GatewayUnavailable');
    });
  });
});
