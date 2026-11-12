import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // error.html is Android's server.errorPath page (capacitor.config.ts).
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        error: resolve(import.meta.dirname, 'error.html'),
      },
    },
  },
});
