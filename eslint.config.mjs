import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** ESLint 9 flat config (replaces .eslintrc.json — `next lint` was removed in Next 16). */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'supabase/functions/**'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // The GST/Tally `any`s have been retyped — hold the line at error so they
      // cannot creep back in.
      '@typescript-eslint/no-explicit-any': 'error',

      // Honour the leading-underscore convention the codebase already uses for
      // deliberately-unused parameters that must stay in a signature (props
      // contracts, callback arity, interface conformance).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // react-hook-form's useForm returns functions the React Compiler cannot
      // analyse, so it skips optimising those components. That is an upstream
      // library limitation, not a defect in this code, and there is no action
      // available to us beyond dropping react-hook-form.
      'react-hooks/incompatible-library': 'off',
    },
  },
]
