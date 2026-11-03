import { defineConfig } from 'vite-plus';
import { resolve } from 'node:path';

export default defineConfig({
  // Native builds and signing depend on the host, provisioning profiles, and environment.
  run: { cache: false },
  // The renderer's `@/...` imports must resolve for the tests that import it.
  resolve: { alias: { '@': resolve(import.meta.dirname, 'apps/desktop/src/renderer') } },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true, denyWarnings: true },
  },
  fmt: {
    singleQuote: true,
    sortPackageJson: false,
    ignorePatterns: ['assets/brand/**', 'apps/raycast/raycast-env.d.ts'],
  },
});
