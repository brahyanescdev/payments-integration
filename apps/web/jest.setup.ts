import '@testing-library/jest-dom';

import { server } from './src/testing/msw/server';

// `onUnhandledRequest: 'error'` turns a forgotten handler into a loud test
// failure instead of a request that silently falls through to the real network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
