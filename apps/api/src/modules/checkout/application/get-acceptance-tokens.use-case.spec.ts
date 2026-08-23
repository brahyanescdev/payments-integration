import { errAsync, okAsync } from 'neverthrow';

import { gatewayUnavailable } from '../../../shared/result/domain-error';
import type {
  AcceptanceTokens,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';
import { GetAcceptanceTokensUseCase } from './get-acceptance-tokens.use-case';

const TOKENS: AcceptanceTokens = {
  publicKey: 'pub_test_1',
  acceptance: { token: 'acc', permalink: 'https://example.test/terms' },
  personalDataAuthorization: { token: 'priv', permalink: 'https://example.test/privacy' },
};

describe('GetAcceptanceTokensUseCase', () => {
  it('returns whatever the gateway port returns', async () => {
    const gateway: PaymentGatewayPort = { getAcceptanceTokens: () => okAsync(TOKENS) };

    const result = await new GetAcceptanceTokensUseCase(gateway).execute();

    expect(result._unsafeUnwrap()).toEqual(TOKENS);
  });

  it('passes a gateway failure through untouched', async () => {
    const gateway: PaymentGatewayPort = {
      getAcceptanceTokens: () => errAsync(gatewayUnavailable('timeout')),
    };

    const result = await new GetAcceptanceTokensUseCase(gateway).execute();

    expect(result._unsafeUnwrapErr().kind).toBe('GatewayUnavailable');
  });
});
