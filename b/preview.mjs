import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const allowed = new Set(['b/index.html', 'b/style.css', 'b/engine.mjs', 'b/game.mjs', 'b/loot.mjs',
  'a/visuals.mjs', 'a/sound.mjs', 'a/assets/weapon.png', 'a/assets/harbor.png',
  ...['checkpoint', 'tunnel', 'freight', 'harbor', 'warden', 'checkpoint-junction', 'tunnel-junction', 'freight-junction', 'harbor-junction'].map(id => `b/assets/${id}.png`)]);
const media = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const port = Number(process.argv[2] ?? 4320);
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname.slice(1);
  if (!path || path === 'b') { response.writeHead(302, { Location: '/b/' }).end(); return; }
  const file = path === 'b/' ? 'b/index.html' : path;
  if (!allowed.has(file)) { response.writeHead(404).end(); return; }
  try {
    const data = await readFile(new URL(`../${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': media[extname(file)], 'Cache-Control': 'no-cache' }).end(data);
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`B Demo: http://127.0.0.1:${port}/b/`));
