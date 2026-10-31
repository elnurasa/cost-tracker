import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Content-Security-Policy for the production build (v1 makes no network requests, so connect-src is 'self' only:
 * the service worker needs it to read its own precache; there is no third-party host to allow).
 * Inline styles are allowed because of the boot skeleton and React style attributes; scripts are NOT inline.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'sakin-csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  },
});

export default defineConfig({
  // sub-path hosting (GitHub Pages project site) sets BASE_PATH, e.g. "/cost-tracker/"; local and root hosts keep "/"
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // lean precache: Onest subsets this app never renders (Vietnamese, math, symbols) are skipped; latin, latin-ext (AZ/TR) and cyrillic stay
        globIgnores: ['**/onest-vietnamese-*', '**/onest-math-*', '**/onest-symbols-*', '**/onest-cyrillic-ext-*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        // brand-neutral on purpose: a static manifest cannot follow the in-app language. The page title and meta tags are localized at runtime
        name: 'Sakin',
        short_name: 'Sakin',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F2F5F3',
        theme_color: '#0F6B63',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // stable vendor chunks: app code changes do not invalidate React/Dexie in the browser cache
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 20 },
            { name: 'dexie', test: /node_modules[\/]dexie/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
