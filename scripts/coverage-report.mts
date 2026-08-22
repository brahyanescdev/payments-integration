/**
 * Renders the coverage tables that get posted on a pull request.
 *
 * Reads Istanbul `coverage-summary.json` files produced by `jest --coverage` and
 * prints Markdown to stdout. The hard gate is not here — it lives in each
 * `jest.config.js` as a `coverageThreshold`, so a workspace below the bar has
 * already failed its own job. This step exists to make the number visible in
 * review instead of buried in a job log.
 *
 * ```bash
 * tsx scripts/coverage-report.mts api=apps/api/coverage/coverage-summary.json ...
 * ```
 */
import { existsSync, readFileSync } from 'node:fs';

/** Threshold mirrored from the Jest configs, used only to pick the status icon. */
const THRESHOLD = 80;

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

type Metric = (typeof METRICS)[number];

interface MetricTotals {
  total: number;
  covered: number;
  pct: number;
}

interface CoverageSummary {
  total: Record<Metric, MetricTotals>;
}

interface WorkspaceReport {
  label: string;
  summary: CoverageSummary | null;
}

const formatPct = (value: number): string => `${value.toFixed(2)}%`;

/** Parses `label=path` arguments into reports, tolerating a missing file. */
function readReports(args: string[]): WorkspaceReport[] {
  return args.map((arg) => {
    const separator = arg.indexOf('=');

    if (separator === -1) {
      throw new Error(`Expected "label=path" but received "${arg}".`);
    }

    const label = arg.slice(0, separator);
    const path = arg.slice(separator + 1);

    if (!existsSync(path)) {
      return { label, summary: null };
    }

    return { label, summary: JSON.parse(readFileSync(path, 'utf8')) as CoverageSummary };
  });
}

function renderRow({ label, summary }: WorkspaceReport): string {
  if (summary === null) {
    return `| \`${label}\` | — | — | — | — | ⚠️ sin reporte |`;
  }

  const cells = METRICS.map((metric) => formatPct(summary.total[metric].pct));
  const lowest = Math.min(...METRICS.map((metric) => summary.total[metric].pct));
  const status = lowest >= THRESHOLD ? '✅' : '❌';

  return `| \`${label}\` | ${cells.join(' | ')} | ${status} ${formatPct(lowest)} |`;
}

function main(): void {
  const reports = readReports(process.argv.slice(2));

  const lines = [
    '## Cobertura de tests',
    '',
    `Umbral exigido: **${THRESHOLD}%** en cada métrica. El corte lo aplica \`coverageThreshold\``,
    'dentro de cada `jest.config.js`, de modo que un workspace por debajo ya falló su job.',
    '',
    '| Workspace | Statements | Branches | Functions | Lines | Peor métrica |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...reports.map(renderRow),
    '',
    '<sub>Generado por `scripts/coverage-report.mts`. Playwright no participa de este',
    'porcentaje: cubre el sistema completo, no unidades.</sub>',
  ];

  console.log(lines.join('\n'));
}

main();
