import { createContext, useContext, type ReactNode } from 'react';

import type { CatalogApi } from './catalogApi';

const CatalogApiContext = createContext<CatalogApi | null>(null);

/**
 * Supplies the one `catalogApi` instance whose reducer is mounted in the active
 * Redux store.
 *
 * RTK Query's generated hooks are bound to the specific `createApi()` call they
 * came from — dispatching one instance's actions into a different instance's
 * reducer is unsupported, even if both were built from the same factory. A
 * component that imported a module-level singleton directly would break under
 * tests, which build their own throwaway store per render. Context keeps the pair
 * (store, api) created together in exactly one place — `app/store.ts` in
 * production, `testing/render.tsx` in tests — and components ask for "the current
 * api" instead of assuming which one that is.
 */
export function CatalogApiProvider({ api, children }: { api: CatalogApi; children: ReactNode }) {
  return <CatalogApiContext.Provider value={api}>{children}</CatalogApiContext.Provider>;
}

/** @throws Error when called outside a {@link CatalogApiProvider}. */
export function useCatalogApi(): CatalogApi {
  const api = useContext(CatalogApiContext);

  if (api === null) {
    throw new Error('useCatalogApi must be used within a CatalogApiProvider.');
  }

  return api;
}
