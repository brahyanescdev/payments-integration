import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { makeProduct } from '../../../testing/builders';
import { ListProductsUseCase } from './list-products.use-case';

describe('ListProductsUseCase', () => {
  it('delegates to the products repository through the unit of work', async () => {
    const products = new InMemoryProductRepository().seed([
      makeProduct({ id: '11111111-1111-4111-8111-000000000001', sku: 'A', name: 'Alfa' }),
      makeProduct({ id: '11111111-1111-4111-8111-000000000002', sku: 'B', name: 'Beta' }),
    ]);
    const useCase = new ListProductsUseCase(new FakeUnitOfWork({ products }));

    const result = await useCase.execute(10, 0);

    const page = result._unsafeUnwrap();
    expect(page.total).toBe(2);
    expect(page.items.map((product) => product.sku)).toEqual(['A', 'B']);
  });

  it('passes the limit and offset through untouched, which is how pagination composes', async () => {
    const products = new InMemoryProductRepository().seed(
      Array.from({ length: 5 }, (_, index) =>
        makeProduct({
          id: `11111111-1111-4111-8111-00000000000${index}`,
          sku: `SKU-${index}`,
          name: `zzz-${index}`,
        }),
      ),
    );
    const useCase = new ListProductsUseCase(new FakeUnitOfWork({ products }));

    const page = (await useCase.execute(2, 2))._unsafeUnwrap();

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
  });
});
