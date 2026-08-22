/**
 * Builds the pull-request description from the captured evidence.
 *
 * ```bash
 * pnpm pr:body            # writes .github/pr-body.md
 * pnpm pr:body --apply    # and pushes it onto the open PR
 * ```
 *
 * Run **after** pushing the branch. Two properties matter here:
 *
 * 1. **Images are linked by commit SHA, never by branch name.** A branch URL stops
 *    resolving the moment the branch is deleted — which is exactly what a squash
 *    merge with `--delete-branch` does, silently breaking every image in the merged
 *    pull request. GitHub keeps `refs/pull/N/head` forever, so a SHA URL is
 *    permanent.
 * 2. **Every URL is fetched before the body is written.** A description with a dead
 *    image is worse than no description, so a non-200 aborts the run instead of
 *    producing a broken page.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

const capture = (command: string, args: string[]): string =>
  execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8' }).trim();

const branchSlug = (branch: string): string => branch.replace(/[^a-zA-Z0-9._-]+/g, '-');

/**
 * Derives `owner/repo` from the origin remote, covering SSH and HTTPS forms.
 * @throws Error when the remote is missing or unrecognised.
 */
function originSlug(): string {
  const remote = capture('git', ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);

  if (!match?.groups) {
    throw new Error(`Cannot derive the GitHub repository from origin remote "${remote}".`);
  }

  return `${match.groups.owner}/${match.groups.repo}`;
}

/**
 * Returns the pushed commit the images will be linked to.
 * @throws Error when the local branch has commits the remote has not seen, since
 *   those blobs are not fetchable by URL yet.
 */
function pushedCommit(branch: string): string {
  const head = capture('git', ['rev-parse', 'HEAD']);

  let remoteHead: string;
  try {
    remoteHead = capture('git', ['rev-parse', `origin/${branch}`]);
  } catch {
    throw new Error(`Branch "${branch}" has not been pushed yet. Run: git push -u origin HEAD`);
  }

  if (head !== remoteHead) {
    throw new Error(
      `HEAD (${head.slice(0, 7)}) differs from origin/${branch} (${remoteHead.slice(0, 7)}). ` +
        'Push before generating the body, or the image URLs will not resolve.',
    );
  }

  return head;
}

/** Fails the run if any image is not publicly fetchable. */
async function assertAllResolve(urls: string[]): Promise<void> {
  const results = await Promise.all(
    urls.map(async (url) => ({ url, status: (await fetch(url, { method: 'HEAD' })).status })),
  );

  const broken = results.filter((result) => result.status !== 200);

  if (broken.length > 0) {
    const detail = broken.map((result) => `  - ${result.status} ${result.url}`).join('\n');
    throw new Error(`These evidence images are not reachable:\n${detail}`);
  }
}

function renderBody(rawBase: string, entries: EvidenceEntry[]): string {
  return [
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
    '- [x] Capturas de los casos de prueba adjuntas y verificadas',
    '- [ ] OpenAPI / README actualizados si el contrato cambió',
    '- [ ] Sin secretos ni valores quemados en el diff',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (branch === 'main') {
    throw new Error('Pull-request bodies are generated on a feature branch, not on main.');
  }

  const slug = branchSlug(branch);
  const manifestPath = join(repoRoot, 'docs', 'evidence', slug, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new Error(`No evidence found for "${branch}". Run \`pnpm evidence\` first.`);
  }

  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as EvidenceEntry[];
  const commit = pushedCommit(branch);
  const rawBase = `https://raw.githubusercontent.com/${originSlug()}/${commit}/docs/evidence/${slug}`;

  await assertAllResolve(entries.map((entry) => `${rawBase}/${entry.file}`));

  const body = renderBody(rawBase, entries);
  const bodyPath = join(repoRoot, '.github', 'pr-body.md');
  writeFileSync(bodyPath, body, 'utf8');

  console.warn(
    `${entries.length} imagenes verificadas (HTTP 200) en el commit ${commit.slice(0, 7)}.`,
  );

  if (process.argv.includes('--apply')) {
    execFileSync('gh', ['pr', 'edit', '--body-file', bodyPath], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    console.warn('Descripcion del PR actualizada.');
    return;
  }

  console.warn(`Cuerpo listo en ${bodyPath}. Siguiente paso:`);
  console.warn('  gh pr create --body-file .github/pr-body.md');
  console.warn('  # o, si el PR ya existe: pnpm pr:body --apply');
}

await main();
