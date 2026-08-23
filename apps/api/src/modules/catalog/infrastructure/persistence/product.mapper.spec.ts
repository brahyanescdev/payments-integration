import { makeProduct } from '../../../../testing/builders';
import { ProductEntity } from './product.entity';
import { productMapper } from './product.mapper';

function makeRow(overrides: Partial<ProductEntity> = {}): ProductEntity {
  const row = new ProductEntity();
  row.id = '11111111-1111-4111-8111-111111111111';
  row.sku = 'TEE-CLASSIC-M';
  row.name = 'Camiseta clásica';
  row.description = 'Algodón peinado, corte regular.';
  row.priceInCents = 8_900_000;
  row.currency = 'COP';
  row.imageUrl = 'https://cdn.example.test/tee-classic.avif';
  row.stock = 10;
  row.version = 1;
  Object.assign(row, overrides);

  return row;
}

describe('productMapper', () => {
  it('maps a persisted row into the domain entity', () => {
    const product = productMapper.toDomain(makeRow())._unsafeUnwrap();
    const snapshot = product.toSnapshot();

    expect(snapshot.sku).toBe('TEE-CLASSIC-M');
    expect(snapshot.price.amountInCents).toBe(8_900_000);
    expect(snapshot.price.currency).toBe('COP');
  });

  it('fails rather than producing an impossible product from a malformed currency', () => {
    const result = productMapper.toDomain(makeRow({ currency: 'PESOS' }));

    expect(result.isErr()).toBe(true);
  });

  it('copies domain state onto an already-tracked row, for the identity map to notice', () => {
    const product = makeProduct({ stock: 4 });
    const row = makeRow();

    productMapper.applyToRow(product, row);

    expect(row.stock).toBe(4);
    expect(row.sku).toBe(product.toSnapshot().sku);
  });

  it('builds a fresh, untracked row for a product saved for the first time', () => {
    const product = makeProduct({ id: 'new-product-id' });

    const row = productMapper.toNewRow(product);

    expect(row).toBeInstanceOf(ProductEntity);
    expect(row.id).toBe('new-product-id');
    expect(row.sku).toBe(product.toSnapshot().sku);
  });
});
