import { configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { ConfigProvider } from '../config/config.context';
import { CatalogApiProvider } from '../features/catalog/catalog-api.context';
import type { WebConfig } from '../config/web-config';
import { createCatalogApi } from '../features/catalog/catalogApi';
import { makeWebConfig } from './config.fixture';

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  config?: WebConfig;
}

/**
 * Renders a component behind the same providers `main.tsx` mounts: configuration
 * and the Redux store.
 *
 * Every screen from here on reads from RTK Query or from `useConfig`, so a plain
 * `render()` would throw before the component's own logic ever ran. Centralised
 * here once rather than repeated per test file — the store built is a fresh
 * instance per call, so tests never share cached query state.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions = {},
): RenderResult & { store: EnhancedStore } {
  const { config = makeWebConfig(), ...renderOptions } = options;
  const catalogApi = createCatalogApi(config.apiBaseUrl);
  const store = configureStore({
    reducer: { [catalogApi.reducerPath]: catalogApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(catalogApi.middleware),
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ConfigProvider value={config}>
        <Provider store={store}>
          <CatalogApiProvider api={catalogApi}>{children}</CatalogApiProvider>
        </Provider>
      </ConfigProvider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
