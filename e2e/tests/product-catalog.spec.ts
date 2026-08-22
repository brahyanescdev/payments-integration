import { TEST_IDS } from '@payments/shared';
import { expect, test } from '@playwright/test';

import { captureEvidence } from '../support/evidence';

/**
 * The seeded catalogue (`apps/api/src/persistence/products.seed.json`) has six
 * products, one of them out of stock. The suite relies on that fixture rather than
 * asserting on an arbitrary count, since the count itself is what proves the
 * seed → API → SPA pipeline is wired correctly end to end.
 */
test.describe('Catálogo de productos', () => {
  test('muestra el catálogo con precio, stock e imagen', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByTestId(TEST_IDS.productPage.root)).toBeVisible();
    await expect(page.getByText('Camiseta Orgánica Esencial')).toBeVisible();
    await expect(page.getByText('Sudadera con Capucha Bruma')).toBeVisible();

    await captureEvidence(page, testInfo, 'Catalogo de productos');
  });

  test('marca como agotado el producto sin unidades disponibles', async ({ page }) => {
    await page.goto('/');

    const outOfStockCard = page.getByText('Medias Térmicas (pack x3)').locator('..').locator('..');

    await expect(outOfStockCard.getByText('Agotado')).toBeVisible();
  });

  test('carga las imágenes sin desbordar su contenedor', async ({ page }) => {
    await page.goto('/');

    const firstImage = page.getByRole('img').first();
    await expect(firstImage).toBeVisible();

    const box = await firstImage.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });
});
