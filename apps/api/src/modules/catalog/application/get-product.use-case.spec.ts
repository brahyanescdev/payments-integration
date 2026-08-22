import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { makeProduct } from '../../../testing/builders';
import { GetProductUseCase } from './get-product.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

describe('GetProductUseCase', () => {
  it('returns the product when it exists', async () => {
    const products = new InMemoryProductRepository().seed([makeProduct({ id: PRODUCT_ID })]);
    const useCase = new GetProductUseCase(new FakeUnitOfWork({ products }));

    const result = await useCase.execute(PRODUCT_ID);

    expect(result._unsafeUnwrap().id).toBe(PRODUCT_ID);
  });

  it('resolves a missing product to ProductNotFound rather than a bare null', async () => {
    const products = new InMemoryProductRepository();
    const useCase = new GetProductUseCase(new FakeUnitOfWork({ products }));

    const error = (await useCase.execute('does-not-exist'))._unsafeUnwrapErr();

    expect(error.kind).toBe('ProductNotFound');
    expect(error.details).toEqual({ productId: 'does-not-exist' });
  });
});
