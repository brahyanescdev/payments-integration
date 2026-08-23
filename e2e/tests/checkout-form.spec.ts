import { TEST_IDS } from '@payments/shared';
import { expect, test, type Page } from '@playwright/test';

import { captureEvidence } from '../support/evidence';

/**
 * Exercises `POST /checkout` end to end through the real database, seeded
 * catalogue and idempotency infrastructure — nothing here is mocked. "Sudadera
 * con Capucha Bruma" is used because it starts with plenty of stock (8 units in
 * the seed) and no other spec in this suite depletes it.
 */
const PRODUCT_NAME = 'Sudadera con Capucha Bruma';

async function openCheckoutModal(page: Page): Promise<void> {
  await page.goto('/');
  const card = page.locator('article', { has: page.getByText(PRODUCT_NAME) });
  await card.getByTestId(TEST_IDS.productPage.payWithCardButton).click();
  await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
}

async function fillValidForm(page: Page): Promise<void> {
  await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill('4242424242424242');
  await page.getByLabel('Nombre en la tarjeta').fill('Ana Perez');
  await page.getByLabel('Vencimiento (MM/AA)').fill('12/29');
  await page.getByTestId(TEST_IDS.checkoutModal.cvc).fill('123');
  await page.getByLabel('Correo electrónico').fill(`buyer-${Date.now()}@example.test`);
  await page.getByLabel('Nombre completo').fill('Ana Pérez');
  await page.getByLabel('Teléfono').first().fill('3001234567');
  await page.getByLabel('Documento de identidad').fill('1020304050');
  await page.getByLabel('Nombre de quien recibe').fill('Ana Pérez');
  await page.getByLabel('Teléfono').nth(1).fill('3001234567');
  await page.getByLabel('Dirección').fill('Calle 100 # 15-20');
  await page.getByLabel('Ciudad').fill('Bogotá');
  await page.getByLabel('Departamento').fill('Cundinamarca');
  await page.getByLabel('Código postal').fill('110111');
}

test.describe('Formulario de tarjeta y entrega', () => {
  test('detecta la marca VISA mientras se escribe el número', async ({ page }, testInfo) => {
    await openCheckoutModal(page);

    await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill('4242424242424242');

    await expect(page.getByTestId(TEST_IDS.checkoutModal.cardBrand)).toHaveAttribute(
      'aria-label',
      'visa',
    );
    await captureEvidence(page, testInfo, 'Modal de tarjeta con marca detectada');
  });

  test('rechaza un número de tarjeta inválido antes de llamar a la API', async ({ page }) => {
    await openCheckoutModal(page);
    await fillValidForm(page);
    await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill('1234');

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByText(/no es válido/i)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
  });

  test('abre el checkout y muestra la confirmación, sin recargar la página', async ({
    page,
  }, testInfo) => {
    await openCheckoutModal(page);
    await fillValidForm(page);

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByTestId(TEST_IDS.resultPage.status)).toBeVisible();
    await captureEvidence(page, testInfo, 'Confirmacion tras abrir el checkout');
  });

  test('restaura el paso del checkout tras recargar la página a mitad del formulario', async ({
    page,
  }) => {
    await openCheckoutModal(page);
    await page.getByLabel('Nombre completo').fill('Ana Pérez');

    await page.reload();

    await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
  });
});
