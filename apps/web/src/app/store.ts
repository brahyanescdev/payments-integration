import { configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import { createCatalogApi } from '../features/catalog/catalogApi';
import { createCheckoutApi } from '../features/checkout/checkoutApi';
import checkoutReducer from '../features/checkout/checkoutSlice';
import { webConfig } from '../config';

/**
 * The application's single Redux store.
 *
 * Composition root, not logic: excluded from coverage the same way the backend
 * excludes its Nest modules and `main.ts`. RTK Query's generated hooks are what
 * the rest of the app actually imports; this file only wires the one instances
 * they read from.
 */
export const catalogApi = createCatalogApi(webConfig.apiBaseUrl);
export const checkoutApi = createCheckoutApi(webConfig.apiBaseUrl);

/**
 * Persists the in-progress checkout across a reload.
 *
 * No `blacklist`/`whitelist` for card data is needed here: `checkoutSlice`'s own
 * state shape never holds a raw card number, expiry or CVC — only brand and last
 * four digits — so there is nothing sensitive for this to accidentally persist.
 */
const persistedCheckoutReducer = persistReducer({ key: 'checkout', storage }, checkoutReducer);

export const store = configureStore({
  reducer: {
    [catalogApi.reducerPath]: catalogApi.reducer,
    [checkoutApi.reducerPath]: checkoutApi.reducer,
    checkout: persistedCheckoutReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist dispatches non-serialisable actions during (re)hydration;
      // this is the standard, documented way to keep RTK's serializability check
      // from flagging them as errors.
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }).concat(catalogApi.middleware, checkoutApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
