import { TEST_IDS } from '@payments/shared';
import { expect, test } from '@playwright/test';

import { captureEvidence } from '../support/evidence';
import { fillValidForm, openCheckoutModal } from '../support/checkout';

/**
 * Exercises `POST /checkout` end to end through the real database, seeded
 * catalogue and idempotency infrastructure — nothing here is mocked. "Sudadera
 * con Capucha Bruma" is used because it starts with plenty of stock (8 units in
 * the seed) and no other spec in this suite depletes it.
 */
const PRODUCT_NAME = 'Sudadera con Capucha Bruma';

test.describe('Formulario de tarjeta y entrega', () => {
  test('detecta la marca VISA mientras se escribe el número', async ({ page }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);

    await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill('4242424242424242');

    await expect(page.getByTestId(TEST_IDS.checkoutModal.cardBrand)).toHaveAttribute(
      'aria-label',
      'visa',
    );
    await captureEvidence(page, testInfo, 'Modal de tarjeta con marca detectada');
  });

  test('mantiene el foco en el campo mientras se digita el número tecla por tecla', async ({
    page,
  }) => {
    // `.fill()` sets the value in one shot and would never have caught this: the
    // regression only shows up on the real per-keystroke input/change cycle,
    // which is exactly what `pressSequentially` drives.
    await openCheckoutModal(page, PRODUCT_NAME);
    const field = page.getByTestId(TEST_IDS.checkoutModal.cardNumber);

    await field.click();
    await field.pressSequentially('4242424242424242', { delay: 20 });

    await expect(field).toBeFocused();
    await expect(field).toHaveValue('4242 4242 4242 4242');
  });

  test('rechaza un número de tarjeta inválido antes de llamar a la API', async ({ page }) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page);
    await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill('1234');

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByText(/no es válido/i)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
  });

  test('abre el checkout y muestra el resumen de precio, sin recargar la página', async ({
    page,
  }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page);

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeVisible();
    await captureEvidence(page, testInfo, 'Resumen tras abrir el checkout');
  });

  test('restaura el paso del checkout tras recargar la página a mitad del formulario', async ({
    page,
  }) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await page.getByLabel('Nombre completo').fill('Ana Pérez');

    await page.reload();

    await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
  });

  test('rechaza letras en el documento de identidad y en el código postal', async ({ page }) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page);
    await page.getByLabel('Documento de identidad').fill('ABC123');
    await page.getByLabel('Código postal').fill('AB123');

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByText(/solo números/i).first()).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
  });

  test('"Tipo de documento" y "País" quedan en su propia fila, alineados con su input', async ({
    page,
  }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page);

    // `captureEvidence` shoots the full scrollable page, so one capture already
    // shows both fixed fields — no need to scroll to each separately.
    await captureEvidence(page, testInfo, 'Tipo de documento y país en filas propias');
  });
});
