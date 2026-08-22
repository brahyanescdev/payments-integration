import type { ProductDto } from '@payments/shared';

/** Valid catalogue item for specs; override only what the case is about. */
export function makeProductDto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    sku: 'TEE-ESENCIAL-ORG',
    name: 'Camiseta Orgánica Esencial',
    description: 'Algodón orgánico peinado de 180 g/m², corte regular.',
    priceInCents: 8_900_000,
    currency: 'COP',
    imageUrl: '/images/tee-esencial.svg',
    stock: 12,
    isAvailable: true,
    ...overrides,
  };
}
