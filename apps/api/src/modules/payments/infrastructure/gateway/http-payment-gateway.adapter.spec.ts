import { createHash } from 'node:crypto';

import { HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';

const SETTINGS = {
  baseUrl: 'https://psp.example.test/v1',
  publicKey: 'pub_test_123',
  privateKey: 'prv_test_456',
  integritySecret: 'int_test_789',
  timeoutMs: 1000,
};

const merchantPayload = {
  data: {
    presigned_acceptance: { acceptance_token: 'acc_token', permalink: 'https://psp.test/terms' },
    presigned_personal_data_auth: {
      acceptance_token: 'priv_token',
      permalink: 'https://psp.test/privacy',
    },
  },
};

const CHARGE_INPUT = {
  reference: 'TX-1',
  amountInCents: 1_000_000,
  currency: 'COP',
  customerEmail: 'ana@example.com',
  cardToken: 'tok_test_123',
  acceptanceToken: 'acc',
  acceptPersonalAuthToken: 'priv',
  installments: 1,
};

describe('HttpPaymentGatewayAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getAcceptanceTokens', () => {
    it('maps the merchant response into acceptance tokens', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(merchantPayload), { status: 200 }));

      const adapter = new HttpPaymentGatewayAdapter(SETTINGS);
      const tokens = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

      expect(tokens.publicKey).toBe('pub_test_123');
      expect(tokens.tokenizationUrl).toBe('https://psp.example.test/v1/tokens/cards');
      expect(tokens.acceptance).toEqual({
        token: 'acc_token',
        permalink: 'https://psp.test/terms',
      });
    });

    it('requests the merchant endpoint keyed by the public key, never the private one', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(merchantPayload), { status: 200 }));

      await new HttpPaymentGatewayAdapter(SETTINGS).getAcceptanceTokens();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://psp.example.test/v1/merchants/pub_test_123',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer pub_test_123' }),
        }),
      );
    });

    it('maps a non-2xx response to GatewayUnavailable rather than throwing', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 503 }));

      const error = (
        await new HttpPaymentGatewayAdapter(SETTINGS).getAcceptanceTokens()
      )._unsafeUnwrapErr();

      expect(error.kind).toBe('GatewayUnavailable');
      expect(error.message).toMatch(/503/);
    });

    it('maps a network failure to GatewayUnavailable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      const error = (
        await new HttpPaymentGatewayAdapter(SETTINGS).getAcceptanceTokens()
      )._unsafeUnwrapErr();

      expect(error.kind).toBe('GatewayUnavailable');
      expect(error.message).toMatch(/network down/);
    });
  });

  describe('chargeCard', () => {
    const chargeResponse = (status: string) =>
      new Response(JSON.stringify({ data: { id: 'gw_1', status, status_message: null } }), {
        status: 201,
      });

    it('submits the charge with the private key and the computed integrity signature', async () => {
      global.fetch = jest.fn().mockResolvedValue(chargeResponse('PENDING'));

      await new HttpPaymentGatewayAdapter(SETTINGS).chargeCard(CHARGE_INPUT);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { signature: string };
      const expectedSignature = createHash('sha256')
        .update(
          `${CHARGE_INPUT.reference}${CHARGE_INPUT.amountInCents}${CHARGE_INPUT.currency}${SETTINGS.integritySecret}`,
        )
        .digest('hex');

      expect(url).toBe('https://psp.example.test/v1/transactions');
      expect((options.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${SETTINGS.privateKey}`,
      );
      expect(body.signature).toBe(expectedSignature);
    });

    it('maps the gateway transaction id and a still-pending status', async () => {
      global.fetch = jest.fn().mockResolvedValue(chargeResponse('PENDING'));

      const result = (
        await new HttpPaymentGatewayAdapter(SETTINGS).chargeCard(CHARGE_INPUT)
      )._unsafeUnwrap();

      expect(result).toEqual({
        gatewayTransactionId: 'gw_1',
        status: 'PENDING',
        failureReason: null,
      });
    });

    it('maps an immediate terminal status when the gateway resolves inline', async () => {
      global.fetch = jest.fn().mockResolvedValue(chargeResponse('APPROVED'));

      const result = (
        await new HttpPaymentGatewayAdapter(SETTINGS).chargeCard(CHARGE_INPUT)
      )._unsafeUnwrap();

      expect(result.status).toBe('APPROVED');
    });

    it('falls back to ERROR for a status the domain does not model', async () => {
      global.fetch = jest.fn().mockResolvedValue(chargeResponse('UNKNOWN_FUTURE_STATUS'));

      const result = (
        await new HttpPaymentGatewayAdapter(SETTINGS).chargeCard(CHARGE_INPUT)
      )._unsafeUnwrap();

      expect(result.status).toBe('ERROR');
    });

    it('maps a non-2xx response to GatewayUnavailable', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 422 }));

      const error = (
        await new HttpPaymentGatewayAdapter(SETTINGS).chargeCard(CHARGE_INPUT)
      )._unsafeUnwrapErr();

      expect(error.kind).toBe('GatewayUnavailable');
    });
  });
});
