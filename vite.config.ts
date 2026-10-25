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
    plugins: [react(), tailwindcss()],
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
