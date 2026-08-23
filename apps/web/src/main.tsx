import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { App } from './App';
import { catalogApi, checkoutApi, persistor, store } from './app/store';
import { ConfigProvider, webConfig } from './config';
import { CatalogApiProvider } from './features/catalog/catalog-api.context';
import { CheckoutApiProvider } from './features/checkout/checkout-api.context';
import './styles.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <ConfigProvider value={webConfig}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <CatalogApiProvider api={catalogApi}>
            <CheckoutApiProvider api={checkoutApi}>
              <App />
            </CheckoutApiProvider>
          </CatalogApiProvider>
        </PersistGate>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
);
