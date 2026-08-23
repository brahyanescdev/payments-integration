import valid from 'card-validator';

/** Card brands the checkout recognises with a badge; anything else renders generic. */
export type CardBrand = 'visa' | 'mastercard' | 'unknown';

const KNOWN_BRANDS: ReadonlySet<string> = new Set(['visa', 'mastercard']);

/**
 * Identifies the card brand from its digits alone, live as the buyer types.
 *
 * `card-validator` reports many brands (Amex, Discover, Diners…); the checkout
 * only has artwork for the two the rubric asks for, so anything else is
 * "unknown" rather than a label with no matching logo.
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const { card } = valid.number(cardNumber);
  const type = card?.type;

  return type !== undefined && KNOWN_BRANDS.has(type) ? (type as CardBrand) : 'unknown';
}

/**
 * Validates a card number: correct length for its brand and a passing Luhn
 * checksum. Delegates entirely to `card-validator` rather than a hand-rolled
 * implementation — Luhn has enough edge cases (variable card lengths, brands
 * with multiple valid lengths) that re-deriving it invites subtle bugs.
 */
export function isValidCardNumber(cardNumber: string): boolean {
  return valid.number(cardNumber).isValid;
}

/** Groups digits into 4-character blocks for on-screen display, e.g. "4242 4242 4242 4242". */
export function formatCardNumber(rawDigits: string): string {
  return (rawDigits.match(/.{1,4}/g) ?? []).join(' ');
}

/** Strips everything but digits, so pasted formatting never reaches validation. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Validates an "MM/YY" expiry: real month, and not already in the past. */
export function isValidExpiry(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);

  if (match === null) return false;

  return valid.expirationDate(`${match[1]}/${match[2]}`).isValid;
}

/** Validates a CVC: 3 digits for VISA/Mastercard, 4 for brands like Amex. */
export function isValidCvc(cvc: string, brand: CardBrand): boolean {
  const expectedLength = brand === 'unknown' ? [3, 4] : [3];

  return /^\d+$/.test(cvc) && expectedLength.includes(cvc.length);
}
