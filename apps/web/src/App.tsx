import { TEST_IDS } from '@payments/shared';

import { CheckoutModalHost } from './features/checkout/CheckoutModal';
import { ProductsPage } from './pages/ProductsPage';
import { t } from './i18n/es';

/** Application shell: the frame every screen of the checkout flow renders into. */
export function App() {
  return (
    <div
      data-testid={TEST_IDS.appShell}
      className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col px-4 py-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.app.title}</h1>
        <p className="text-sm text-neutral-600">{t.app.tagline}</p>
      </header>
      <main className="flex flex-1 flex-col pt-4">
        <ProductsPage />
      </main>
      <CheckoutModalHost />
    </div>
  );
}
