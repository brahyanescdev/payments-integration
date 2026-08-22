import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

/** Set by `pnpm evidence`; absent during ordinary test runs. */
const evidenceDir = process.env.EVIDENCE_DIR;

/** One row of the evidence index, appended as JSONL so parallel writes stay safe. */
interface EvidenceEntry {
  order: number;
  label: string;
  file: string;
  project: string;
  viewport: string;
  title: string;
}

let captureCount = 0;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Captures a screenshot as pull-request evidence.
 *
 * A no-op unless `EVIDENCE_DIR` is set, so the assertion suite stays fast in CI and
 * the same specs serve both purposes — evidence never drifts from what is tested.
 *
 * Screenshots are written at the project's device scale (1), which keeps the
 * committed PNGs small enough to live in the repository without bloating clones.
 *
 * @param page - Page to capture.
 * @param testInfo - Ambient test metadata, used to record project and viewport.
 * @param label - Human-readable description of what the capture proves.
 */
export async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  if (!evidenceDir) return;

  mkdirSync(evidenceDir, { recursive: true });

  captureCount += 1;
  const order = captureCount;
  const viewport = page.viewportSize();
  const viewportLabel = viewport ? `${viewport.width}x${viewport.height}` : 'unknown';
  const file = `${String(order).padStart(2, '0')}-${slugify(testInfo.project.name)}-${slugify(label)}.png`;

  await page.screenshot({ path: join(evidenceDir, file), fullPage: true });

  const entry: EvidenceEntry = {
    order,
    label,
    file,
    project: testInfo.project.name,
    viewport: viewportLabel,
    title: testInfo.title,
  };

  appendFileSync(join(evidenceDir, 'manifest.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
}
