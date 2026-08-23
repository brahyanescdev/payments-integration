export interface RawCardInput {
  readonly cardNumber: string;
  readonly cvc: string;
  readonly expMonth: string;
  readonly expYear: string;
  readonly cardHolder: string;
}

export interface TokenizedCard {
  readonly token: string;
  readonly lastFour: string;
}

/**
 * Resolves the gateway's tokenisation URL against our own API's origin.
 *
 * `tokenizationUrl` is absolute for the real gateway, and a path relative to our
 * API's origin for the fake driver (e.g. `/api/v1/checkout/dev-tokenize`, so it
 * survives whichever host the API happens to run on). `URL`'s own resolution
 * rules already do the right thing for both cases — a leading-slash path
 * replaces the base's path while keeping its origin, and an absolute URL is
 * returned untouched — so there is no need to special-case either one.
 */
export function resolveTokenizationUrl(tokenizationUrl: string, apiBaseUrl: string): string {
  return new URL(tokenizationUrl, apiBaseUrl).toString();
}

/**
 * Tokenises a card directly against the gateway (or its fake stand-in).
 *
 * This is the one place the PAN, CVC and expiry leave the browser: straight to
 * the gateway with its public key, never to our own backend. Only the resulting
 * single-use token is passed on from here.
 */
export async function tokenizeCard(
  tokenizationUrl: string,
  publicKey: string,
  input: RawCardInput,
): Promise<TokenizedCard> {
  const response = await fetch(tokenizationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicKey}` },
    body: JSON.stringify({
      number: input.cardNumber,
      cvc: input.cvc,
      exp_month: input.expMonth,
      exp_year: input.expYear,
      card_holder: input.cardHolder,
    }),
  });

  if (!response.ok) {
    throw new Error('No pudimos tokenizar la tarjeta.');
  }

  const payload = (await response.json()) as { data: { id: string; last_four: string } };

  return { token: payload.data.id, lastFour: payload.data.last_four };
}
