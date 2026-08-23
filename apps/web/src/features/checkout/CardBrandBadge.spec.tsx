import { render, screen } from '@testing-library/react';

import { CardBrandBadge } from './CardBrandBadge';

describe('CardBrandBadge', () => {
  it('renders the VISA mark', () => {
    render(<CardBrandBadge brand="visa" />);

    expect(screen.getByLabelText('visa')).toBeInTheDocument();
  });

  it('renders the Mastercard mark', () => {
    render(<CardBrandBadge brand="mastercard" />);

    expect(screen.getByLabelText('mastercard')).toBeInTheDocument();
  });

  it('renders nothing for an unrecognised brand', () => {
    const { container } = render(<CardBrandBadge brand="unknown" />);

    expect(container).toBeEmptyDOMElement();
  });
});
