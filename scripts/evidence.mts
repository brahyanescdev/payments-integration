/**
 * Produces the visual evidence that accompanies every pull request.
 *
 * Run before opening a PR:
 *
 * ```bash
 * pnpm evidence
 * ```
 *
 * It builds the deployable artefacts, drives them with Playwright, collects the
 * screenshots the specs captured, writes an index next to them, and emits a ready
 * pull-request body.
 *
 * The body links images by absolute `raw.githubusercontent.com` URL on purpose:
 * GitHub does not render repository-relative image paths inside a pull-request
 * description, only inside committed Markdown files. That is also why the captures
 * must be committed and pushed on the feature branch *before* the PR is created —
 * the URL has to resolve when GitHub fetches it.
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

/**
 * Derives `owner/repo` from the origin remote, covering both SSH and HTTPS forms.
 * @throws Error when the remote is missing or unrecognised, since a PR body with
 *   broken image links is worse than no PR body at all.
 */
const originSlug = (): string => {
  const remote = capture('git', ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);

  if (!match?.groups) {
    throw new Error(`Cannot derive the GitHub repository from origin remote "${remote}".`);
  }

  return `${match.groups.owner}/${match.groups.repo}`;
};

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

/** Emits the pull-request description, with images linked by absolute raw URL. */
function writePrBody(branch: string, slug: string, entries: EvidenceEntry[]): string {
  const rawBase = `https://raw.githubusercontent.com/${originSlug()}/${branch}/docs/evidence/${slug}`;

  const body = [
    '## Qué cambia',
    '',
    '<!-- Alcance de la rebanada: endpoint, pantalla y regla de negocio. -->',
    '',
    '## Evidencia de los casos de prueba',
    '',
    ...entries.map(
      (entry) =>
        `### ${entry.label} — ${entry.viewport}\n\n![${entry.label}](${rawBase}/${entry.file})\n`,
    ),
    '## Checklist',
    '',
    '- [ ] Tests unitarios (Jest) añadidos junto al código de este PR',
    '- [ ] Cobertura ≥ 80% en los workspaces tocados',
    '- [x] Capturas de los casos de prueba adjuntas',
    '- [ ] OpenAPI / README actualizados si el contrato cambió',
    '- [ ] Sin secretos ni valores quemados en el diff',
    '',
  ].join('\n');

  const path = join(repoRoot, '.github', 'pr-body.md');
  writeFileSync(path, body, 'utf8');

  return path;
}

/** Reads and clears the JSONL manifest the specs appended to during the run. */
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
  const prBodyPath = writePrBody(branch, slug, entries);

  console.warn(`\n${entries.length} capturas en docs/evidence/${slug}`);
  console.warn(`Cuerpo del PR listo en ${prBodyPath}. Siguiente paso:`);
  console.warn(
    `  git add docs/evidence/${slug} && git commit -m "docs(e2e): evidencia de ${branch}"`,
  );
  console.warn('  git push -u origin HEAD');
  console.warn('  gh pr create --body-file .github/pr-body.md');
}

main();
