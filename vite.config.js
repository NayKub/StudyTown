import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// VITE_CLOUD_MOCK=1 swaps the Firebase backend for an in-memory one (npm run dev:mock).
const cloud = process.env.VITE_CLOUD_MOCK ? './src/platform/cloud-mock.js' : './src/platform/cloud.js';

export default defineConfig({
  base: './', // relative paths so the bundle loads from the app's local files
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '#cloud': fileURLToPath(new URL(cloud, import.meta.url)) } },
  build: { outDir: 'dist', target: 'es2020' },
});
