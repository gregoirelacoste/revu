import express from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createScanRouter } from './routes/scan.routes.js';
import { createReviewRouter } from './routes/review.routes.js';

export function createServer(rootDir: string, port = 3847) {
  const app = express();
  app.use(cors({ origin: ['http://localhost:5173', `http://localhost:${port}`] }));
  app.use(express.json({ limit: '5mb' }));

  // API routes
  app.use('/api', createScanRouter(rootDir));
  app.use('/api', createReviewRouter(rootDir));

  // Serve built frontend in production (dist/web/)
  const webDir = join(import.meta.dirname ?? __dirname, '..', '..', 'dist', 'web');
  if (existsSync(webDir)) {
    app.use(express.static(webDir));
    app.get('*', (_req, res) => {
      res.sendFile(join(webDir, 'index.html'));
    });
  }

  return app.listen(port, '127.0.0.1', () => {
    console.log(`\x1b[36m◈ REVU\x1b[0m running at http://localhost:${port}`);
  });
}
