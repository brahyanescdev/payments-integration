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
];
