import { API_ROUTES, TEST_IDS, healthResponseSchema } from '@payments/shared';
import { expect, test } from '@playwright/test';

import { apiBaseUrl } from '../harness.config';
import { captureEvidence } from '../support/evidence';

test.describe('walking skeleton', () => {
  test('the API reports itself healthy with a contract-compliant payload', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/${API_ROUTES.health}`);

    expect(response.status()).toBe(200);
    expect(healthResponseSchema.safeParse(await response.json()).success).toBe(true);
  });

  test('the SPA boots and renders its shell', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByTestId(TEST_IDS.appShell)).toBeVisible();

    await captureEvidence(page, testInfo, 'Shell de la aplicacion');
  });
});
