/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. API Health Check Endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Setup Vite dev middleware or serve static production build
  const isRunningSource = process.argv[1] && process.argv[1].endsWith('.ts');
  const isProduction = (process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE) && !isRunningSource;

  if (!isProduction) {
    console.log('Running server in DEVELOPMENT mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running server in PRODUCTION mode with static file serving...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
