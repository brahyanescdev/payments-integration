import { createContext, useContext, type ReactNode } from 'react';

import type { CheckoutApi } from './checkoutApi';

const CheckoutApiContext = createContext<CheckoutApi | null>(null);

/**
 * Supplies the one `checkoutApi` instance whose reducer is mounted in the active
 * Redux store. See `CatalogApiProvider` for why this indirection exists rather
 * than importing a module-level singleton directly.
 */
export function CheckoutApiProvider({ api, children }: { api: CheckoutApi; children: ReactNode }) {
  return <CheckoutApiContext.Provider value={api}>{children}</CheckoutApiContext.Provider>;
}

/** @throws Error when called outside a {@link CheckoutApiProvider}. */
export function useCheckoutApi(): CheckoutApi {
  const api = useContext(CheckoutApiContext);

  if (api === null) {
    throw new Error('useCheckoutApi must be used within a CheckoutApiProvider.');
  }

  return api;
}
