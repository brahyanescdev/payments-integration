import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import { gatewayUnavailable, type DomainError } from '../../../../shared/result/domain-error';
import type {
  AcceptanceTokens,
  ChargeCardInput,
  ChargeResult,
  PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';

export interface FakePaymentGatewaySettings {
  /** Our own API's base path, so the fake tokenisation endpoint resolves for the browser. */
  readonly apiBasePath: string;
}

/**
 * Deterministic double for the payment gateway.
 *
 * Selected by `PAYMENT_GATEWAY_DRIVER=fake`, which is CI's default and the only
 * safe choice for automated runs: the real sandbox account is shared across every
 * candidate taking this test, and its session can be closed from another location
 * at any moment, which would fail the pipeline for a reason that has nothing to do
 * with the code under review.
 *
 * Mirrors the real sandbox's own documented test cards, keyed off the fake token
 * this adapter's own `/checkout/dev-tokenize` endpoint issues: a token minted for
 * a card ending in 4242 approves, one ending in 1111 declines, anything else
 * errors — the exact convention the real gateway uses for its own test numbers,
 * just carried in a fake token instead of a real PAN.
 */
export class FakePaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly settings: FakePaymentGatewaySettings) {}

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError> {
    return okAsync({
      publicKey: 'pub_test_fake00000000000000000000',
      tokenizationUrl: `${this.settings.apiBasePath}/checkout/dev-tokenize`,
      acceptance: {
        token: 'fake_acceptance_token',
        permalink: 'https://example.test/terms',
      },
      personalDataAuthorization: {
        token: 'fake_personal_data_token',
        permalink: 'https://example.test/privacy',
      },
    });
  }

  chargeCard(input: ChargeCardInput): ResultAsync<ChargeResult, DomainError> {
    const match = /^tok_fake_(\d{4})_/.exec(input.cardToken);

    if (match === null) {
      return errAsync(gatewayUnavailable(`Unrecognised fake card token: ${input.cardToken}`));
    }

    const lastFour = match[1];
    const gatewayTransactionId = `fake_gw_${input.reference}`;

    if (lastFour === '4242') {
      return okAsync({ gatewayTransactionId, status: 'APPROVED', failureReason: null });
    }

    if (lastFour === '1111') {
      return okAsync({
        gatewayTransactionId,
        status: 'DECLINED',
        failureReason: 'INSUFFICIENT_FUNDS',
      });
    }

    return okAsync({ gatewayTransactionId, status: 'ERROR', failureReason: 'GENERIC_ERROR' });
  }
}
