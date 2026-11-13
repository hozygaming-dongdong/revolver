import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const files = new Set(['index.html', 'game.js', 'rules.js', 'audio.js', 'style.css', 'assets/corridor.webp', 'assets/zombie.webp',
  'assets/cylinder-ui.webp', 'assets/ammo-cache.webp', 'assets/bounty-token.webp',
  'assets/gunslinger.png', 'assets/coin.png', 'assets/cartridge.png', 'assets/boss.webp', 'assets/boss-runner.webp', 'assets/boss-armored.webp',
  'assets/vault-bg-v2.png', 'assets/boss-v2.png', 'assets/cylinder-v2.png', 'assets/special-ammo-sheet-v2.png', 'assets/zombie-supply-v2.png', 'assets/zombie-special-v2.png', 'assets/zombie-bounty-v2.png',
  'assets/ui-hero-reset.png', 'assets/cylinder-reset.png', 'assets/ammo-sheet-reset.png', 'assets/target-reset.png',
  ...['doors', 'corridor', 'boss', 'weapon', 'loot', 'supply', 'bounty', 'special'].map(name => `assets/demo-${name}.webp`),
  'assets/chest-bronze.png', 'assets/chest-silver.png', 'assets/chest-gold.png', 'assets/final-cache.webp',
  'assets/vault-coin.jpg', 'assets/vault-ammo.jpg', 'assets/reward-empty.webp',
  ...['coin', 'cash'].flatMap(kind => Array.from({ length: 4 }, (_, tier) => `assets/reward-${kind}-${tier}.webp`))]);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const port = Number(process.argv[2] ?? 4197);

createServer(async (req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  const file = route.replace(/^\/(Revolver\/)?/, '') || 'index.html';
  if (!files.has(file)) { res.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL(file, import.meta.url));
    res.writeHead(200, { 'Content-Type': mime[extname(file)], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/Revolver/`));
