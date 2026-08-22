import { configureStore } from '@reduxjs/toolkit';

import { createCatalogApi } from '../features/catalog/catalogApi';
import { webConfig } from '../config';

/**
 * The application's single Redux store.
 *
 * Composition root, not logic: excluded from coverage the same way the backend
 * excludes its Nest modules and `main.ts`. RTK Query's generated hooks are what the
 * rest of the app actually imports; this file only wires the one instance they read
 * from.
 */
export const catalogApi = createCatalogApi(webConfig.apiBaseUrl);

export const store = configureStore({
  reducer: {
    [catalogApi.reducerPath]: catalogApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(catalogApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
