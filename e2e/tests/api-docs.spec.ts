import { expect, test } from '@playwright/test';

import { harness } from '../harness.config';
import { captureEvidence } from '../support/evidence';

/**
 * Evidence for the foundation stages, which have no user interface.
 *
 * Reaching this page at all proves more than documentation rendering: the API now
 * opens a database connection at boot, so a served Swagger UI means the schema,
 * the ORM configuration and the container wiring are all correct.
 */
test.describe('API documentation', () => {
  test('serves the OpenAPI explorer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture is enough for a docs page.');

    await page.goto(`http://localhost:${harness.apiPort}/${harness.apiPrefix}/docs`);

    await expect(page.locator('.swagger-ui').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payments checkout API' })).toBeVisible();
    // The documented liveness route proves the explorer loaded a real schema rather
    // than an empty shell.
    await expect(page.getByText('/api/v1/health')).toBeVisible();

    await captureEvidence(page, testInfo, 'Swagger UI con la API en linea');
  });
});
