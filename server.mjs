import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'style.css', 'game.js', 'engine.js', 'visuals.js'].includes(file)) { res.writeHead(404); res.end('No encontrado'); return; }
  try { const body = await readFile(new URL(file, import.meta.url)); res.setHeader('Content-Type', types[file.slice(file.lastIndexOf('.'))]); res.end(body); }
  catch { res.writeHead(500); res.end('No se pudo abrir el archivo'); }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
