import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/** One mock server shared by the whole suite; see `jest.setup.ts` for its lifecycle. */
export const server = setupServer(...handlers);
