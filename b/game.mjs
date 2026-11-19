import { icon, cylinder } from '../a/visuals.mjs';
import { soundscape } from './feedback.mjs';
import { encounter } from './encounter.mjs';
import { START_BALANCE, BETS, RARITIES, PRIZES, JACKPOT, JACKPOT_SLOT, loaded, prizeSlots, jackpotOdds, ordinaryOdds, drawBountyIndex, randomIndex, newRun, takeRoute, beginShot, resolveShot, startDraw, settleDraw } from './engine.mjs';
import { seal, sealMark, prizeName, prizeIcon } from './loot.mjs';
import { bountySlot, bountyWheel, multiplierLabel as x, percent } from './bounty.mjs';

const $ = id => document.getElementById(id);
const app = $('game'), audio = soundscape(), world = encounter();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hold = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = ms => hold(reduced ? ms * .35 : ms);
const money = n => `NT$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const odds = n => `${(n * 100 / 6).toFixed(1)}%`;
const slots = n => Array.from({ length: 6 }, (_, i) => i < n);
const cue = (graphic, label) => `<span class="cue" title="${label}"><span class="cue-graphic" aria-hidden="true">${graphic}</span><span class="sr-only">${label}</span></span>`;
const walk = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="m12 8-3 4-4 1m7-5 3 4 4 1m-7-5-1 8-4 5m4-5 5 1 2 4"/></svg>';
const sealCount = count => `${seal()}<b>${count}</b>`;
const blackBox = value => cue(`${prizeIcon(JACKPOT)}<strong>${x(value)}</strong>`, `Black Box ${x(value)}`);
const scenes = [
  ['Quarantine Checkpoint', 'The Infected', 'checkpoint'],
  ['Service Tunnel', 'The Crawler', 'tunnel'],
  ['Freight Yard', 'The Dockworker', 'freight'],
  ['Harbor Approach', 'The Harbor Guard', 'harbor'],
  ['Evacuation Gate', 'The Warden', 'warden'],
];
const junctions = [
  ['Service Alley', 'Main Barricade'],
  ['Maintenance Walk', 'Flooded Tracks'],
  ['Cargo Stairs', 'Loading Ramp'],
  ['Covered Pier', 'Open Causeway'],
];
const names = { conserve: 'CONSERVE', charge: 'CHARGE', armory: 'ARMORY', security: 'SECURITY', radio: 'RADIO', boss: 'BOSS' };
const eventPaths = { armory: 'Ammo Cache', security: 'Security Booth', radio: 'Radio Post' };
const icons = { conserve: 'supply', charge: 'breach', armory: 'bullet', security: 'target', radio: 'radio', boss: 'skull' };
const checkpointRoutes = {
  conserve: { scene: 'alley', art: './assets/checkpoint-alley.png', actor: './assets/checkpoint-peek.png' },
  charge: { scene: 'road', art: './assets/checkpoint-road.png' },
};
const preloaded = new Map();
let run = null, bet = 100, muted = false, sealFrom = null, previewing = false, depth = false;
const pathName = (stage, kind) => kind === 'conserve' ? junctions[stage][0] : kind === 'charge' ? junctions[stage][1] : eventPaths[kind] ?? names[kind];

function preload(path) {
  if (!preloaded.has(path)) {
    const img = new Image(); img.src = path;
    preloaded.set(path, img);
  }
  return preloaded.get(path);
}

function bountyFacts(tokens) {
  return `<div class="bounty-facts"><div><span>PER SPIN</span>${cue(`${icon('coin')} <b>${percent(ordinaryOdds)}</b> / SLOT`, `Each standard slot: ${percent(ordinaryOdds)} per spin`)}${cue(`${prizeIcon(JACKPOT)} <b>${percent(jackpotOdds(0))}</b>`, `Black Box: ${percent(jackpotOdds(0))} per spin`)}</div><div>${cue(`${sealCount(tokens)} ${icon('arrow')}${icon('spin')} <b>+2×</b>`, `${tokens} re-spin slots. Each re-spin adds 2× to the Black Box.`)}${cue(`${prizeIcon(JACKPOT)} <b>${percent(jackpotOdds(tokens))}</b> FINAL`, `Final Black Box chance ${percent(jackpotOdds(tokens))}`)}</div></div>`;
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
  const reward = route.kind === 'security' ? '1 or 4' : route.max;
  const before = loaded(run.chambers), detail = note(route, before);
  const destination = pathName(run.stage, route.kind);
  const style = ['conserve', 'charge'].includes(route.kind) ? route.kind : 'event';
  const extra = route.kind === 'radio' ? `<span class="radio-destination">${icon('radio')}${pathName(run.stage + 1, route.reserve)}</span>` : '';
  const refill = before < n ? cue(`${icon('bullet')}+1`, 'Load one round before shooting') : '';
  return `<button class="route-card ${rarity.toLowerCase()} ${style}" data-route="${route.kind}" aria-label="${destination}, ${rarity} ${names[route.kind]}. Hit ${odds(n)}, empty ${odds(6-n)}. On hit ${reward} clearance seals and ${route.resultCount} live chambers. ${detail}."><span class="waypoint">${icon(icons[route.kind])}</span><span class="route-sign"><span class="route-rarity" aria-hidden="true">${'<i></i>'.repeat(route.tier+1)}</span><strong class="route-name">${destination}</strong><span class="odds">${icon('target')}${odds(n)}<span class="miss">${icon('empty')}${odds(6-n)}</span></span>${extra}<span class="route-kit"><span class="prize-badge${route.max ? '' : ' no-seals'}">${sealCount(reward)}</span>${refill}<span class="after" title="Cylinder after a hit">${icon('check')}${cylinder(slots(route.resultCount))}</span></span></span></button>`;
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

function shotStatus(aim) {
  const live = loaded(aim);
  return `${cue(`${icon('target')} ${odds(live)}`, `Hit ${odds(live)}`)}<span class="miss">${cue(`${icon('empty')} ${odds(6-live)}`, `Empty ${odds(6-live)}`)}</span>`;
}

function render(entering = false) {
  const loading = sealFrom !== null;
  const phase = loading ? 'loading' : previewing ? 'inspect' : run?.phase ?? 'intro';
  const stage = run?.stage ?? 0, balance = run?.balance ?? START_BALANCE, tokens = run?.tokens ?? 0, jackpot = run?.jackpot ?? JACKPOT;
  const result = phase === 'paid' || phase === 'lost';
  if (result && bet > balance) bet = BETS.findLast(value => value <= balance) ?? BETS[0];
  const stake = !run || result ? bet : run.bet;
  const isBounty = ['bounty', 'drawing', 'paid'].includes(phase);
  const [district, enemy, art] = scenes[loading ? stage - 1 : stage];
  const checkpoint = stage === 0 && !['intro', 'route'].includes(phase) ? checkpointRoutes[run.route?.kind] : null;
  const showWeapon = ['ready', 'boss', 'spinning'].includes(phase);
  app.className = `game ${phase}${checkpoint ? ` first-${checkpoint.scene}` : ''}${entering ? ' arrival' : ''}${showWeapon && depth ? ' depth-live' : ''}`;
  $('hud').innerHTML = `<div class="wallet"><div>${icon('coin')}<span><small>BALANCE</small><strong id="balance">${money(balance)}</strong></span></div><div>${icon('chips')}<span><small>${result ? 'NEXT BET' : 'BET'}</small><strong>${money(stake)}</strong></span></div><div title="Black Box">${prizeIcon(JACKPOT)}<span><small><span class="sr-only">Black Box </span><span id="jackpot-label">${x(jackpot)}</span></small><strong id="jackpot-value">${money((run?.bet ?? stake) * jackpot)}</strong></span></div></div><button class="sound" data-act="sound" aria-label="${muted ? 'Enable' : 'Mute'} sound" aria-pressed="${muted}">${icon(muted ? 'muted' : 'sound')}</button><ol class="progress" aria-label="Journey progress">${scenes.map((_, i) => {
    const cleared = !!run && (stage > i || (i === 4 && isBounty));
    return `<li class="${cleared ? 'cleared' : run && stage === i ? 'current' : ''}" aria-label="${i === 4 ? 'Boss' : `Street ${i+1}`}${cleared ? ', cleared' : ''}">${cleared ? icon('check') : i === 4 ? icon('skull') : i+1}</li>`;
  }).join('')}</ol>`;

  const isJunction = phase === 'route';
  const sceneName = loading ? 'Seal the Cylinder' : isBounty ? 'Extraction Bay' : previewing ? 'Bounty Cylinder' : phase === 'lost' ? 'Run Lost' : isJunction ? district : enemy;
  const sceneArt = isBounty ? '../a/assets/harbor.png' : `./assets/${art}${isJunction || loading || previewing ? '-junction' : ''}.png`;
  const nextArt = scenes[stage + 1]?.[2];
  if (!run) preload('./assets/checkpoint-junction.png');
  if (isJunction) preload(`./assets/${art}.png`);
  if (isJunction) world?.preload(stage);
  if (isJunction && stage === 0) {
    for (const entry of Object.values(checkpointRoutes)) {
      preload(entry.art);
      if (entry.actor) preload(entry.actor);
    }
  }
  if (showWeapon) preload(nextArt ? `./assets/${nextArt}${stage < 3 ? '-junction' : ''}.png` : '../a/assets/harbor.png');
  if (showWeapon && nextArt) world?.preload(stage + 1);
  const chosenPath = showWeapon && run.route && run.route.kind !== 'boss' && phase !== 'boss' ? pathName(stage, run.route.kind) : '';
  const place = chosenPath || (phase === 'boss' ? district : '');
  const ordered = isJunction && run.offers.length === 3 ? [run.offers[0], run.offers[2], run.offers[1]] : run?.offers;
  const doors = isJunction ? `<div class="choices" style="--choices:${ordered.length}">${ordered.map(routeCard).join('')}</div>` : '';
  const backdrop = checkpoint ? `<div class="first-world"><img class="scene-image" src="${checkpoint.art}" alt="">${checkpoint.actor ? `<div class="alley-cover"><img class="alley-actor" src="${checkpoint.actor}" alt=""></div>` : ''}</div>` : `<img class="scene-image" src="${sceneArt}" alt="">`;
  const route = phase === 'boss' ? null : run?.route;
  const reload = showWeapon && route?.kind === 'conserve' && loaded(run.chambers) < 5;
  const weapon = showWeapon ? `<div class="weapon-rig"><img class="weapon" src="../a/assets/weapon.png" alt=""><span class="muzzle" aria-hidden="true"></span></div>${route && route.kind !== 'boss' ? '<img class="reload-layer" src="./assets/reload-fps.png" alt="">' : ''}` : '';
  const sky = showWeapon && depth ? `<div class="depth-sky" aria-hidden="true">${checkpoint?.scene === 'road' ? '<img src="./assets/checkpoint-road.png" alt="">' : stage >= 2 ? '<img src="../a/assets/harbor.png" alt="">' : ''}</div>` : '';
  $('scene').innerHTML = `${backdrop}${sky}${weapon}<div class="scene-caption">${!run ? '<span class="overline">LAST BOAT TO SAFETY</span><h1>Dead City<br><em>Bounty Run</em></h1>' : `${place ? `<span class="overline">${place}</span>` : ''}<h2>${sceneName}</h2>`}</div>${doors}`;
  if (showWeapon && depth) world.mount($('scene'), stage, route?.kind ?? 'boss');
  else world?.hide();

  if (!run) {
    $('actions').innerHTML = `<div class="bounty-message">${blackBox(JACKPOT)}</div>${bountyWheel(0, JACKPOT)}${bountyFacts(0)}${betControls(balance)}`;
  } else if (loading) {
    const changes = replacementSlots(sealFrom, tokens);
    const swaps = changes.map(({ value }) => `<span class="swap">${prizeIcon(value)}<b>${x(value)}</b>${icon('arrow')}${seal()}</span>`).join('');
    $('actions').innerHTML = `<div class="bounty-message">${cue(sealCount(`+${changes.length}`), `Collected ${changes.length} clearance seals`)}</div>${bountyWheel(sealFrom, jackpot)}<div class="swaps" aria-label="Prizes replaced with re-spins">${swaps}</div>${bountyFacts(tokens)}<button class="trigger" data-act="continue" disabled>${icon('exit')} CONTINUE</button>`;
  } else if (previewing) {
    $('actions').innerHTML = `<div class="bounty-message">${blackBox(jackpot)}</div>${bountyWheel(tokens, jackpot)}${bountyFacts(tokens)}<button class="trigger" data-act="back">BACK</button>`;
  } else if (phase === 'route') {
    $('actions').innerHTML = `<div class="junction-tools"><button class="bounty-preview" data-act="inspect" aria-label="Inspect bounty cylinder, ${tokens} re-spin slots">${bountyWheel(tokens, jackpot, { compact: true })}<span><b>BOUNTY</b><small>${sealCount(tokens)}</small></span></button><div class="callout">${cue(`${icon('empty')}${icon('arrow')}${icon('skull')} RUN LOST`, 'An empty shot ends the run')}${cue(`${seal()}${icon('arrow')}${icon('spin')}${prizeIcon(JACKPOT)} +2×`, 'Seals become re-spins. Hitting a seal adds 2× to the Black Box and spins again.')}</div></div>`;
  } else if (isBounty) {
    $('actions').innerHTML = `<div class="bounty-message" id="bounty-message" role="status">${phase === 'paid' ? cue(`${prizeIcon(run.multiplier)}<strong class="result-money">${x(run.multiplier)} · ${money(run.payout)}</strong>`, `${prizeName(run.multiplier)}, ${x(run.multiplier)}, paid ${money(run.payout)}`) : blackBox(jackpot)}</div>${bountyWheel(tokens, jackpot, { selected: phase === 'paid' ? run.index : undefined })}${bountyFacts(tokens)}${phase === 'paid' ? betControls(balance) : `<button class="trigger" data-act="spin" ${phase === 'drawing' ? 'disabled aria-label="Spinning"' : ''}>${icon('spin')} ${phase === 'drawing' ? '' : 'SPIN'}</button>`}`;
  } else if (phase === 'lost') {
    $('actions').innerHTML = `<div class="bounty-message">${cue(`${icon('skull')}<strong class="result-money">${money(0)}</strong>`, 'Empty chamber. No payout.')}</div>${betControls(balance)}`;
  } else {
    const aim = entering && reload ? run.chambers : route?.aim ?? run.chambers;
    $('actions').innerHTML = `<div class="shot-status" id="shot-status" role="status">${entering ? '<span class="sr-only">Advancing</span>' : shotStatus(aim)}</div><div class="shot-dial" id="shot-dial">${markedCylinder(route, aim)}</div><button class="trigger" data-act="fire" ${entering || phase === 'spinning' ? 'disabled' : ''} aria-label="${entering ? 'Advancing' : phase === 'spinning' ? 'Spinning' : 'Fire'}">${entering ? walk : phase === 'spinning' ? icon('spin') : `${icon('fire')} FIRE`}</button>`;
  }
}

async function approach() {
  const route = run.phase === 'boss' ? null : run.route;
  const reload = route?.kind === 'conserve' && loaded(run.chambers) < 5;
  depth = !!await world?.preload(run.stage);
  render(true);
  if (depth) await world.walk(reduced, audio.step);
  else { audio.travel(); await wait(1160); }
  app.classList.remove('arrival');
  if (reload) {
    if (depth && run.stage === 0) world.advance(reduced ? 220 : 630);
    await showReload(markedCylinder(route, route.aim));
  }
  $('shot-status').innerHTML = shotStatus(route?.aim ?? run.chambers);
  const trigger = app.querySelector('[data-act="fire"]');
  trigger.innerHTML = `${icon('fire')} FIRE`;
  trigger.setAttribute('aria-label', 'Fire');
  trigger.disabled = false;
}

async function showReload(dial) {
  app.classList.add('reloading');
  const trigger = app.querySelector('[data-act="fire"]');
  trigger.innerHTML = icon('bullet');
  trigger.setAttribute('aria-label', 'Reloading');
  $('shot-status').innerHTML = cue(icon('spin'), 'Cylinder open');
  audio.open();
  await wait(295);
  $('shot-status').innerHTML = cue(`${icon('bullet')}${icon('check')}`, 'Round seated');
  $('shot-dial').innerHTML = dial;
  audio.load();
  await wait(510);
  audio.close();
  app.classList.remove('reloading');
}

async function enterRoute(kind) {
  run = takeRoute(run, kind);
  document.querySelectorAll('[data-route], [data-act="inspect"]').forEach(button => { button.disabled = true; });
  await approach();
}

function nextScene() {
  if (run.phase === 'boss') approach();
  else render();
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
    audio.seal();
  }
  $('wheel').setAttribute('aria-label', `Twelve chamber bounty cylinder. ${run.tokens} respin chambers. Black Box ${x(run.jackpot)}.`);
  app.querySelector('[data-act="continue"]').disabled = false;
}

async function fire() {
  run = beginShot(run);
  const index = randomIndex(6);
  render(); audio.tension();
  if (depth) world.focus();
  const stopped = await turn($('shot-dial'), 6, index, 5, reduced ? 900 : 2450);
  const hit = run.route.aim[index];
  stopped.classList.add('selected');
  if (!hit) stopped.classList.add('empty');
  await wait(450);
  const next = resolveShot(run, index);
  app.classList.add(hit ? 'firing' : 'misfire');
  if (depth) world.react(hit);
  if (hit) {
    stopped.querySelector('.cartridge').style.opacity = '0';
    audio.fire();
  } else audio.empty();
  navigator.vibrate?.(hit ? 28 : 12);
  const found = hit && next.phase !== 'bounty' ? next.gain : 0;
  $('shot-status').innerHTML = !hit ? cue(`${icon('skull')} EMPTY`, 'Empty chamber. Run lost.') : next.phase === 'bounty' ? cue(`${icon('check')} GATE CLEAR`, 'Gate cleared') : found > 0 ? cue(`<span class="seal-reward">${sealCount(`+${found}`)}</span>`, `Hit. Found ${found} clearance seals.`) : cue(`${icon('check')} HIT`, 'Hit. Street cleared.');
  const refilled = hit && next.phase !== 'bounty' ? next.chambers.findIndex((live, i) => live && (!run.route.aim[i] || i === index)) : -1;
  if (refilled >= 0) {
    await wait(410);
    app.classList.remove('firing');
    await showReload(cylinder(next.chambers, { pointer: true, added: refilled }));
  } else await wait(next.phase === 'bounty' ? 850 : 1050);
  if (next.phase === 'bounty') audio.win();
  const previous = run.tokens;
  run = next;
  if (found) await loadSeals(previous); else nextScene();
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
    message.innerHTML = count ? cue(`${seal()}${icon('spin')}<b>${count}</b>${prizeIcon(JACKPOT)}<strong>${x(run.jackpot)}</strong>`, `Re-spin ${count}. Black Box ${x(run.jackpot)}.`) : blackBox(run.jackpot);
    const stopped = await turn(wheel, PRIZES.length, index, Math.max(2, 6 - count), duration, from);
    from = (360 - index * 30) % 360;
    stopped.classList.add('selected');
    const next = settleDraw(run, index);
    if (next.phase === 'drawing') {
      audio.seal();
      message.innerHTML = cue(`<span class="award respin-reveal">${seal()}${icon('spin')}${prizeIcon(JACKPOT)}<strong>${x(run.jackpot)} → ${x(next.jackpot)}</strong><span class="plus-two">+2×</span></span>`, `Re-spin. Black Box rises from ${x(run.jackpot)} to ${x(next.jackpot)}.`);
      wheel.querySelector(`[data-slot="${JACKPOT_SLOT}"]`).outerHTML = bountySlot(next.jackpot, JACKPOT_SLOT);
      wheel.querySelector('.jackpot-slot').classList.add('jackpot-up');
      wheel.setAttribute('aria-label', `Twelve chamber bounty cylinder. ${next.tokens} respin chambers. Black Box ${x(next.jackpot)}.`);
      $('jackpot-label').textContent = x(next.jackpot);
      $('jackpot-value').textContent = money(run.bet * next.jackpot);
    } else {
      message.innerHTML = cue(`${prizeIcon(next.multiplier)}<strong>${x(next.multiplier)}</strong>`, `${prizeName(next.multiplier)}, ${x(next.multiplier)}`);
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
    button.disabled = true;
    sealFrom = null;
    nextScene();
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
preload('./assets/reload-fps.png');
