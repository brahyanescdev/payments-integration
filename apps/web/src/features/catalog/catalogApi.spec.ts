import { API_ROUTES } from '@payments/shared';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';

import { server } from '../../testing/msw/server';
import { createCatalogApi } from './catalogApi';

describe('createCatalogApi', () => {
  it('fetches the catalogue from the configured base URL', async () => {
    server.use(
      http.get('http://api.example.test/products', () =>
        HttpResponse.json({ items: [], total: 0 }),
      ),
    );

    const catalogApi = createCatalogApi('http://api.example.test');
    const store = configureStore({
      reducer: { [catalogApi.reducerPath]: catalogApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(catalogApi.middleware),
    });

    const result = await store.dispatch(catalogApi.endpoints.listProducts.initiate());

    expect(result.data).toEqual({ items: [], total: 0 });
  });

  it(`requests exactly "${API_ROUTES.products.list}" under the configured base URL`, async () => {
    let requestedUrl: string | undefined;
    server.use(
      http.get('http://api.example.test/products', ({ request }) => {
        requestedUrl = request.url;

        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    const catalogApi = createCatalogApi('http://api.example.test');
    const store = configureStore({
      reducer: { [catalogApi.reducerPath]: catalogApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(catalogApi.middleware),
    });

    await store.dispatch(catalogApi.endpoints.listProducts.initiate());

    expect(requestedUrl).toBe('http://api.example.test/products');
  });

  it('surfaces a failed request as an error result rather than throwing', async () => {
    server.use(
      http.get('http://api.example.test/products', () => new HttpResponse(null, { status: 500 })),
    );

    const catalogApi = createCatalogApi('http://api.example.test');
    const store = configureStore({
      reducer: { [catalogApi.reducerPath]: catalogApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(catalogApi.middleware),
    });

    const result = await store.dispatch(catalogApi.endpoints.listProducts.initiate());

    expect(result.error).toBeDefined();
  });
});
