import { API_ROUTES, IDEMPOTENCY_KEY_HEADER } from './routes';

describe('API_ROUTES', () => {
  it('exposes collection paths without a leading slash so they compose with the global prefix', () => {
    expect(API_ROUTES.health).toBe('health');
    expect(API_ROUTES.products.list).toBe('products');
    expect(API_ROUTES.checkout.create).toBe('checkout');
  });

  it('builds detail paths from the resource identifier', () => {
    expect(API_ROUTES.products.detail('abc-123')).toBe('products/abc-123');
    expect(API_ROUTES.transactions.detail('tx-9')).toBe('transactions/tx-9');
    expect(API_ROUTES.checkout.pay('tx-9')).toBe('checkout/tx-9/pay');
  });

  it('names the idempotency header in lowercase, matching how Node normalises headers', () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe(IDEMPOTENCY_KEY_HEADER.toLowerCase());
  });
});
