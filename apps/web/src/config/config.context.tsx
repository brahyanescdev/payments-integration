import { createContext, useContext, type ReactNode } from 'react';

import type { WebConfig } from './web-config';

const ConfigContext = createContext<WebConfig | null>(null);

/**
 * Supplies validated configuration to the tree.
 *
 * Configuration travels through context rather than a module-level singleton so
 * components never reach for `import.meta.env`, and so specs can render a slice of
 * the app against a fixture without touching the build environment.
 */
export function ConfigProvider({ value, children }: { value: WebConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** @throws Error when called outside a {@link ConfigProvider}. */
export function useConfig(): WebConfig {
  const config = useContext(ConfigContext);

  if (config === null) {
    throw new Error('useConfig must be used within a ConfigProvider.');
  }

  return config;
}
