/**
 * Where to look for the `.env` file.
 *
 * A single `.env` lives at the repository root so the API, the ORM CLI and the
 * seeder all read one file. Commands run from either the root or `apps/api`
 * depending on the tool, so both candidates are listed and the first that exists
 * wins. Values already present in the process environment always take precedence,
 * which is what lets CI and the deployed container inject configuration without a
 * file at all.
 */
export const ENV_FILE_CANDIDATES = ['.env', '../../.env'] as const;
