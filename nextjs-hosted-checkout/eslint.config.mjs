import js from '@eslint/js'
import nextVitals from 'eslint-config-next/core-web-vitals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...nextVitals,
  ...tseslint.configs.recommended,
  { ignores: ['.next/**', 'node_modules/**', 'generated/**'] },
)
