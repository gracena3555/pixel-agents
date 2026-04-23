import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { WebSocketServer } from 'ws';

import { JsonlWatcher } from './jsonlWatcher.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function startServer({ port, publicDir }) {
  // HTTP: serve static files from publicDir
  const server = http.createServer((req, res) => {
    let urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(publicDir, urlPath);
    if (!path.resolve(filePath).startsWith(path.resolve(publicDir))) {
      res.writeHead(403); res.end(); return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        // SPA fallback: index.html for unknown routes
        const fallback = path.join(publicDir, 'index.html');
        fs.readFile(fallback, (err2, data) => {
          if (err2) { res.writeHead(404); res.end('not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data);
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  // WebSocket: agent events only. Asset/layout/settings come from browserMock in the SPA.
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set();

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of clients) {
      if (c.readyState === 1) c.send(data);
    }
  }

  const watcher = new JsonlWatcher(broadcast);
  watcher.start();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[ws] client connected (${clients.size} total)`);
    // Defer existing-agent replay until browserMock has had a chance to dispatch
    // layoutLoaded. We send each as agentCreated (which doesn't depend on the
    // pendingAgents buffer drained inside layoutLoaded).
    setTimeout(() => {
      if (ws.readyState !== 1) return;
      const existing = watcher.getExistingAgents();
      for (const a of existing) {
        ws.send(JSON.stringify({ type: 'agentCreated', id: a.id, folderName: a.folderName }));
      }
    }, 400);
    ws.on('message', () => {
      // Webview -> server messages are ignored in MVP
    });
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[ws] client disconnected (${clients.size} remain)`);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      console.log(`[server] listening on http://127.0.0.1:${addr.port}`);
      resolve({ server, port: addr.port, watcher });
    });
  });
}
