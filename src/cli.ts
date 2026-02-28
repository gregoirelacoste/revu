import { resolve } from 'node:path';
import { scan } from './core/engine.js';

const ROOT_DIR = resolve(process.argv[2] ?? process.cwd());
const BASE_BRANCH = process.argv[3] ?? 'develop';

console.log(`\x1b[36m◈ REVU v2\x1b[0m scanning ${ROOT_DIR} (base: ${BASE_BRANCH})`);

const result = await scan(ROOT_DIR, BASE_BRANCH);

const fileCount = result.repos.reduce((n, r) => n + r.files.length, 0);
console.log(`\x1b[32m✓\x1b[0m ${result.repos.length} repo(s), ${fileCount} file(s), ${result.links.length} link(s)`);
console.log(`\x1b[90m  config: stack=${result.config.stack}, weights=${JSON.stringify(result.config.scoring.weights)}\x1b[0m`);

// TODO: render(<App data={result} />) when TUI is ready
