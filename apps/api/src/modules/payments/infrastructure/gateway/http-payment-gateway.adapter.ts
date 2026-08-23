import { ResultAsync } from 'neverthrow';

import { gatewayUnavailable } from '../../../../shared/result/domain-error';
import type { DomainError } from '../../../../shared/result/domain-error';
import type { AcceptanceTokens, PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';

export interface HttpPaymentGatewaySettings {
  readonly baseUrl: string;
  readonly publicKey: string;
  readonly timeoutMs: number;
}

/** Shape of the merchant lookup response, trimmed to the fields this adapter reads. */
interface MerchantResponse {
  data: {
    presigned_acceptance: { acceptance_token: string; permalink: string };
    presigned_personal_data_auth: { acceptance_token: string; permalink: string };
  };
}

/**
 * Talks to the real sandbox.
 *
 * Selected by `PAYMENT_GATEWAY_DRIVER=http`. The merchant lookup needs only the
 * public key — never the private key or the integrity secret, which the next
 * vertical slice's charge and webhook methods will require.
 */
export class HttpPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly settings: HttpPaymentGatewaySettings) {}

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError> {
    return ResultAsync.fromPromise(this.fetchMerchant(), (cause) =>
      gatewayUnavailable(cause instanceof Error ? cause.message : 'unknown error'),
    ).andThen((merchant) =>
      ResultAsync.fromSafePromise(
        Promise.resolve({
          publicKey: this.settings.publicKey,
          acceptance: {
            token: merchant.data.presigned_acceptance.acceptance_token,
            permalink: merchant.data.presigned_acceptance.permalink,
          },
          personalDataAuthorization: {
            token: merchant.data.presigned_personal_data_auth.acceptance_token,
            permalink: merchant.data.presigned_personal_data_auth.permalink,
          },
        }),
      ),
    );
  }

  private async fetchMerchant(): Promise<MerchantResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);

    try {
      const response = await fetch(
        `${this.settings.baseUrl}/merchants/${this.settings.publicKey}`,
        {
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Merchant lookup failed with status ${response.status}`);
      }

      return (await response.json()) as MerchantResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
