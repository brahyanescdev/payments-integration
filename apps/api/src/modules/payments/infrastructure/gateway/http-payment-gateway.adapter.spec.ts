import { HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';

const SETTINGS = {
  baseUrl: 'https://psp.example.test/v1',
  publicKey: 'pub_test_123',
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

describe('HttpPaymentGatewayAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps the merchant response into acceptance tokens', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(merchantPayload), { status: 200 }));

    const adapter = new HttpPaymentGatewayAdapter(SETTINGS);
    const tokens = (await adapter.getAcceptanceTokens())._unsafeUnwrap();

    expect(tokens.publicKey).toBe('pub_test_123');
    expect(tokens.acceptance).toEqual({ token: 'acc_token', permalink: 'https://psp.test/terms' });
    expect(tokens.personalDataAuthorization).toEqual({
      token: 'priv_token',
      permalink: 'https://psp.test/privacy',
    });
  });

  it('requests the merchant endpoint keyed by the configured public key, never the private one', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(merchantPayload), { status: 200 }));

    await new HttpPaymentGatewayAdapter(SETTINGS).getAcceptanceTokens();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://psp.example.test/v1/merchants/pub_test_123',
      expect.objectContaining({ signal: expect.anything() }),
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
