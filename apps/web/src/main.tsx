import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './App';
import { catalogApi, store } from './app/store';
import { ConfigProvider, webConfig } from './config';
import { CatalogApiProvider } from './features/catalog/catalog-api.context';
import './styles.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <ConfigProvider value={webConfig}>
      <Provider store={store}>
        <CatalogApiProvider api={catalogApi}>
          <App />
        </CatalogApiProvider>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
);
