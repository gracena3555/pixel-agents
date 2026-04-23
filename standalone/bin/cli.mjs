#!/usr/bin/env node
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { startServer } from '../src/server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Built webview lives at ../dist/webview (relative to standalone/)
const PUBLIC_DIR = path.resolve(ROOT, '..', 'dist', 'webview');

if (!fs.existsSync(PUBLIC_DIR) || !fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  console.error(`[cli] webview build not found at ${PUBLIC_DIR}`);
  console.error('[cli] Run: npm run build (in standalone/)');
  process.exit(1);
}

const port = parseInt(process.env.PIXEL_AGENTS_PORT || '0', 10);
const noOpen = process.argv.includes('--no-open');

const { port: actualPort } = await startServer({ port, publicDir: PUBLIC_DIR });

const url = `http://127.0.0.1:${actualPort}/`;
console.log(`[cli] open ${url} in your browser`);

if (!noOpen) {
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(`${opener} ${url}`, (err) => {
    if (err) console.warn(`[cli] failed to auto-open: ${err.message}`);
  });
}

const shutdown = () => { console.log('\n[cli] shutting down'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
