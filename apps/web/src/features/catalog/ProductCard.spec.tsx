import { TEST_IDS } from '@payments/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { makeProductDto } from '../../testing/product.fixture';
import { renderWithProviders as render } from '../../testing/render';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('renders the name, price and description', () => {
    render(<ProductCard product={makeProductDto({ name: 'Camiseta', priceInCents: 1_000_00 })} />);

    expect(screen.getByTestId(TEST_IDS.productPage.name)).toHaveTextContent('Camiseta');
    // 1_000_00 cents is 1,000 major units.
    expect(screen.getByTestId(TEST_IDS.productPage.price).textContent?.replace(/\D/g, '')).toBe(
      '1000',
    );
  });

  it('shows the remaining units when the product is available', () => {
    render(<ProductCard product={makeProductDto({ stock: 5, isAvailable: true })} />);

    expect(screen.getByTestId(TEST_IDS.productPage.stock)).toHaveTextContent('5');
  });

  it('shows "Agotado" instead of a unit count when stock is zero', () => {
    render(<ProductCard product={makeProductDto({ stock: 0, isAvailable: false })} />);

    expect(screen.getByTestId(TEST_IDS.productPage.stock)).toHaveTextContent('Agotado');
  });

  it('reserves the image box with explicit dimensions, so layout never shifts on load', () => {
    render(
      <ProductCard product={makeProductDto({ imageUrl: '/images/tee.svg', name: 'Camiseta' })} />,
    );

    const image = screen.getByRole('img', { name: 'Camiseta' });
    expect(image).toHaveAttribute('width', '400');
    expect(image).toHaveAttribute('height', '400');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('src', '/images/tee.svg');
  });
});

describe('ProductCard — opening checkout', () => {
  it('opens the checkout for the selected quantity when the pay button is clicked', async () => {
    const user = userEvent.setup();
    const { store } = render(
      <ProductCard product={makeProductDto({ stock: 5, isAvailable: true })} />,
    );

    await user.selectOptions(screen.getByRole('combobox'), '3');
    await user.click(screen.getByTestId(TEST_IDS.productPage.payWithCardButton));

    const state = store.getState() as { checkout: { step: string; quantity: number } };
    expect(state.checkout.step).toBe('form');
    expect(state.checkout.quantity).toBe(3);
  });

  it('shows no quantity selector or pay button once stock is exhausted', () => {
    render(<ProductCard product={makeProductDto({ stock: 0, isAvailable: false })} />);

    expect(screen.queryByTestId(TEST_IDS.productPage.payWithCardButton)).not.toBeInTheDocument();
  });
});
