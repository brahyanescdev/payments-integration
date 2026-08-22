import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_ROUTES, type ProductListDto } from '@payments/shared';

/**
 * Builds the catalogue API slice for a given backend origin.
 *
 * A factory rather than a module-level singleton so the base URL is an explicit
 * parameter: the real store supplies it from the validated runtime configuration,
 * and tests supply a fixture value. Neither has to touch `import.meta.env`, which
 * is what lets this file — unlike `config/index.ts` — be imported freely from Jest.
 */
export function createCatalogApi(baseUrl: string) {
  return createApi({
    reducerPath: 'catalogApi',
    baseQuery: fetchBaseQuery({ baseUrl }),
    endpoints: (builder) => ({
      listProducts: builder.query<ProductListDto, void>({
        query: () => API_ROUTES.products.list,
      }),
    }),
  });
}

export type CatalogApi = ReturnType<typeof createCatalogApi>;
