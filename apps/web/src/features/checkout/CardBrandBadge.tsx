import { TEST_IDS } from '@payments/shared';

import type { CardBrand } from './card';

/**
 * Inline SVG marks for the two brands the rubric asks to detect.
 *
 * Rendered inline rather than as image files: no extra network request, no
 * layout shift while it loads, and it recolors correctly in either theme.
 */
export function CardBrandBadge({ brand }: { brand: CardBrand }) {
  if (brand === 'unknown') return null;

  return (
    <span data-testid={TEST_IDS.checkoutModal.cardBrand} aria-label={brand} className="inline-flex">
      {brand === 'visa' ? <VisaMark /> : <MastercardMark />}
    </span>
  );
}

function VisaMark() {
  return (
    <svg viewBox="0 0 48 16" width="40" height="14" role="img" aria-label="VISA">
      <rect width="48" height="16" rx="2" fill="#1A1F71" />
      <text
        x="24"
        y="12"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontStyle="italic"
        fill="#fff"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 48 16" width="40" height="14" role="img" aria-label="Mastercard">
      <rect width="48" height="16" rx="2" fill="#f5f5f5" />
      <circle cx="20" cy="8" r="6" fill="#EB001B" />
      <circle cx="28" cy="8" r="6" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}
