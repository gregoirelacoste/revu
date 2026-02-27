import { Router } from 'express';
import { ReviewStore } from '../review/review-store.js';

const SAFE_NAME = /^[a-zA-Z0-9_.-]+$/;

export function createReviewRouter(rootDir: string): Router {
  const router = Router();
  const store = new ReviewStore(rootDir);

  router.get('/review/:repo/:branch', async (req, res) => {
    const { repo, branch } = req.params;
    if (!SAFE_NAME.test(repo) || !SAFE_NAME.test(branch)) {
      res.status(400).json({ error: 'Invalid repo or branch name' });
      return;
    }
    try {
      const data = await store.load(repo, branch);
      res.json(data ?? { version: 1, repo, branch, files: {} });
    } catch {
      res.status(500).json({ error: 'Failed to load review' });
    }
  });

  router.put('/review/:repo/:branch', async (req, res) => {
    const { repo, branch } = req.params;
    if (!SAFE_NAME.test(repo) || !SAFE_NAME.test(branch)) {
      res.status(400).json({ error: 'Invalid repo or branch name' });
      return;
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || typeof body.version !== 'number' || typeof body.files !== 'object') {
      res.status(400).json({ error: 'Invalid review body: requires version (number) and files (object)' });
      return;
    }
    try {
      await store.save(repo, branch, body);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to save review' });
    }
  });

  return router;
}
