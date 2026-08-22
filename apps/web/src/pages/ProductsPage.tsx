import { TEST_IDS } from '@payments/shared';

import { ProductCard } from '../features/catalog/ProductCard';
import { useCatalogApi } from '../features/catalog/catalog-api.context';
import { t } from '../i18n/es';

/**
 * Screen 1 of the checkout flow: the storefront's catalogue.
 *
 * Loading, error and empty states are handled here rather than left to whatever
 * RTK Query's default `undefined` data would render, because a blank screen while
 * a real network request is in flight reads as broken, not as fast.
 */
export function ProductsPage() {
  const { useListProductsQuery } = useCatalogApi();
  const { data, isLoading, isError, refetch } = useListProductsQuery();

  return (
    <section data-testid={TEST_IDS.productPage.root} className="flex flex-1 flex-col gap-4">
      <h1 className="text-lg font-semibold">{t.catalog.title}</h1>

      {isLoading && <p className="text-sm text-neutral-500">{t.common.loading}</p>}

      {isError && (
        <div className="flex flex-col items-start gap-2 text-sm text-red-600">
          <p>{t.common.unexpectedError}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-50"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && (
        <p className="text-sm text-neutral-500">{t.catalog.empty}</p>
      )}

      {data !== undefined && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
