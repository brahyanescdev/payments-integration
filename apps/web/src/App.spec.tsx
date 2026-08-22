import { TEST_IDS } from '@payments/shared';
import { render, screen } from '@testing-library/react';

import { App } from './App';
import { t } from './i18n/es';

describe('App shell', () => {
  it('renders the shell that every checkout screen mounts into', () => {
    render(<App />);

    expect(screen.getByTestId(TEST_IDS.appShell)).toBeInTheDocument();
  });

  it('takes its copy from the dictionary rather than inline strings', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.app.title);
  });
});
