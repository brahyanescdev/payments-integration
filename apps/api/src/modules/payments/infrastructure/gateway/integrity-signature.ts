import { createHash } from 'node:crypto';

/**
 * Computes the gateway's integrity signature.
 *
 * The gateway's own formula: SHA256 of `reference + amount_in_cents + currency +
 * integrity_secret`, concatenated with no separators, as a lowercase hex digest.
 * Computed server-side only — the secret must never reach the browser, which is
 * exactly why charging a card is a backend call and not something the frontend
 * could do directly the way tokenisation is.
 */
export function computeIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string,
): string {
  return createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest('hex');
}
