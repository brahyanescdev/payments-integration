import { render, screen } from '@testing-library/react';

import { createCheckoutApi } from './checkoutApi';
import { CheckoutApiProvider, useCheckoutApi } from './checkout-api.context';

function ReducerPathProbe() {
  return <span>{useCheckoutApi().reducerPath}</span>;
}

describe('CheckoutApiProvider', () => {
  it('exposes the given api instance to descendants', () => {
    const checkoutApi = createCheckoutApi('http://api.example.test');

    render(
      <CheckoutApiProvider api={checkoutApi}>
        <ReducerPathProbe />
      </CheckoutApiProvider>,
    );

    expect(screen.getByText('checkoutApi')).toBeInTheDocument();
  });

  it('fails loudly when read outside the provider, instead of returning undefined hooks', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ReducerPathProbe />)).toThrow(/CheckoutApiProvider/);

    consoleError.mockRestore();
  });
});
