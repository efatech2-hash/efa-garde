import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'process.env.SUPER_ADMIN_EMAIL': JSON.stringify(
        env.VITE_SUPER_ADMIN_EMAIL || env.SUPER_ADMIN_EMAIL || process.env.VITE_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'efatech2@gmail.com'
      ),
      'process.env.SUPER_ADMIN_PASSWORD': JSON.stringify(
        env.VITE_SUPER_ADMIN_PASSWORD || env.SUPER_ADMIN_PASSWORD || process.env.VITE_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || '2hcetafe'
      ),
      'process.env.WHATSAPP_NUMBER': JSON.stringify(
        env.VITE_WHATSAPP_NUMBER || env.WHATSAPP_NUMBER || process.env.VITE_WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER || '22896100972'
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'EFA Garde',
          short_name: 'EFA Garde',
          description: 'Application EFA Garde',
          theme_color: '#0b5cb5',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'portrait-primary',
          lang: 'fr',
          categories: ['medical', 'health', 'navigation'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
          runtimeCaching: [
            {
              // Never cache or interfere with Supabase Auth, REST, Storage, or Realtime
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Never cache internal API endpoints
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Cache Google Fonts stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              // Cache Google Fonts webfont files
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              // Cache Leaflet CSS/assets from unpkg
              urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'leaflet-assets',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      {
        name: 'admin-login-dev-middleware',
        configureServer(server) {
          server.middlewares.use('/api/admin/login', async (req: any, res: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez POST.' }));
              return;
            }

            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const raw = Buffer.concat(buffers).toString('utf-8');
            let body: any = {};
            try {
              body = JSON.parse(raw);
            } catch {
              body = {};
            }

            const reqEmail = String(body.email || '').trim().toLowerCase();
            const reqPassword = String(body.password || '').trim();

            const expectedEmail = String(
              env.VITE_SUPER_ADMIN_EMAIL ||
                env.SUPER_ADMIN_EMAIL ||
                process.env.VITE_SUPER_ADMIN_EMAIL ||
                process.env.SUPER_ADMIN_EMAIL ||
                'efatech2@gmail.com'
            )
              .trim()
              .toLowerCase();

            const expectedPassword = String(
              env.VITE_SUPER_ADMIN_PASSWORD ||
                env.SUPER_ADMIN_PASSWORD ||
                process.env.VITE_SUPER_ADMIN_PASSWORD ||
                process.env.SUPER_ADMIN_PASSWORD ||
                '2hcetafe'
            ).trim();

            if (reqEmail === expectedEmail && reqPassword === expectedPassword) {
              const b64 = (obj: any) =>
                Buffer.from(JSON.stringify(obj))
                  .toString('base64')
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=+$/, '');

              const now = Math.floor(Date.now() / 1000);
              const header = b64({ alg: 'HS256', typ: 'JWT' });
              const payload = b64({
                sub: 'super_admin',
                email: reqEmail,
                role: 'super_admin',
                iat: now,
                exp: now + 86400,
              });
              const sig = Buffer.from('efa_admin_sig')
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
              const token = `${header}.${payload}.${sig}`;

              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  message: 'Authentification Super Admin réussie.',
                  token,
                  super_admin_token: token,
                  redirect: '/#/efa-admin',
                })
              );
            } else {
              res.statusCode = 401;
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Identifiants Super Admin invalides. Accès strictement réservé.',
                })
              );
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
