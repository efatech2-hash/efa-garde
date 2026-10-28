import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

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
