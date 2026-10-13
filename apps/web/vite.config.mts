/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Public origin used for absolute URLs in index.html (og:image...). Override per environment:
//   VITE_SITE_URL=https://staging.kodinga.com npx nx build web
// ||= (not ??=): the Docker build passes an empty string when no URL is given
process.env.VITE_SITE_URL ||= 'https://kodinga.com';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server:{
    port: 4200,
    host: 'localhost',
    // Same paths as nginx in production (apps/web/nginx.conf). Not /admin/: it is the SPA admin;
    // the Django admin is at http://localhost:8000/admin/
    proxy: {
      '^/(api|static)/': 'http://localhost:8000',
    },
  },
  preview:{
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    // Mirrors "paths" in tsconfig.json (used by shadcn/ui imports)
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ tsconfigPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      treeshake: {
        // The ui lib is imported through one barrel (index.ts): mark its components side-effect free
        // so an unused component does not drag its deps/CSS (Quill, phone input, vaul...) into the bundle.
        moduleSideEffects: (id: string) => !(id.includes('/libs/ui/src/') && /\.tsx?$/.test(id)),
      },
    },
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    testTimeout: 15000,
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/web',
      provider: 'v8' as const,
    }
  },
}));
