/**
 * Stable hooks for automated tests.
 *
 * Components render these values and both the React Testing Library specs and the
 * Playwright specs query by them. Because all three read the same constant,
 * renaming a hook is a compile error rather than a silently skipped assertion, and
 * tests stop breaking when visible copy is reworded.
 */
export const TEST_IDS = {
  appShell: 'app-shell',
  productPage: {
    root: 'product-page',
    name: 'product-name',
    price: 'product-price',
    stock: 'product-stock',
    payWithCardButton: 'pay-with-card-button',
  },
  checkoutModal: {
    root: 'checkout-modal',
    cardNumber: 'card-number-input',
    cardBrand: 'card-brand-icon',
    expiry: 'card-expiry-input',
    cvc: 'card-cvc-input',
    submit: 'checkout-submit',
  },
  summaryBackdrop: {
    root: 'summary-backdrop',
    productAmount: 'summary-product-amount',
    baseFee: 'summary-base-fee',
    deliveryFee: 'summary-delivery-fee',
    total: 'summary-total',
    payButton: 'summary-pay-button',
  },
  resultPage: {
    root: 'result-page',
    status: 'result-status',
    backToProduct: 'result-back-to-product',
  },
} as const;
