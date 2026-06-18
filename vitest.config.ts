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
