import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** ESLint 9 flat config (replaces .eslintrc.json — `next lint` was removed in Next 16). */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'supabase/functions/**'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // 49 pre-existing `any`s live in the GST/Tally data-munging modules;
      // retyping them is tracked cleanup, not a lint gate. Keep visible as warnings.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
