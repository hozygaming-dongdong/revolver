import { icon, cylinder } from '../a/visuals.mjs';
import { soundscape } from '../a/sound.mjs';
import { START_BALANCE, BETS, RARITIES, loaded, remaining, randomIndex, newRun, takeRoute, beginShot, resolveShot, startDraw, settleDraw } from './engine.mjs';

const $ = id => document.getElementById(id);
const app = $('game'), audio = soundscape();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, reduced ? ms * .35 : ms));
const money = n => `NT$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const odds = n => `${(n * 100 / 6).toFixed(1)}%`;
const x = n => `${n}×`;
const slots = n => Array.from({ length: 6 }, (_, i) => i < n);
const scenes = [
  ['QUARANTINE CHECKPOINT', 'The Infected', 'checkpoint', 'The city is sealed. The last boat is still waiting.'],
  ['SERVICE TUNNEL', 'The Crawler', 'tunnel', 'Stay on the tracks. The exits are ahead.'],
  ['FREIGHT YARD', 'The Dockworker', 'freight', 'The cranes stopped. Something stayed behind.'],
  ['HARBOR APPROACH', 'The Harbor Guard', 'harbor', 'The lights are on. One gate left.'],
  ['EVACUATION GATE', 'The Warden', 'warden', 'Clear the gate to unlock the bounty cylinder.'],
];
const names = { conserve: 'CONSERVE', charge: 'CHARGE', armory: 'ARMORY', security: 'SECURITY', radio: 'RADIO', boss: 'BOSS' };
const icons = { conserve: 'supply', charge: 'breach', armory: 'bullet', security: 'target', radio: 'radio', boss: 'skull' };
const preloaded = new Set();
let run = null, bet = 100, muted = false;

function preload(path) {
  if (!preloaded.has(path)) {
    preloaded.add(path);
    const img = new Image(); img.src = path;
  }
}

function board(tokens) {
  const prizes = remaining(tokens);
  return `<div class="board-title"><span>BOUNTY POOL · ${prizes.length} SLOTS</span><strong>${tokens} X COLLECTED</strong></div><div class="board" style="--slots:${prizes.length}" aria-label="Bounty prizes">${prizes.map((p, i) => `<span class="prize-chip ${i === prizes.length - 1 ? 'top-prize' : ''}">${x(p)}</span>`).join('')}</div>`;
}

function note(route, before) {
  if (route.kind === 'conserve') return before === 5 ? 'Keep five on hit' : 'Reload before shot';
  if (route.kind === 'charge') return before === 5 ? 'Spend one on hit' : 'Reload on hit';
  if (route.kind === 'armory') return 'Extra round on hit';
  if (route.kind === 'security') return 'Marked live slots';
  return `Next: Orange ${names[route.reserve] === 'CHARGE' ? 'Charge' : 'Conserve'}`;
}

function routeCard(route) {
  const n = loaded(route.aim), rarity = RARITIES[route.tier];
  const reward = route.kind === 'security' ? '1 / 4' : route.max;
  const detail = note(route, loaded(run.chambers));
  return `<button class="route-card ${rarity.toLowerCase()} ${['conserve', 'charge'].includes(route.kind) ? route.kind : 'event'}" data-route="${route.kind}" aria-label="${rarity} ${names[route.kind]}. Hit ${odds(n)}. On hit ${reward} X and ${route.resultCount} live chambers. ${detail}."><span class="route-rarity">${rarity}</span><span class="route-name">${icon(icons[route.kind])}${names[route.kind]}</span><span class="odds">${icon('target')}${odds(n)}<span class="miss">${odds(6-n)}</span></span><strong class="prize-badge">${reward} X</strong><span class="route-note">${detail}</span><span class="after">AFTER HIT${cylinder(slots(route.resultCount))}</span></button>`;
}

function betControls(balance) {
  const i = BETS.indexOf(bet), affordable = bet <= balance;
  return `<div class="bet-row"><button class="bet-button" data-bet="-1" aria-label="Decrease bet" ${i === 0 ? 'disabled' : ''}>−</button><button class="trigger" data-act="enter" ${affordable ? '' : 'disabled'}>${icon('exit')} ${affordable ? `${run ? 'NEW RUN' : 'ENTER'} ${money(bet)}` : 'LOW BALANCE'}</button><button class="bet-button" data-bet="1" aria-label="Increase bet" ${i === BETS.length-1 || BETS[i+1] > balance ? 'disabled' : ''}>+</button></div>`;
}

function markedCylinder(route, chambers) {
  const added = route?.kind === 'conserve' ? chambers.findIndex((v, i) => v && !run.chambers[i]) : -1;
  const markup = cylinder(chambers, { pointer: true, added });
  if (route?.kind !== 'security') return markup;
  return markup.replace(/(<g data-slot="(\d+)"[^>]*>)([\s\S]*?)(<circle class="selection"[^>]*\/><\/g>)/g,
    (whole, lead, index, interior, end) => route.rewards[index] === null ? whole :
      `${lead}${interior}<circle class="chip-mark" r="15"/><text class="chip-label">${route.rewards[index]}X</text>${end}`);
}

function wheel(prizes, selected) {
  const step = 360 / prizes.length;
  const point = (angle, radius) => {
    const r = angle * Math.PI / 180;
    return [150 + Math.cos(r) * radius, 150 + Math.sin(r) * radius].map(n => n.toFixed(2)).join(' ');
  };
  return `<div class="bounty-dial" id="wheel" role="img" aria-label="Bounty cylinder, ${prizes.length} equal slots"><span class="pin" aria-hidden="true"></span><div class="rotor" style="transform:rotate(${selected === undefined ? 0 : -selected * step}deg)"><svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="146" fill="#111a20" stroke="#cfad70" stroke-width="3"/>${prizes.map((value, i) => {
    const a = i * step - 90, [tx, ty] = point(a, 108).split(' ');
    return `<g data-slot="${i}" class="sector ${value === 8 ? 'top-prize' : ''} ${i === selected ? 'selected' : ''}"><path d="M150 150 L${point(a-step/2, 140)} A140 140 0 0 1 ${point(a+step/2, 140)} Z"/><text x="${tx}" y="${ty}">${x(value)}</text></g>`;
  }).join('')}<circle cx="150" cy="150" r="50" fill="#11222b" stroke="#dfb970" stroke-width="3"/><text x="150" y="150" text-anchor="middle" dominant-baseline="central" fill="#fadd98" font-size="21" font-weight="800">${prizes.length}</text></svg></div></div>`;
}

function render() {
  const phase = run?.phase ?? 'intro', stage = run?.stage ?? 0, balance = run?.balance ?? START_BALANCE;
  const result = phase === 'paid' || phase === 'lost';
  if (result && bet > balance) bet = BETS.findLast(value => value <= balance) ?? BETS[0];
  const stake = !run || result ? bet : run.bet;
  const isBounty = ['bounty', 'drawing', 'paid'].includes(phase);
  const [district, enemy, art, line] = scenes[stage];
  app.className = `game ${phase}`;
  $('hud').innerHTML = `<div class="top"><span class="brand">DEAD CITY / BOUNTY RUN</span><button class="sound" data-act="sound" aria-label="${muted ? 'Enable' : 'Mute'} sound" aria-pressed="${muted}">${icon(muted ? 'muted' : 'sound')}</button></div><div class="wallet"><div>${icon('coin')}<span><small>BALANCE</small><strong id="balance">${money(balance)}</strong></span></div><div>${icon('chips')}<span><small>${result ? 'NEXT BET' : 'BET'}</small><strong>${money(stake)}</strong></span></div><div><span><small>MAX WIN</small><strong>${money(stake * 8)}</strong></span></div></div><ol class="progress" aria-label="Journey progress">${scenes.map((_, i) => {
    const cleared = !!run && (stage > i || (i === 4 && isBounty));
    return `<li class="${cleared ? 'cleared' : run && stage === i ? 'current' : ''}" aria-label="${i === 4 ? 'Boss' : `Street ${i+1}`}${cleared ? ', cleared' : ''}">${cleared ? icon('check') : i === 4 ? icon('skull') : i+1}</li>`;
  }).join('')}</ol>${board(run?.tokens ?? 0)}`;

  const sceneName = isBounty ? 'Bounty Cylinder' : phase === 'lost' ? 'The city took you.' : enemy;
  const showWeapon = ['ready', 'boss', 'spinning'].includes(phase);
  const sceneArt = isBounty ? '../a/assets/harbor.png' : `./assets/${art}.png`;
  const nextArt = scenes[stage + 1]?.[2];
  if (run && !result && !isBounty) preload(nextArt ? `./assets/${nextArt}.png` : '../a/assets/harbor.png');
  $('scene').innerHTML = `<img class="scene-image" src="${sceneArt}" alt="">${showWeapon ? '<img class="weapon" src="../a/assets/weapon.png" alt="">' : ''}<div class="scene-caption">${!run ? '<span class="overline">LAST BOAT TO SAFETY</span><h1>Dead City<br><em>Bounty Run</em></h1>' : `<span class="overline">${isBounty ? 'EXTRACTION BAY' : district}</span><h2>${sceneName}</h2>`}<p>${!run ? 'Clear four streets. Cut the lowest prizes. Beat the Warden.' : isBounty ? 'The gate is open. Your remaining prizes are live.' : phase === 'lost' ? 'Empty chamber. Bounty forfeited.' : line}</p></div>`;

  if (!run) {
    $('actions').innerHTML = `<div class="start-dial">${cylinder(slots(4))}</div>${betControls(balance)}`;
  } else if (phase === 'route') {
    $('actions').innerHTML = `<div class="choices" style="--choices:${run.offers.length}">${run.offers.map(routeCard).join('')}</div><p class="callout">${icon('empty')} EMPTY ENDS THE RUN <span aria-hidden="true">·</span> X CUTS THE LOWEST PRIZE</p>`;
  } else if (isBounty) {
    $('actions').innerHTML = `<div class="bounty-message" id="bounty-message" role="status">${phase === 'paid' ? `<strong class="result-money">${x(run.multiplier)} · ${money(run.payout)}</strong>` : `1 IN ${remaining(run.tokens).length} PER SLOT`}</div>${wheel(remaining(run.tokens), phase === 'paid' ? run.index : undefined)}${phase === 'paid' ? betControls(balance) : `<button class="trigger" data-act="spin" ${phase === 'drawing' ? 'disabled' : ''}>${icon('spin')} ${phase === 'drawing' ? 'SPINNING' : 'SPIN'}</button>`}`;
  } else if (phase === 'lost') {
    $('actions').innerHTML = `<div class="bounty-message"><strong class="result-money">PAID ${money(0)}</strong></div>${betControls(balance)}`;
  } else {
    const route = phase === 'boss' ? null : run.route, aim = route?.aim ?? run.chambers;
    const status = route ? names[route.kind] : 'BOSS';
    $('actions').innerHTML = `<div class="shot-status" id="shot-status" role="status"><span>${status}</span><span>${icon('target')} ${odds(loaded(aim))}</span><span class="miss">${icon('empty')} ${odds(6-loaded(aim))}</span></div><div class="shot-dial" id="shot-dial">${markedCylinder(route, aim)}</div><button class="trigger" data-act="fire" ${phase === 'spinning' ? 'disabled' : ''}>${icon('fire')} ${phase === 'spinning' ? 'SPINNING' : 'FIRE'}</button>`;
  }
}

async function turn(root, count, index, turns, duration) {
  const rotor = root.querySelector('.rotor'), step = 360 / count;
  const target = turns * 360 + (360 - index * step) % 360;
  let tick = -1;
  await new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration), angle = target * (1 - (1-t) ** 4);
      rotor.style.transform = `rotate(${angle}deg)`;
      const crossed = Math.floor(angle / step);
      if (crossed !== tick) { audio.tick(); tick = crossed; }
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
  return rotor.querySelector(`[data-slot="${index}"]`);
}

async function fire() {
  run = beginShot(run);
  const index = randomIndex(6);
  render(); audio.tension();
  const stopped = await turn($('shot-dial'), 6, index, 5, reduced ? 900 : 2450);
  const hit = run.route.aim[index];
  stopped.classList.add('selected');
  if (!hit) stopped.classList.add('empty');
  await wait(450);
  const next = resolveShot(run, index);
  app.classList.add(hit ? 'firing' : 'misfire');
  if (hit) audio.fire(); else audio.empty();
  const found = hit && next.phase !== 'bounty' ? next.gain : 0;
  $('shot-status').textContent = !hit ? 'EMPTY · RUN LOST' : next.phase === 'bounty' ? 'GATE CLEARED' : found > 0 ? `HIT · +${found} X` : 'HIT · STREET CLEARED';
  document.querySelectorAll('.prize-chip').forEach((chip, i) => {
    if (i < found) { chip.style.animationDelay = `${i * 75}ms`; chip.classList.add('removing'); }
  });
  await wait(next.phase === 'bounty' ? 850 : 1050);
  if (next.phase === 'bounty') audio.win();
  run = next; render();
}

async function spin() {
  run = startDraw(run);
  const prizes = remaining(run.tokens), index = randomIndex(prizes.length);
  render();
  const stopped = await turn($('wheel'), prizes.length, index, 6, reduced ? 1150 : 3300);
  stopped.classList.add('selected');
  $('bounty-message').textContent = x(prizes[index]);
  await wait(650);
  run = settleDraw(run, index);
  audio.win(); render();
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  audio.start();
  if (button.dataset.act === 'sound') {
    muted = audio.toggle();
    button.innerHTML = icon(muted ? 'muted' : 'sound');
    button.setAttribute('aria-label', `${muted ? 'Enable' : 'Mute'} sound`);
    button.setAttribute('aria-pressed', muted);
  } else if (button.dataset.bet) {
    bet = BETS[BETS.indexOf(bet) + Number(button.dataset.bet)]; render();
    const replacement = app.querySelector(`[data-bet="${button.dataset.bet}"]`);
    (replacement.disabled ? app.querySelector('[data-act="enter"]') : replacement).focus();
  } else if (button.dataset.act === 'enter') {
    run = newRun(run?.balance ?? START_BALANCE, bet);
    audio.travel(); render();
  } else if (button.dataset.route && run.phase === 'route') {
    run = takeRoute(run, button.dataset.route);
    if (run.route.kind === 'conserve' && loaded(run.chambers) < 5) audio.load(); else audio.travel();
    render();
  } else if (button.dataset.act === 'fire' && ['ready', 'boss'].includes(run.phase)) fire();
  else if (button.dataset.act === 'spin' && run.phase === 'bounty') spin();
});

render();
preload('../a/assets/weapon.png');
