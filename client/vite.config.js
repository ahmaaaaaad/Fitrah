import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset URLs: the build runs from any folder or host
  server: { host: true, fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: { inlineDynamicImports: true, entryFileNames: 'game.js', assetFileNames: '[name][extname]' },
    },
  },
});
