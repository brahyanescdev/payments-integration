import { TEST_IDS, type ProductDto } from '@payments/shared';

import { t } from '../../i18n/es';
import { formatMoney } from '../../shared/money';

/**
 * One catalogue entry: image, name, description, price and stock.
 *
 * Explicit `width`/`height` on the image reserve its box before the file loads,
 * so the layout never shifts once it arrives — the CLS concern behind the rubric's
 * "fast-loading, no overflow" criterion. `loading="lazy"` defers off-screen images
 * without any JavaScript of our own.
 */
export function ProductCard({ product }: { product: ProductDto }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="aspect-square w-full bg-neutral-50">
        <img
          src={product.imageUrl}
          alt={product.name}
          width={400}
          height={400}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 data-testid={TEST_IDS.productPage.name} className="text-base font-semibold">
          {product.name}
        </h2>
        <p className="line-clamp-2 flex-1 text-sm text-neutral-600">{product.description}</p>

        <div className="flex items-center justify-between pt-1">
          <span data-testid={TEST_IDS.productPage.price} className="text-lg font-semibold">
            {formatMoney(product.priceInCents, product.currency)}
          </span>
          <StockBadge product={product} />
        </div>
      </div>
    </article>
  );
}

function StockBadge({ product }: { product: ProductDto }) {
  const label = product.isAvailable
    ? `${product.stock} ${t.catalog.unitsAvailable}`
    : t.catalog.outOfStock;
  const tone = product.isAvailable
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-neutral-100 text-neutral-500';

  return (
    <span
      data-testid={TEST_IDS.productPage.stock}
      className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
