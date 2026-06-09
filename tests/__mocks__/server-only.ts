// Mock for 'server-only' in vitest/node test environment.
// The real package throws when imported outside Next.js server context.
// In tests, we trust the test runner environment is server-side.
export {}
