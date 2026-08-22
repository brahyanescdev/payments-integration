import { TEST_IDS } from '@payments/shared';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from './testing/render';
import { App } from './App';
import { t } from './i18n/es';

describe('App shell', () => {
  it('renders the shell that every checkout screen mounts into', () => {
    renderWithProviders(<App />);

    expect(screen.getByTestId(TEST_IDS.appShell)).toBeInTheDocument();
  });

  it('takes its copy from the dictionary rather than inline strings', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: t.app.title })).toBeInTheDocument();
  });

  it('mounts the product catalogue as the first screen', async () => {
    renderWithProviders(<App />);

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.productPage.root)).toBeInTheDocument());
  });
});
