import { hashRequestBody } from './request-hash';

describe('hashRequestBody', () => {
  it('produces the same hash regardless of key order', () => {
    const a = hashRequestBody({ productId: '1', quantity: 2 });
    const b = hashRequestBody({ quantity: 2, productId: '1' });

    expect(a).toBe(b);
  });

  it('produces the same hash for nested objects regardless of key order', () => {
    const a = hashRequestBody({ customer: { email: 'a@example.com', fullName: 'Ana' } });
    const b = hashRequestBody({ customer: { fullName: 'Ana', email: 'a@example.com' } });

    expect(a).toBe(b);
  });

  it('produces a different hash when a value actually changes', () => {
    const a = hashRequestBody({ productId: '1', quantity: 2 });
    const b = hashRequestBody({ productId: '1', quantity: 3 });

    expect(a).not.toBe(b);
  });

  it('is sensitive to array order, unlike object keys', () => {
    const a = hashRequestBody({ tags: ['a', 'b'] });
    const b = hashRequestBody({ tags: ['b', 'a'] });

    expect(a).not.toBe(b);
  });

  it('produces a 64-character hex digest', () => {
    expect(hashRequestBody({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
