// Kleiner lokaler Testserver: liefert die Dateien aus und beantwortet /api/artikel mit der Netlify-Funktion.
// Start: node dev-server.mjs  →  http://localhost:8080
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './netlify/functions/artikel.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const typen = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.yml': 'text/yaml', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pfad === '/api/artikel') {
    const r = await handler();
    res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(await r.text());
  }
  let datei = normalize(join(root, pfad));
  if (!datei.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (pfad.endsWith('/')) datei = join(datei, 'index.html');
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': typen[extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(root, '404.html')));
  }
}).listen(8080, () => console.log('http://localhost:8080'));
