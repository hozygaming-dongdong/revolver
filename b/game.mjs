import { icon, cylinder } from '../a/visuals.mjs';
import { soundscape } from '../a/sound.mjs';
import { START_BALANCE, BETS, RARITIES, PRIZES, JACKPOT, JACKPOT_SLOT, loaded, prizeSlots, jackpotOdds, ordinaryOdds, drawBountyIndex, randomIndex, newRun, takeRoute, beginShot, resolveShot, startDraw, settleDraw } from './engine.mjs';
import { seal, sealMark, prizeName, prizeIcon } from './loot.mjs';
import { bountySlot, bountyWheel, multiplierLabel as x, percent } from './bounty.mjs';

const $ = id => document.getElementById(id);
const app = $('game'), audio = soundscape();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hold = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = ms => hold(reduced ? ms * .35 : ms);
const money = n => `NT$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const odds = n => `${(n * 100 / 6).toFixed(1)}%`;
const slots = n => Array.from({ length: 6 }, (_, i) => i < n);
const scenes = [
  ['QUARANTINE CHECKPOINT', 'The Infected', 'checkpoint', 'The city is sealed. The last boat is still waiting.'],
  ['SERVICE TUNNEL', 'The Crawler', 'tunnel', 'Stay on the tracks. The exits are ahead.'],
  ['FREIGHT YARD', 'The Dockworker', 'freight', 'The cranes stopped. Something stayed behind.'],
  ['HARBOR APPROACH', 'The Harbor Guard', 'harbor', 'The lights are on. One gate left.'],
  ['EVACUATION GATE', 'The Warden', 'warden', 'Clear the gate to unlock the bounty cylinder.'],
];
const junctions = [
  ['Service Alley', 'Main Barricade', 'The alley is sheltered. The barricade offers a straight shot.'],
  ['Maintenance Walk', 'Flooded Tracks', 'One way hugs the wall. The other runs straight into the dark.'],
  ['Cargo Stairs', 'Loading Ramp', 'The stairs stay above the yard. The ramp crosses it in the open.'],
  ['Covered Pier', 'Open Causeway', 'Both lead to the last gate. One leaves you in the open.'],
];
const names = { conserve: 'CONSERVE', charge: 'CHARGE', armory: 'ARMORY', security: 'SECURITY', radio: 'RADIO', boss: 'BOSS' };
const eventPaths = { armory: 'Ammo Cache', security: 'Security Booth', radio: 'Radio Post' };
const icons = { conserve: 'supply', charge: 'breach', armory: 'bullet', security: 'target', radio: 'radio', boss: 'skull' };
const checkpointRoutes = {
  conserve: { scene: 'alley', art: './assets/checkpoint-alley.png', actor: './assets/checkpoint-peek.png', line: 'Something steps out from behind the crates.' },
  charge: { scene: 'road', art: './assets/checkpoint-road.png', line: 'One figure blocks the road under the red lights.' },
};
const preloaded = new Map();
let run = null, bet = 100, muted = false, sealFrom = null, previewing = false;
const pathName = (stage, kind) => kind === 'conserve' ? junctions[stage][0] : kind === 'charge' ? junctions[stage][1] : eventPaths[kind] ?? names[kind];

function preload(path) {
  if (!preloaded.has(path)) {
    const img = new Image(); img.src = path;
    preloaded.set(path, img);
  }
  return preloaded.get(path);
}

function bountyFacts(tokens) {
  return `<div class="bounty-facts"><span>PER SPIN <b>${percent(ordinaryOdds)}</b> PER STANDARD SLOT · <b>${percent(jackpotOdds(0))}</b> BLACK BOX</span><span>${seal()} <b>${tokens}</b> RE-SPIN SLOTS · BLACK BOX <b>${percent(jackpotOdds(tokens))}</b> FINAL</span></div>`;
}

const replacementSlots = (before, after) => {
  const old = prizeSlots(before), updated = prizeSlots(after);
  return old.map((value, index) => ({ value, index })).filter(({ value, index }) => value !== null && updated[index] === null).sort((a, b) => a.value - b.value);
};

function note(route, before) {
  if (route.kind === 'conserve') return before === 5 ? 'Keep five on hit' : 'Reload before shot';
  if (route.kind === 'charge') return before === 5 ? 'Spend one on hit' : 'Reload on hit';
  if (route.kind === 'armory') return 'Extra round on hit';
  if (route.kind === 'security') return 'Marked live slots';
  return `Next: ${pathName(run.stage + 1, route.reserve)}`;
}

function routeCard(route) {
  const n = loaded(route.aim), rarity = RARITIES[route.tier];
  const reward = route.kind === 'security' ? '1 / 4' : route.max;
  const detail = note(route, loaded(run.chambers));
  const destination = pathName(run.stage, route.kind);
  const seals = route.kind === 'security' ? `${seal()}<b>1 / 4</b>` : route.max ? seal().repeat(route.max) : `<b class="no-seals">${seal()} 0</b>`;
  const style = ['conserve', 'charge'].includes(route.kind) ? route.kind : 'event';
  return `<button class="route-card ${rarity.toLowerCase()} ${style}" data-route="${route.kind}" aria-label="${destination}, ${rarity} ${names[route.kind]}. Hit ${odds(n)}, empty ${odds(6-n)}. On hit ${reward} clearance seals and ${route.resultCount} live chambers. ${detail}."><span class="waypoint">${icon(icons[route.kind])}</span><span class="route-sign"><span class="route-rarity">${rarity} · ${style === 'event' ? 'EVENT' : names[route.kind]}</span><strong class="route-name">${destination}</strong><span class="odds">${icon('target')}${odds(n)}<span class="miss">${icon('empty')}${odds(6-n)}</span></span><span class="prize-badge" aria-hidden="true">${seals}</span><span class="route-note">${detail}</span><span class="after">AFTER HIT${cylinder(slots(route.resultCount))}</span></span></button>`;
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
      `${lead}${interior}<circle class="chip-mark" r="18"/><text class="chip-label" x="-7">${route.rewards[index]}</text>${sealMark(0, -8)}${end}`);
}

function render(entering = false) {
  const loading = sealFrom !== null;
  const phase = loading ? 'loading' : previewing ? 'inspect' : run?.phase ?? 'intro';
  const stage = run?.stage ?? 0, balance = run?.balance ?? START_BALANCE, tokens = run?.tokens ?? 0, jackpot = run?.jackpot ?? JACKPOT;
  const result = phase === 'paid' || phase === 'lost';
  if (result && bet > balance) bet = BETS.findLast(value => value <= balance) ?? BETS[0];
  const stake = !run || result ? bet : run.bet;
  const isBounty = ['bounty', 'drawing', 'paid'].includes(phase);
  const [district, enemy, art, line] = scenes[loading ? stage - 1 : stage];
  const checkpoint = stage === 0 && !['intro', 'route'].includes(phase) ? checkpointRoutes[run.route?.kind] : null;
  app.className = `game ${phase}${checkpoint ? ` first-${checkpoint.scene}` : ''}${entering ? ' arrival' : ''}`;
  $('hud').innerHTML = `<div class="top"><span class="brand">DEAD CITY / BOUNTY RUN</span><button class="sound" data-act="sound" aria-label="${muted ? 'Enable' : 'Mute'} sound" aria-pressed="${muted}">${icon(muted ? 'muted' : 'sound')}</button></div><div class="wallet"><div>${icon('coin')}<span><small>BALANCE</small><strong id="balance">${money(balance)}</strong></span></div><div>${icon('chips')}<span><small>${result ? 'NEXT BET' : 'BET'}</small><strong>${money(stake)}</strong></span></div><div><span><small id="jackpot-label">BLACK BOX · ${x(jackpot)}</small><strong id="jackpot-value">${money((run?.bet ?? stake) * jackpot)}</strong></span></div></div><ol class="progress" aria-label="Journey progress">${scenes.map((_, i) => {
    const cleared = !!run && (stage > i || (i === 4 && isBounty));
    return `<li class="${cleared ? 'cleared' : run && stage === i ? 'current' : ''}" aria-label="${i === 4 ? 'Boss' : `Street ${i+1}`}${cleared ? ', cleared' : ''}">${cleared ? icon('check') : i === 4 ? icon('skull') : i+1}</li>`;
  }).join('')}</ol>`;

  const isJunction = phase === 'route';
  const sceneName = loading ? 'Load the seals' : isBounty || previewing ? 'Bounty Cylinder' : phase === 'lost' ? 'The city took you.' : isJunction ? 'Choose your way' : enemy;
  const showWeapon = ['ready', 'boss', 'spinning'].includes(phase);
  const sceneArt = isBounty ? '../a/assets/harbor.png' : `./assets/${art}${isJunction || loading || previewing ? '-junction' : ''}.png`;
  const nextArt = scenes[stage + 1]?.[2];
  if (!run) preload('./assets/checkpoint-junction.png');
  if (isJunction) preload(`./assets/${art}.png`);
  if (isJunction && stage === 0) {
    for (const entry of Object.values(checkpointRoutes)) {
      preload(entry.art);
      if (entry.actor) preload(entry.actor);
    }
  }
  if (showWeapon) preload(nextArt ? `./assets/${nextArt}${stage < 3 ? '-junction' : ''}.png` : '../a/assets/harbor.png');
  const chosenPath = showWeapon && run.route && run.route.kind !== 'boss' && phase !== 'boss' ? pathName(stage, run.route.kind) : '';
  const place = isBounty ? 'EXTRACTION BAY' : chosenPath ? `${district} / ${chosenPath}` : district;
  const ordered = isJunction && run.offers.length === 3 ? [run.offers[0], run.offers[2], run.offers[1]] : run?.offers;
  const doors = isJunction ? `<div class="choices" style="--choices:${ordered.length}">${ordered.map(routeCard).join('')}</div>` : '';
  const backdrop = checkpoint ? `<div class="first-world"><img class="scene-image" src="${checkpoint.art}" alt="">${checkpoint.actor ? `<div class="alley-cover"><img class="alley-actor" src="${checkpoint.actor}" alt=""></div>` : ''}</div>` : `<img class="scene-image" src="${sceneArt}" alt="">`;
  const subtitle = !run ? 'Clear the streets and reach the last boat.' : isJunction ? junctions[stage][2] : loading ? 'Seals replace the lowest prizes with re-spins.' : previewing ? 'Every re-spin adds 2× to the Black Box.' : isBounty ? 'The gate is open. Spin for your bounty.' : phase === 'lost' ? 'Empty chamber. Bounty forfeited.' : checkpoint?.line ?? line;
  $('scene').innerHTML = `${backdrop}${showWeapon ? '<img class="weapon" src="../a/assets/weapon.png" alt="">' : ''}<div class="scene-caption">${!run ? '<span class="overline">LAST BOAT TO SAFETY</span><h1>Dead City<br><em>Bounty Run</em></h1>' : `<span class="overline">${place}</span><h2>${sceneName}</h2>`}<p>${subtitle}</p></div>${doors}`;

  if (!run) {
    $('actions').innerHTML = `<div class="bounty-message">12-CHAMBER BOUNTY CYLINDER</div>${bountyWheel(0, JACKPOT)}${bountyFacts(0)}${betControls(balance)}`;
  } else if (loading) {
    const changes = replacementSlots(sealFrom, tokens);
    const swaps = changes.map(({ value }) => `<span class="swap">${prizeIcon(value)}<b>${x(value)}</b>${icon('arrow')}${seal()}</span>`).join('');
    $('actions').innerHTML = `<div class="bounty-message">+${changes.length} ${changes.length === 1 ? 'SEAL' : 'SEALS'}</div>${bountyWheel(sealFrom, jackpot)}<div class="swaps" aria-label="Prizes replaced with re-spins">${swaps}</div>${bountyFacts(tokens)}<button class="trigger" data-act="continue" disabled>CONTINUE</button>`;
  } else if (previewing) {
    $('actions').innerHTML = `<div class="bounty-message">12 SLOTS · BLACK BOX ${x(jackpot)}</div>${bountyWheel(tokens, jackpot)}${bountyFacts(tokens)}<button class="trigger" data-act="back">BACK TO THE JUNCTION</button>`;
  } else if (phase === 'route') {
    $('actions').innerHTML = `<div class="junction-tools"><button class="bounty-preview" data-act="inspect" aria-label="Inspect bounty cylinder, ${tokens} re-spin slots">${bountyWheel(tokens, jackpot, { compact: true })}<span><b>BOUNTY CYLINDER</b><small>${seal()} ${tokens} RE-SPIN SLOTS</small></span></button><p class="callout"><span>${icon('empty')} EMPTY ENDS THE RUN</span><span>${seal()} SEALS LOAD RE-SPINS</span></p></div>`;
  } else if (isBounty) {
    $('actions').innerHTML = `<div class="bounty-message" id="bounty-message" role="status">${phase === 'paid' ? `<span class="award">${prizeIcon(run.multiplier)} ${prizeName(run.multiplier)} <strong class="result-money">${x(run.multiplier)} · ${money(run.payout)}</strong></span>` : `BLACK BOX ${x(jackpot)}`}</div>${bountyWheel(tokens, jackpot, { selected: phase === 'paid' ? run.index : undefined })}${bountyFacts(tokens)}${phase === 'paid' ? betControls(balance) : `<button class="trigger" data-act="spin" ${phase === 'drawing' ? 'disabled' : ''}>${icon('spin')} ${phase === 'drawing' ? 'SPINNING' : 'SPIN'}</button>`}`;
  } else if (phase === 'lost') {
    $('actions').innerHTML = `<div class="bounty-message"><strong class="result-money">PAID ${money(0)}</strong></div>${betControls(balance)}`;
  } else {
    const route = phase === 'boss' ? null : run.route, aim = route?.aim ?? run.chambers;
    const status = route ? pathName(stage, route.kind) : 'BOSS';
    $('actions').innerHTML = `<div class="shot-status" id="shot-status" role="status"><span>${status}</span><span>${icon('target')} ${odds(loaded(aim))}</span><span class="miss">${icon('empty')} ${odds(6-loaded(aim))}</span></div><div class="shot-dial" id="shot-dial">${markedCylinder(route, aim)}</div><button class="trigger" data-act="fire" ${entering || phase === 'spinning' ? 'disabled' : ''}>${icon('fire')} ${phase === 'spinning' ? 'SPINNING' : 'FIRE'}</button>`;
  }
}

async function enterRoute(kind) {
  run = takeRoute(run, kind);
  const entry = run.stage === 0 && checkpointRoutes[kind];
  const reloaded = kind === 'conserve' && loaded(run.chambers) < 5;
  if (!entry) {
    if (reloaded) audio.load(); else audio.travel();
    render();
    return;
  }
  document.querySelectorAll('[data-route], [data-act="inspect"]').forEach(button => { button.disabled = true; });
  await Promise.allSettled([entry.art, entry.actor].filter(Boolean).map(path => preload(path).decode()));
  audio.travel();
  render(true);
  await wait(1160);
  app.classList.remove('arrival');
  app.querySelector('[data-act="fire"]').disabled = false;
  if (reloaded) audio.load();
}

async function turn(root, count, index, turns, duration, from = 0) {
  const rotor = root.querySelector('.rotor'), step = 360 / count;
  const distance = turns * 360 + (720 - index * step - from) % 360;
  let tick = -1;
  await new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration), angle = from + distance * (1 - (1-t) ** 4);
      rotor.style.transform = `rotate(${angle}deg)`;
      const crossed = Math.floor(angle / step);
      if (crossed !== tick) { audio.tick(); tick = crossed; }
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
  return rotor.querySelector(`[data-slot="${index}"]`);
}

async function loadSeals(previous) {
  sealFrom = previous;
  render();
  await hold(reduced ? 160 : 310);
  const changes = replacementSlots(previous, run.tokens);
  const swaps = document.querySelectorAll('.swap');
  for (const [i, { index }] of changes.entries()) {
    const socket = $('wheel').querySelector(`[data-slot="${index}"]`);
    socket.classList.add('ejecting');
    await hold(reduced ? 75 : 210);
    socket.outerHTML = bountySlot(null, index);
    $('wheel').querySelector(`[data-slot="${index}"]`).classList.add('loaded-seal');
    swaps[i].classList.add('loaded');
    audio.load();
  }
  $('wheel').setAttribute('aria-label', `Twelve chamber bounty cylinder. ${run.tokens} respin chambers. Black Box ${x(run.jackpot)}.`);
  app.querySelector('[data-act="continue"]').disabled = false;
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
  $('shot-status').innerHTML = !hit ? 'EMPTY · RUN LOST' : next.phase === 'bounty' ? 'GATE CLEARED' : found > 0 ? `<span>FOUND ${found} ${found === 1 ? 'SEAL' : 'SEALS'}</span><span class="seal-reward" aria-hidden="true">${seal().repeat(found)}</span>` : 'HIT · STREET CLEARED';
  await wait(next.phase === 'bounty' ? 850 : 1050);
  if (next.phase === 'bounty') audio.win();
  const previous = run.tokens;
  run = next;
  if (found) await loadSeals(previous); else render();
}

async function spin() {
  run = startDraw(run);
  render();
  const wheel = $('wheel'), message = $('bounty-message');
  let from = 0;
  while (run.phase === 'drawing') {
    const index = drawBountyIndex();
    const count = run.respins;
    const duration = Math.max(reduced ? 420 : 1050, (reduced ? 1040 : 3300) - count * (reduced ? 120 : 510));
    wheel.querySelector('.selected')?.classList.remove('selected');
    message.textContent = count ? `RE-SPIN ${count} · BLACK BOX ${x(run.jackpot)}` : `BLACK BOX ${x(run.jackpot)}`;
    const stopped = await turn(wheel, PRIZES.length, index, Math.max(2, 6 - count), duration, from);
    from = (360 - index * 30) % 360;
    stopped.classList.add('selected');
    const next = settleDraw(run, index);
    if (next.phase === 'drawing') {
      audio.load();
      message.innerHTML = `<span class="award respin-reveal">${seal()} RE-SPIN · BLACK BOX <strong>${x(run.jackpot)} → ${x(next.jackpot)}</strong><span class="plus-two">+2×</span></span>`;
      wheel.querySelector(`[data-slot="${JACKPOT_SLOT}"]`).outerHTML = bountySlot(next.jackpot, JACKPOT_SLOT);
      wheel.querySelector('.jackpot-slot').classList.add('jackpot-up');
      wheel.setAttribute('aria-label', `Twelve chamber bounty cylinder. ${next.tokens} respin chambers. Black Box ${x(next.jackpot)}.`);
      $('jackpot-label').textContent = `BLACK BOX · ${x(next.jackpot)}`;
      $('jackpot-value').textContent = money(run.bet * next.jackpot);
    } else {
      message.innerHTML = `<span class="award">${prizeIcon(next.multiplier)} ${prizeName(next.multiplier)} · ${x(next.multiplier)}</span>`;
    }
    run = next;
    await hold(720);
  }
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
  } else if (button.dataset.act === 'continue') {
    sealFrom = null;
    render();
  } else if (run?.phase === 'route' && (button.dataset.act === 'inspect' || button.dataset.act === 'back')) {
    previewing = button.dataset.act === 'inspect';
    render();
  } else if (button.dataset.route && run.phase === 'route') {
    enterRoute(button.dataset.route);
  } else if (button.dataset.act === 'fire' && ['ready', 'boss'].includes(run.phase)) fire();
  else if (button.dataset.act === 'spin' && run.phase === 'bounty') spin();
});

render();
preload('../a/assets/weapon.png');
