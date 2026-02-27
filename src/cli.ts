import { resolve } from 'node:path';
import { createServer } from './server/index.js';

const PORT = parseInt(process.env.REVU_PORT ?? '3847', 10);
const ROOT_DIR = resolve(process.argv[2] ?? process.cwd());

console.log(`\x1b[36m◈ REVU\x1b[0m scanning ${ROOT_DIR}`);

createServer(ROOT_DIR, PORT);

// Open browser after short delay
setTimeout(async () => {
  try {
    const open = await import('open');
    await open.default(`http://localhost:${PORT}`);
  } catch {
    // Ignore if open fails
  }
}, 500);
