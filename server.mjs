import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const FILES = ['index.html', 'style.css', 'game.js', 'engine.js', 'visuals.js', 'skins.js', 'net.js', 'save.js', 'events.js', 'hands.js', 'album.js', 'missions.js', 'words.js', 'aquarium.js', 'report.js', 'familycode.js', 'cloud.js'];
// The family-code function runs here too, with the credentials `vercel env pull` wrote to .env.local
// (locally it uses the development keys, never the real families).
async function loadEnv() {
  try {
    for (const line of (await readFile(new URL('.env.local', import.meta.url), 'utf8')).split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
    }
  } catch { /* Without .env.local the game still runs; only the family code is unavailable. */ }
}
let api = null;
async function callApi(req, res) {
  try {
    api ||= await loadEnv().then(() => import('./api/progress.js'));
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = new Request(new URL(req.url, 'http://localhost'), { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await (api[req.method] || (() => Response.json({ error: 'Método no permitido.' }, { status: 405 })))(request);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'El guardado en línea no está disponible.' })); }
}
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/progress') return callApi(req, res);
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!FILES.includes(file)) { res.writeHead(404); res.end('No encontrado'); return; }
  try { const body = await readFile(new URL(file, import.meta.url)); res.setHeader('Content-Type', types[file.slice(file.lastIndexOf('.'))]); res.end(body); }
  catch { res.writeHead(500); res.end('No se pudo abrir el archivo'); }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
