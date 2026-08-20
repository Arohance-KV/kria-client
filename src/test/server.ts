import { setupServer } from 'msw/node';

// Network-layer mock. Add per-test handlers with server.use(...).
// ponytail: empty by default — mocks live in the tests that need them.
export const server = setupServer();
