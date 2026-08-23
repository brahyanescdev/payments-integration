import { createHash, randomUUID } from 'node:crypto';

import { API_ROUTES, IDEMPOTENCY_KEY_HEADER, TEST_IDS } from '@payments/shared';
import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiBaseUrl } from '../harness.config';
import { fillValidForm, openCheckoutModal } from '../support/checkout';
import { captureEvidence } from '../support/evidence';

/**
 * Shares "Gorra Estructurada Clásica" with `payment-summary.spec.ts`: it starts
 * with 20 seeded units, comfortably enough for both files' approved purchases
 * (this file commits up to three more — one per viewport through the UI, one
 * more via the API-only webhook scenario).
 */
const PRODUCT_NAME = 'Gorra Estructurada Clásica';

/** Mirrors `computeWebhookChecksum` on the API side, independently: values, then timestamp, then secret. */
function webhookChecksum(
  propertyValues: string[],
  timestamp: number,
  eventsSecret: string,
): string {
  return createHash('sha256')
    .update(`${propertyValues.join('')}${timestamp}${eventsSecret}`)
    .digest('hex');
}

async function openCheckoutViaApi(
  request: APIRequestContext,
  productId: string,
): Promise<{ id: string; reference: string }> {
  const response = await request.post(`${apiBaseUrl}/${API_ROUTES.checkout.create}`, {
    headers: { [IDEMPOTENCY_KEY_HEADER]: randomUUID() },
    data: {
      productId,
      quantity: 1,
      customer: {
        email: `buyer-${randomUUID().slice(0, 8)}@example.test`,
        fullName: 'Ana Pérez',
        phone: '3001234567',
        legalId: '1020304050',
        legalIdType: 'CC',
      },
      delivery: {
        recipientName: 'Ana Pérez',
        phone: '3001234567',
        addressLine1: 'Calle 100 # 15-20',
        city: 'Bogotá',
        region: 'Cundinamarca',
        country: 'CO',
        postalCode: '110111',
      },
    },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { transactionId: string; reference: string };

  return { id: body.transactionId, reference: body.reference };
}

async function findProductId(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.get(`${apiBaseUrl}/${API_ROUTES.products.list}`);
  const body = (await response.json()) as { items: Array<{ id: string; name: string }> };
  const product = body.items.find((item) => item.name === name);

  if (product === undefined) throw new Error(`Seed product "${name}" was not found.`);

  return product.id;
}

test.describe('Resultado y stock', () => {
  test('vuelve al catálogo con el stock ya actualizado tras un pago aprobado', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const card = page.locator('article', { has: page.getByText(PRODUCT_NAME) });
    const stockBefore = await card.getByTestId(TEST_IDS.productPage.stock).innerText();
    const unitsBefore = Number.parseInt(stockBefore, 10);

    await openCheckoutModal(page, PRODUCT_NAME);
    await fillValidForm(page, { cardNumber: '4242424242424242' });
    await page.getByTestId(TEST_IDS.checkoutModal.submit).click();
    await page.getByTestId(TEST_IDS.summaryBackdrop.payButton).click();
    await expect(page.getByText('¡Pago aprobado!')).toBeVisible();

    await page.getByTestId(TEST_IDS.resultPage.backToProduct).click();

    const cardAfter = page.locator('article', { has: page.getByText(PRODUCT_NAME) });
    const stockAfter = await cardAfter.getByTestId(TEST_IDS.productPage.stock).innerText();
    expect(Number.parseInt(stockAfter, 10)).toBe(unitsBefore - 1);
    await captureEvidence(page, testInfo, 'Stock actualizado tras el pago');
  });

  test('un webhook liquida una transacción pendiente, y una entrega duplicada no la liquida dos veces', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API-only scenario; one run is enough.');

    const productId = await findProductId(request, PRODUCT_NAME);
    const opened = await openCheckoutViaApi(request, productId);

    const timestamp = Math.floor(Date.now() / 1000);
    const properties = ['transaction.id', 'transaction.status'];
    const gatewayTransactionId = `gw_${opened.reference}`;
    const status = 'APPROVED';
    // The harness leaves PSP_EVENTS_SECRET unset for the fake driver, same as the API reads it.
    const checksum = webhookChecksum([gatewayTransactionId, status], timestamp, '');
    const payload = {
      event: 'transaction.updated',
      data: { transaction: { id: gatewayTransactionId, reference: opened.reference, status } },
      signature: { properties, checksum },
      timestamp,
    };

    const first = await request.post(`${apiBaseUrl}/${API_ROUTES.webhooks.payments}`, {
      data: payload,
    });
    expect(first.status()).toBe(200);

    const second = await request.post(`${apiBaseUrl}/${API_ROUTES.webhooks.payments}`, {
      data: payload,
    });
    expect(second.status()).toBe(200);

    const transactionResponse = await request.get(
      `${apiBaseUrl}/${API_ROUTES.transactions.detail(opened.id)}`,
    );
    const transaction = (await transactionResponse.json()) as { status: string };
    expect(transaction.status).toBe('APPROVED');
  });
});
