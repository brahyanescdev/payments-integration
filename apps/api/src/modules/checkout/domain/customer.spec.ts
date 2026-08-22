import { Email } from '../../../shared/domain/email';
import { FIXED_NOW } from '../../../testing/builders';
import { Customer } from './customer';

describe('Customer', () => {
  it('round-trips through a snapshot, keeping the normalised email', () => {
    const snapshot = {
      id: '33333333-3333-4333-8333-333333333333',
      email: Email.create('ANA@example.com')._unsafeUnwrap(),
      fullName: 'Ana Pérez',
      phone: '3001234567',
      legalId: '1020304050',
      legalIdType: 'CC' as const,
      createdAt: FIXED_NOW,
    };

    const restored = Customer.rehydrate(snapshot);

    expect(restored.email.value).toBe('ana@example.com');
    expect(restored.toSnapshot()).toEqual(snapshot);
  });
});
