import { ResultAsync } from 'neverthrow';

import { gatewayUnavailable } from '../../../../shared/result/domain-error';
import type { DomainError } from '../../../../shared/result/domain-error';
import type { TransactionStatus } from '../../../checkout/domain/transaction';
import type {
  AcceptanceTokens,
  ChargeCardInput,
  ChargeResult,
  PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';
import { computeIntegritySignature } from './integrity-signature';

export interface HttpPaymentGatewaySettings {
  readonly baseUrl: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly integritySecret: string;
  readonly timeoutMs: number;
}

/** Shape of the merchant lookup response, trimmed to the fields this adapter reads. */
interface MerchantResponse {
  data: {
    presigned_acceptance: { acceptance_token: string; permalink: string };
    presigned_personal_data_auth: { acceptance_token: string; permalink: string };
  };
}

/** Shape of the transaction-creation response, trimmed to what this adapter reads. */
interface CreateTransactionResponse {
  data: {
    id: string;
    status: string;
    status_message: string | null;
  };
}

/** Statuses the gateway can report that our own domain also models. */
const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
]);

/**
 * Talks to the real sandbox.
 *
 * Selected by `PAYMENT_GATEWAY_DRIVER=http`. The merchant lookup and the
 * integrity signature both stay entirely server-side: the signature's secret
 * must never reach the browser, which is precisely why charging a card is a
 * backend call while tokenising one is not.
 */
export class HttpPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly settings: HttpPaymentGatewaySettings) {}

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError> {
    return this.request<MerchantResponse>(`/merchants/${this.settings.publicKey}`, {
      method: 'GET',
    }).map((merchant) => ({
      publicKey: this.settings.publicKey,
      tokenizationUrl: `${this.settings.baseUrl}/tokens/cards`,
      acceptance: {
        token: merchant.data.presigned_acceptance.acceptance_token,
        permalink: merchant.data.presigned_acceptance.permalink,
      },
      personalDataAuthorization: {
        token: merchant.data.presigned_personal_data_auth.acceptance_token,
        permalink: merchant.data.presigned_personal_data_auth.permalink,
      },
    }));
  }

  chargeCard(input: ChargeCardInput): ResultAsync<ChargeResult, DomainError> {
    const signature = computeIntegritySignature(
      input.reference,
      input.amountInCents,
      input.currency,
      this.settings.integritySecret,
    );

    return this.request<CreateTransactionResponse>('/transactions', {
      method: 'POST',
      authorization: this.settings.privateKey,
      body: {
        amount_in_cents: input.amountInCents,
        currency: input.currency,
        customer_email: input.customerEmail,
        reference: input.reference,
        payment_method: {
          type: 'CARD',
          installments: input.installments,
          token: input.cardToken,
        },
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.acceptPersonalAuthToken,
        signature,
      },
    }).map((created) => ({
      gatewayTransactionId: created.data.id,
      status: this.toTransactionStatus(created.data.status),
      failureReason: created.data.status_message,
    }));
  }

  /** Falls back to ERROR for anything the gateway reports that our domain does not model. */
  private toTransactionStatus(rawStatus: string): TransactionStatus {
    return KNOWN_STATUSES.has(rawStatus) ? (rawStatus as TransactionStatus) : 'ERROR';
  }

  private request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; authorization?: string; body?: unknown },
  ): ResultAsync<T, DomainError> {
    return ResultAsync.fromPromise(this.fetchJson<T>(path, options), (cause) =>
      gatewayUnavailable(cause instanceof Error ? cause.message : 'unknown error'),
    );
  }

  private async fetchJson<T>(
    path: string,
    options: { method: 'GET' | 'POST'; authorization?: string; body?: unknown },
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);

    try {
      const response = await fetch(`${this.settings.baseUrl}${path}`, {
        method: options.method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.authorization ?? this.settings.publicKey}`,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Gateway request to ${path} failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
