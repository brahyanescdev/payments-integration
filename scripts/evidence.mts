/**
 * Captures the visual evidence that accompanies every pull request.
 *
 * ```bash
 * pnpm evidence
 * ```
 *
 * Builds the deployable artefacts, drives them with Playwright, and writes the
 * screenshots plus an index into `docs/evidence/<branch>/`.
 *
 * The pull-request description is *not* produced here: it links every image by
 * commit SHA, and that SHA does not exist until the captures are committed and
 * pushed. Run `pnpm pr:body` after the push.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface EvidenceEntry {
  order: number;
  label: string;
  file: string;
  project: string;
  viewport: string;
  title: string;
}

const run = (command: string, args: string[], env: NodeJS.ProcessEnv = {}): void => {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
};

const capture = (command: string, args: string[]): string =>
  execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8' }).trim();

/** Slug used for the evidence folder; matches the branch so PRs never collide. */
const branchSlug = (branch: string): string => branch.replace(/[^a-zA-Z0-9._-]+/g, '-');

/** Writes the browsable index that lives beside the captures in the repository. */
function writeEvidenceIndex(evidenceDir: string, branch: string, entries: EvidenceEntry[]): void {
  const rows = entries
    .map((entry) => `| ${entry.order} | ${entry.label} | ${entry.viewport} | \`${entry.file}\` |`)
    .join('\n');

  const sections = entries.map(
    (entry) => `## ${entry.order}. ${entry.label}\n\n![${entry.label}](${entry.file})\n`,
  );

  writeFileSync(
    join(evidenceDir, 'README.md'),
    [
      `# Evidencia — \`${branch}\``,
      '',
      `Capturas generadas por \`pnpm evidence\` el ${new Date().toISOString().slice(0, 10)}.`,
      '',
      '| # | Caso | Viewport | Archivo |',
      '| --- | --- | --- | --- |',
      rows,
      '',
      ...sections,
    ].join('\n'),
    'utf8',
  );
}

/** Reads the JSONL the specs appended to, and rewrites it as an ordered manifest. */
function readManifest(evidenceDir: string): EvidenceEntry[] {
  const manifestPath = join(evidenceDir, 'manifest.jsonl');

  if (!existsSync(manifestPath)) {
    throw new Error(
      'The run captured no evidence. Add `captureEvidence(...)` calls to the specs covering this change.',
    );
  }

  // Playwright runs each project in its own module instance, so the in-process
  // counter restarts per project. Renumbering by append order gives the index a
  // single, continuous sequence.
  const entries = readFileSync(manifestPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => ({ ...(JSON.parse(line) as EvidenceEntry), order: index + 1 }));

  rmSync(manifestPath);

  // Kept beside the captures: `pnpm pr:body` reads it to build the description, and
  // it documents what each image proves for anyone browsing the folder later.
  writeFileSync(
    join(evidenceDir, 'manifest.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8',
  );

  return entries;
}

function main(): void {
  const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (branch === 'main') {
    throw new Error('Evidence is captured on a feature branch, not on main.');
  }

  const slug = branchSlug(branch);
  const evidenceDir = join(repoRoot, 'docs', 'evidence', slug);

  // Start from a clean folder so a removed scenario cannot leave a stale image behind.
  rmSync(evidenceDir, { recursive: true, force: true });
  mkdirSync(evidenceDir, { recursive: true });

  console.warn('Building deployable artefacts…');
  run('pnpm', ['build'], { VITE_API_BASE_URL: 'http://localhost:3000/api/v1' });

  console.warn('Running the end-to-end suite with capture enabled…');
  run('pnpm', ['e2e'], { EVIDENCE_DIR: evidenceDir });

  const entries = readManifest(evidenceDir);

  writeEvidenceIndex(evidenceDir, branch, entries);

  console.warn(`\n${entries.length} capturas en docs/evidence/${slug}`);
  console.warn('Siguiente paso. La descripcion del PR se genera despues del push,');
  console.warn('porque enlaza las imagenes por SHA de commit y ese SHA aun no existe:');
  console.warn(
    `  git add docs/evidence/${slug} && git commit -m "docs(e2e): evidencia de ${branch}"`,
  );
  console.warn('  git push -u origin HEAD');
  console.warn('  pnpm pr:body');
}

main();
