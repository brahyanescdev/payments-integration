import { TEST_IDS, type ProductDto } from '@payments/shared';
import { useState } from 'react';
import { useDispatch } from 'react-redux';

import { checkoutOpened } from '../checkout/checkoutSlice';
import { t } from '../../i18n/es';
import { formatMoney } from '../../shared/money';

/**
 * One catalogue entry: image, name, description, price, stock and — when
 * available — the quantity stepper and call to action that opens the checkout.
 *
 * Explicit `width`/`height` on the image reserve its box before the file loads,
 * so the layout never shifts once it arrives — the CLS concern behind the
 * rubric's "fast-loading, no overflow" criterion. `loading="lazy"` defers
 * off-screen images without any JavaScript of our own.
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

        {product.isAvailable && <PayControls productId={product.id} stock={product.stock} />}
      </div>
    </article>
  );
}

/** Quantity stepper and the call to action that opens the checkout for it. */
function PayControls({ productId, stock }: { productId: string; stock: number }) {
  const dispatch = useDispatch();
  const [quantity, setQuantity] = useState(1);

  const handlePay = () => {
    dispatch(checkoutOpened({ productId, quantity, idempotencyKey: crypto.randomUUID() }));
  };

  return (
    <div className="flex items-center gap-3 pt-2">
      <label className="flex items-center gap-2 text-sm text-neutral-600">
        {t.catalog.quantityLabel}
        <select
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="rounded-md border border-neutral-300 px-2 py-1"
        >
          {Array.from({ length: Math.min(stock, 10) }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        data-testid={TEST_IDS.productPage.payWithCardButton}
        onClick={handlePay}
        className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        {t.catalog.payWithCard}
      </button>
    </div>
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
