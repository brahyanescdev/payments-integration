/**
 * Reads the raw build environment exactly once.
 *
 * This is the only module in the frontend allowed to touch `import.meta.env`; the
 * ESLint rule `no-restricted-syntax` rejects it anywhere else. Everything
 * downstream consumes the validated {@link WebConfig} through `useConfig`.
 */
import { loadWebConfig, type WebConfig } from './web-config';

export const webConfig: WebConfig = loadWebConfig(import.meta.env);

export { ConfigProvider, useConfig } from './config.context';
export { loadWebConfig } from './web-config';
export type { WebConfig } from './web-config';
