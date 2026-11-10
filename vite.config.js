import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './', // relative paths so the bundle loads from the app's local files
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', target: 'es2020' },
});
