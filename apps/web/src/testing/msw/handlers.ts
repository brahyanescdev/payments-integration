import { API_ROUTES } from '@payments/shared';
import { http, HttpResponse } from 'msw';

import { makeProductDto } from '../product.fixture';

/**
 * Default network behaviour for every test.
 *
 * Matches any origin ending in "/products" rather than a fixed URL, so it works
 * whatever base URL the test's store was built with, and no handler has to know
 * it. Individual specs override with `server.use(...)` for the states they
 * actually want to exercise (empty catalogue, a failure, a specific product).
 */
export const handlers = [
  http.get(`*/${API_ROUTES.products.list}`, () =>
    HttpResponse.json({
      items: [
        makeProductDto({ id: '11111111-1111-4111-8111-000000000001', sku: 'AAA', name: 'Alfa' }),
        makeProductDto({ id: '11111111-1111-4111-8111-000000000002', sku: 'BBB', name: 'Beta' }),
      ],
      total: 2,
    }),
  ),
  http.get(`*/${API_ROUTES.checkout.acceptanceTokens}`, () =>
    HttpResponse.json({
      publicKey: 'pub_test_key',
      tokenizationUrl: '/api/v1/checkout/dev-tokenize',
      acceptance: { token: 'acc_token', permalink: 'https://example.test/acceptance' },
      personalDataAuthorization: {
        token: 'auth_token',
        permalink: 'https://example.test/data-auth',
      },
    }),
  ),
  http.post('*/checkout/dev-tokenize', async ({ request }) => {
    const body = (await request.json()) as { number: string };
    const lastFour = body.number.slice(-4);

    return HttpResponse.json({
      status: 'CREATED',
      data: { id: `tok_fake_${lastFour}_test`, last_four: lastFour },
    });
  }),
];
