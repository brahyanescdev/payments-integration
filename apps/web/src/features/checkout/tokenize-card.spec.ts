import { http, HttpResponse } from 'msw';

import { server } from '../../testing/msw/server';
import { resolveTokenizationUrl, tokenizeCard } from './tokenize-card';

const CARD_INPUT = {
  cardNumber: '4242424242424242',
  cvc: '123',
  expMonth: '12',
  expYear: '29',
  cardHolder: 'Ana Perez',
};

describe('resolveTokenizationUrl', () => {
  it('resolves a path relative to the API origin, dropping the API base path', () => {
    expect(
      resolveTokenizationUrl('/api/v1/checkout/dev-tokenize', 'http://localhost:3000/api/v1'),
    ).toBe('http://localhost:3000/api/v1/checkout/dev-tokenize');
  });

  it('leaves an absolute gateway URL untouched', () => {
    expect(
      resolveTokenizationUrl(
        'https://sandbox.psp.example/v1/tokens/cards',
        'http://localhost:3000/api/v1',
      ),
    ).toBe('https://sandbox.psp.example/v1/tokens/cards');
  });
});

describe('tokenizeCard', () => {
  it('sends the raw card fields with the public key, and returns the token and last four', async () => {
    let receivedAuth: string | null = null;
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      http.post('https://gateway.test/tokens', async ({ request }) => {
        receivedAuth = request.headers.get('Authorization');
        receivedBody = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json({
          status: 'CREATED',
          data: { id: 'tok_abc', last_four: '4242' },
        });
      }),
    );

    const result = await tokenizeCard('https://gateway.test/tokens', 'pub_test', CARD_INPUT);

    expect(receivedAuth).toBe('Bearer pub_test');
    expect(receivedBody).toEqual({
      number: '4242424242424242',
      cvc: '123',
      exp_month: '12',
      exp_year: '29',
      card_holder: 'Ana Perez',
    });
    expect(result).toEqual({ token: 'tok_abc', lastFour: '4242' });
  });

  it('throws when the gateway rejects the tokenisation request', async () => {
    server.use(
      http.post('https://gateway.test/tokens', () =>
        HttpResponse.json({ error: { messages: { number: ['is invalid'] } } }, { status: 422 }),
      ),
    );

    await expect(
      tokenizeCard('https://gateway.test/tokens', 'pub_test', CARD_INPUT),
    ).rejects.toThrow('No pudimos tokenizar la tarjeta.');
  });
});
