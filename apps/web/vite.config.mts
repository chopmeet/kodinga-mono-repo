/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server:{
    port: 4200,
    host: 'localhost',
    // Same paths as nginx in production (apps/web/nginx.conf)
    proxy: {
      '^/(api|admin|static)/': 'http://localhost:8000',
    },
  },
  preview:{
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  resolve: {
    // Mirrors "paths" in tsconfig.json (used by shadcn/ui imports)
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/web',
      provider: 'v8' as const,
    }
  },
}));
