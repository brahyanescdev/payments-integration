import { COP, makeProduct } from '../../../testing/builders';

describe('Product', () => {
  describe('reserve', () => {
    it('takes the requested units out of available stock', () => {
      const product = makeProduct({ stock: 10 });

      expect(product.reserve(3).isOk()).toBe(true);
      expect(product.stock).toBe(7);
    });

    it('allows reserving the entire remaining stock', () => {
      const product = makeProduct({ stock: 2 });

      expect(product.reserve(2).isOk()).toBe(true);
      expect(product.stock).toBe(0);
      expect(product.isAvailable).toBe(false);
    });

    it('refuses to oversell and reports what was actually available', () => {
      const product = makeProduct({ stock: 1 });

      const error = product.reserve(2)._unsafeUnwrapErr();

      expect(error.kind).toBe('InsufficientStock');
      expect(error.details).toMatchObject({ requested: 2, available: 1 });
      expect(product.stock).toBe(1);
    });

    it.each([0, -1, 1.5])('rejects the invalid quantity %p without touching stock', (quantity) => {
      const product = makeProduct({ stock: 5 });

      expect(product.reserve(quantity)._unsafeUnwrapErr().kind).toBe('InvalidQuantity');
      expect(product.stock).toBe(5);
    });
  });

  describe('release', () => {
    it('returns units to stock after a declined payment', () => {
      const product = makeProduct({ stock: 4 });
      product.reserve(3);

      expect(product.release(3).isOk()).toBe(true);
      expect(product.stock).toBe(4);
    });

    it.each([0, -2, 0.5])('rejects the invalid quantity %p', (quantity) => {
      const product = makeProduct({ stock: 4 });

      expect(product.release(quantity)._unsafeUnwrapErr().kind).toBe('InvalidQuantity');
      expect(product.stock).toBe(4);
    });
  });

  describe('lineTotal', () => {
    it('multiplies unit price by quantity', () => {
      const product = makeProduct({ price: COP(8_900_000) });

      expect(product.lineTotal(2)._unsafeUnwrap().equals(COP(17_800_000))).toBe(true);
    });

    it.each([0, -1, 2.5])('rejects the invalid quantity %p', (quantity) => {
      expect(makeProduct().lineTotal(quantity)._unsafeUnwrapErr().kind).toBe('InvalidQuantity');
    });
  });

  it('round-trips through a snapshot, carrying the current stock', () => {
    const product = makeProduct({ stock: 9 });
    product.reserve(4);

    const snapshot = product.toSnapshot();

    expect(snapshot.stock).toBe(5);
    expect(snapshot.version).toBe(1);
    expect(snapshot.sku).toBe(product.sku);
  });
});
