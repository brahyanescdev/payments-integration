import { makeTransaction } from '../../../../testing/builders';
import { toTransactionDto } from './transaction.presenter';

describe('toTransactionDto', () => {
  it('reports gatewayMode "fake" for the in-memory driver', () => {
    const dto = toTransactionDto(makeTransaction(), 'fake');

    expect(dto.gatewayMode).toBe('fake');
  });

  it('reports gatewayMode "sandbox" for the real driver, never leaking the internal "http" name', () => {
    const dto = toTransactionDto(makeTransaction(), 'http');

    expect(dto.gatewayMode).toBe('sandbox');
  });

  it('never exposes the customer or a card token, only the published projection', () => {
    const dto = toTransactionDto(makeTransaction(), 'fake') as Record<string, unknown>;

    expect(dto).not.toHaveProperty('customerId');
    expect(dto).not.toHaveProperty('cardToken');
  });
});
