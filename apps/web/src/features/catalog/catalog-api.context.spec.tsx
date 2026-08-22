import { render, screen } from '@testing-library/react';

import { createCatalogApi } from './catalogApi';
import { CatalogApiProvider, useCatalogApi } from './catalog-api.context';

function ReducerPathProbe() {
  return <span>{useCatalogApi().reducerPath}</span>;
}

describe('CatalogApiProvider', () => {
  it('exposes the given api instance to descendants', () => {
    const catalogApi = createCatalogApi('http://api.example.test');

    render(
      <CatalogApiProvider api={catalogApi}>
        <ReducerPathProbe />
      </CatalogApiProvider>,
    );

    expect(screen.getByText('catalogApi')).toBeInTheDocument();
  });

  it('fails loudly when read outside the provider, instead of returning undefined hooks', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ReducerPathProbe />)).toThrow(/CatalogApiProvider/);

    consoleError.mockRestore();
  });
});
