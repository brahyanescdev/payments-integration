import { configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { ConfigProvider } from '../config/config.context';
import type { WebConfig } from '../config/web-config';
import { CatalogApiProvider } from '../features/catalog/catalog-api.context';
import { createCatalogApi } from '../features/catalog/catalogApi';
import { CheckoutApiProvider } from '../features/checkout/checkout-api.context';
import { createCheckoutApi } from '../features/checkout/checkoutApi';
import checkoutReducer, { type CheckoutState } from '../features/checkout/checkoutSlice';
import { makeWebConfig } from './config.fixture';

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  config?: WebConfig;
  /** Seeds the store's `checkout` slice, for tests that need the modal already open. */
  preloadedState?: { checkout?: Partial<CheckoutState> };
}

/**
 * Renders a component behind the same providers `main.tsx` mounts: configuration,
 * the Redux store and both API contexts.
 *
 * Every screen from here on reads from RTK Query or from `useConfig`, so a plain
 * `render()` would throw before the component's own logic ever ran. A fresh store
 * is built per call, so tests never share cached query state — and unlike
 * `main.tsx`, the checkout reducer is used unwrapped, without `redux-persist`:
 * persistence writes to real `localStorage` asynchronously, which would leak
 * across tests for no benefit here. The requirement it satisfies — a reload mid
 * checkout restores the step — is proven against a real browser by the
 * Playwright suite instead.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions = {},
): RenderResult & { store: EnhancedStore } {
  const { config = makeWebConfig(), preloadedState, ...renderOptions } = options;
  const catalogApi = createCatalogApi(config.apiBaseUrl);
  const checkoutApi = createCheckoutApi(config.apiBaseUrl);
  const store = configureStore({
    reducer: {
      [catalogApi.reducerPath]: catalogApi.reducer,
      [checkoutApi.reducerPath]: checkoutApi.reducer,
      checkout: checkoutReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(catalogApi.middleware, checkoutApi.middleware),
    preloadedState:
      preloadedState?.checkout !== undefined
        ? {
            checkout: {
              ...checkoutReducer(undefined, { type: '@@INIT' }),
              ...preloadedState.checkout,
            },
          }
        : undefined,
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ConfigProvider value={config}>
        <Provider store={store}>
          <CatalogApiProvider api={catalogApi}>
            <CheckoutApiProvider api={checkoutApi}>{children}</CheckoutApiProvider>
          </CatalogApiProvider>
        </Provider>
      </ConfigProvider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
