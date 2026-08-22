import { makeProduct } from '../../../../testing/builders';
import { toProductDto } from './product.presenter';

describe('toProductDto', () => {
  it('flattens the price value object into cents and currency', () => {
    const product = makeProduct();

    const dto = toProductDto(product);

    expect(dto.priceInCents).toBe(product.price.amountInCents);
    expect(dto.currency).toBe(product.price.currency);
  });

  it('derives isAvailable from stock rather than re-deriving it on the client', () => {
    expect(toProductDto(makeProduct({ stock: 0 })).isAvailable).toBe(false);
    expect(toProductDto(makeProduct({ stock: 1 })).isAvailable).toBe(true);
  });

  it('carries no field the domain does not expose', () => {
    const dto = toProductDto(makeProduct());

    expect(Object.keys(dto).sort()).toEqual(
      [
        'id',
        'sku',
        'name',
        'description',
        'priceInCents',
        'currency',
        'imageUrl',
        'stock',
        'isAvailable',
      ].sort(),
    );
  });
});
