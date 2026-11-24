import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = { html: 'text/html; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  jpg: 'image/jpeg', png: 'image/png' };
const port = Number(process.argv[2] || 4340);

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/c') {
    response.writeHead(302, { Location: '/c/' }).end();
    return;
  }
  const asset = pathname === '/c/' ? 'index.html' : pathname.slice(3);
  if (!pathname.startsWith('/c/') || !/^(?:assets\/[a-z-]+\.(?:png|jpg)|[a-z-]+\.(?:html|mjs|css))$/.test(asset)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(new URL(asset, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[asset.split('.').at(-1)], 'Cache-Control': 'no-cache' }).end(data);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`C preview: http://127.0.0.1:${port}/c/`));
