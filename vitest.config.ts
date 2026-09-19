import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock server-only in test environment — the package throws in non-Next.js context
      'server-only': path.resolve(__dirname, './tests/__mocks__/server-only.ts'),
    },
  },
  test: {
    globals: true,
    // 5s (the default) is too tight for this suite. Several tests do a dynamic
    // `await import()` of modules that pull in Next, Supabase and Resend; on a
    // cold transform cache — right after editing one of them — that alone can
    // exceed 5s while the rest of the suite competes for CPU. That produced
    // failures that vanished on the next run and passed in isolation.
    //
    // 15s is still far below "this test has hung", so a genuinely stuck or
    // broken test fails as loudly as before.
    testTimeout: 15_000,
    // Split by file type: .test.ts run in node (server actions, GST math, PDF
    // rendering via @react-pdf/renderer which needs node), .test.tsx run in jsdom
    // (React component tests that touch document/window).
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.tsx', 'tests/**/*.test.tsx'],
        },
      },
    ],
  },
})
