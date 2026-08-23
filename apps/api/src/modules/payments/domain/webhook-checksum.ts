import { createHash } from 'node:crypto';

/**
 * Computes the gateway's webhook checksum.
 *
 * The gateway's own formula: SHA256 of the values named in `signature.properties`
 * (concatenated in the order they are listed, with no separators), followed by
 * the event's own `timestamp`, followed by the events secret — again with no
 * separators, as a lowercase hex digest. `propertyValues` must already be read
 * out of the payload in exactly that order; this function only ever concatenates.
 *
 * Pure and dependency-free by design, unlike its sibling `integrity-signature.ts`:
 * verifying a webhook happens from `checkout`'s application layer, which the
 * hexagonal boundary forbids from reaching into another module's infrastructure,
 * so this lives in `domain` instead.
 */
export function computeWebhookChecksum(
  propertyValues: readonly string[],
  timestamp: number,
  eventsSecret: string,
): string {
  return createHash('sha256')
    .update(`${propertyValues.join('')}${timestamp}${eventsSecret}`)
    .digest('hex');
}
