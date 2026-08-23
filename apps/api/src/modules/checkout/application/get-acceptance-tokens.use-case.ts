import type { ResultAsync } from 'neverthrow';

import type { DomainError } from '../../../shared/result/domain-error';
import type {
  AcceptanceTokens,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';

/** Injection token for {@link GetAcceptanceTokensUseCase}. */
export const GET_ACCEPTANCE_TOKENS_USE_CASE = Symbol('GET_ACCEPTANCE_TOKENS_USE_CASE');

/**
 * Reads the terms the buyer must accept before paying.
 *
 * A thin pass-through to the gateway port, kept as its own use case rather than
 * called directly from the controller so every HTTP handler follows the same
 * shape: translate the request, delegate to a use case, translate the result.
 */
export class GetAcceptanceTokensUseCase {
  constructor(private readonly gateway: PaymentGatewayPort) {}

  execute(): ResultAsync<AcceptanceTokens, DomainError> {
    return this.gateway.getAcceptanceTokens();
  }
}
