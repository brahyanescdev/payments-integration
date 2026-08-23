import { TEST_IDS } from '@payments/shared';
import { expect, test } from '@playwright/test';

import { fillValidForm, openCheckoutModal } from '../support/checkout';
import { captureEvidence } from '../support/evidence';

/**
 * Exercises `POST /checkout/:id/pay` end to end against the fake gateway driver
 * (`PAYMENT_GATEWAY_DRIVER=fake` — see `harness.config.ts`): real tokenisation
 * call, real signature-free charge submission, real settlement and stock
 * movement, all through the actual database. Only the sandbox network call
 * itself is stubbed, which is exactly the boundary the hexagonal port exists to
 * let a test cross.
 *
 * A different product than `checkout-form.spec.ts` on purpose: this file reserves
 * stock four times per viewport (one per test), and "Gorra Estructurada Clásica"
 * starts with enough seeded stock (20 units) to absorb that without touching
 * whatever the rest of the suite reserves against the sweatshirt.
 */
const PRODUCT_NAME = 'Gorra Estructurada Clásica';

/** Luhn-valid 16-digit numbers whose last four digits select the sandbox outcome. */
const CARDS = {
  approved: '4242424242424242',
  declined: '4000000000061111',
  error: '4000000000069999',
} as const;

test.describe('Resumen y pago', () => {
  test('muestra el desglose de precio antes de pagar', async ({ page }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page, { cardNumber: CARDS.approved });

    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();

    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.total)).toBeVisible();
    await captureEvidence(page, testInfo, 'Resumen con desglose de precio');
  });

  test('aprueba el pago con una tarjeta terminada en 4242', async ({ page }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page, { cardNumber: CARDS.approved });
    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();
    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeVisible();

    await page.getByTestId(TEST_IDS.summaryBackdrop.payButton).click();

    await expect(page.getByText('¡Pago aprobado!')).toBeVisible();
    await captureEvidence(page, testInfo, 'Pago aprobado');
  });

  test('rechaza el pago con una tarjeta terminada en 1111', async ({ page }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page, { cardNumber: CARDS.declined });
    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();
    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeVisible();

    await page.getByTestId(TEST_IDS.summaryBackdrop.payButton).click();

    await expect(page.getByText('Pago rechazado')).toBeVisible();
    await captureEvidence(page, testInfo, 'Pago rechazado');
  });

  test('reporta un error del gateway con cualquier otra tarjeta', async ({ page }, testInfo) => {
    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page, { cardNumber: CARDS.error });
    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();
    await expect(page.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeVisible();

    await page.getByTestId(TEST_IDS.summaryBackdrop.payButton).click();

    await expect(page.getByText('No pudimos procesar el pago')).toBeVisible();
    await captureEvidence(page, testInfo, 'Error del gateway');
  });
});
