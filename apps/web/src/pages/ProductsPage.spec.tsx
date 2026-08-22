import { API_ROUTES, TEST_IDS } from '@payments/shared';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '../testing/render';
import { server } from '../testing/msw/server';
import { makeProductDto } from '../testing/product.fixture';
import { t } from '../i18n/es';
import { ProductsPage } from './ProductsPage';

describe('ProductsPage', () => {
  it('shows a loading state before the catalogue arrives', () => {
    renderWithProviders(<ProductsPage />);

    expect(screen.getByText(t.common.loading)).toBeInTheDocument();
  });

  it('renders every product returned by the catalogue endpoint', async () => {
    server.use(
      http.get(`*/${API_ROUTES.products.list}`, () =>
        HttpResponse.json({
          items: [
            makeProductDto({ id: '1', sku: 'A', name: 'Camiseta clásica' }),
            makeProductDto({ id: '2', sku: 'B', name: 'Sudadera bruma' }),
          ],
          total: 2,
        }),
      ),
    );

    renderWithProviders(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('Camiseta clásica')).toBeInTheDocument();
      expect(screen.getByText('Sudadera bruma')).toBeInTheDocument();
    });
  });

  it('shows the empty-catalogue message when there is nothing to sell', async () => {
    server.use(
      http.get(`*/${API_ROUTES.products.list}`, () => HttpResponse.json({ items: [], total: 0 })),
    );

    renderWithProviders(<ProductsPage />);

    await waitFor(() => expect(screen.getByText(t.catalog.empty)).toBeInTheDocument());
  });

  it('shows a retry action when the request fails, and recovers on click', async () => {
    let attempt = 0;
    server.use(
      http.get(`*/${API_ROUTES.products.list}`, () => {
        attempt += 1;

        if (attempt === 1) {
          return new HttpResponse(null, { status: 500 });
        }

        return HttpResponse.json({ items: [makeProductDto({ name: 'Recuperado' })], total: 1 });
      }),
    );

    renderWithProviders(<ProductsPage />);

    await waitFor(() => expect(screen.getByText(t.common.unexpectedError)).toBeInTheDocument());

    screen.getByRole('button', { name: t.common.retry }).click();

    await waitFor(() => expect(screen.getByText('Recuperado')).toBeInTheDocument());
    expect(attempt).toBe(2);
  });

  it('renders the page root so Playwright and other specs can anchor on it', async () => {
    renderWithProviders(<ProductsPage />);

    expect(screen.getByTestId(TEST_IDS.productPage.root)).toBeInTheDocument();
  });
});
