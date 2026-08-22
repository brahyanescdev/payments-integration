import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ConfigProvider, webConfig } from './config';
import './styles.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <ConfigProvider value={webConfig}>
      <App />
    </ConfigProvider>
  </StrictMode>,
);
