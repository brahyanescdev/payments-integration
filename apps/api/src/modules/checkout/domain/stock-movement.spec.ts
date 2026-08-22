import { FIXED_NOW } from '../../../testing/builders';
import { StockMovement } from './stock-movement';

const record = (type: 'RESERVE' | 'COMMIT' | 'RELEASE') =>
  StockMovement.record({
    id: '55555555-5555-4555-8555-555555555555',
    productId: '11111111-1111-4111-8111-111111111111',
    transactionId: '22222222-2222-4222-8222-222222222222',
    type,
    quantity: 2,
    now: FIXED_NOW,
  });

describe('StockMovement', () => {
  it.each(['RESERVE', 'COMMIT', 'RELEASE'] as const)('records a %s entry', (type) => {
    const movement = record(type);

    expect(movement.type).toBe(type);
    expect(movement.quantity).toBe(2);
    expect(movement.createdAt).toEqual(FIXED_NOW);
  });

  it('ties every entry to both the product and the transaction that caused it', () => {
    const snapshot = record('RESERVE').toSnapshot();

    expect(snapshot.productId).toBe('11111111-1111-4111-8111-111111111111');
    expect(snapshot.transactionId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('round-trips through a snapshot', () => {
    const restored = StockMovement.rehydrate(record('COMMIT').toSnapshot());

    expect(restored.type).toBe('COMMIT');
    expect(restored.quantity).toBe(2);
  });
});
