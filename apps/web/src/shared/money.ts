/**
 * Locale used to render prices, not a configuration knob: the storefront only ever
 * sells in Colombian pesos (`CHECKOUT_CURRENCY=COP` on the backend), so there is no
 * runtime choice to make here — only a business fact worth naming.
 */
const DISPLAY_LOCALE = 'es-CO';

/** Formats an integer amount of cents as a localised currency string. */
export function formatMoney(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}
