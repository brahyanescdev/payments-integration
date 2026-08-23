import { TEST_IDS } from '@payments/shared';
import { expect, type Page } from '@playwright/test';

/** Opens the checkout modal (Screen 2) for the product card matching `productName`. */
export async function openCheckoutModal(page: Page, productName: string): Promise<void> {
  await page.goto('/');
  const card = page.locator('article', { has: page.getByText(productName) });
  await card.getByTestId(TEST_IDS.productPage.payWithCardButton).click();
  await expect(page.getByTestId(TEST_IDS.checkoutModal.root)).toBeVisible();
}

/**
 * Fills every field of the card + buyer + delivery form with valid values.
 *
 * `cardNumber` is the one field callers vary, since it is what selects the
 * gateway's sandbox outcome once the charge is submitted from the summary
 * screen. `email` defaults to a fresh value per call so the buyer's email
 * uniqueness never collides between test runs.
 */
export async function fillValidForm(
  page: Page,
  options: { cardNumber?: string; email?: string } = {},
): Promise<void> {
  const cardNumber = options.cardNumber ?? '4242424242424242';
  const email =
    options.email ?? `buyer-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

  await page.getByTestId(TEST_IDS.checkoutModal.cardNumber).fill(cardNumber);
  await page.getByLabel('Nombre en la tarjeta').fill('Ana Perez');
  await page.getByLabel('Vencimiento (MM/AA)').fill('12/29');
  await page.getByTestId(TEST_IDS.checkoutModal.cvc).fill('123');
  await page.getByLabel('Correo electrónico').fill(email);
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
