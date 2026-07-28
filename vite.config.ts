import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      // HMR can be disabled for constrained local or container environments.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching with HMR to reduce CPU usage when requested.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
