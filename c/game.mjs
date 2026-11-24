import { cylinder, icon } from './visuals.mjs';
import { soundscape } from './sound.mjs';
import {
  JACKPOT, LAUNCH_BALANCE, ROUTES, STAKES, VALUES,
  drawCrate, openCrates, planShot, randomBelow, resolveShot, settle, startRun,
} from './rules.mjs';

const game = document.getElementById('game');
const scene = document.getElementById('scene');
const screen = document.getElementById('screen');
const hud = document.getElementById('hud');
const sound = soundscape();
const shortMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = ms => new Promise(resolve => setTimeout(resolve, shortMotion ? Math.min(ms, 90) : ms));
const hold = ms => new Promise(resolve => setTimeout(resolve, ms));
const credits = value => `NT$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const percent = (chance, digits = 1) => `${(chance * 100).toFixed(digits)}%`;
const art = name => `./assets/${name}.png`;
const seal = '<span class="seal-icon" aria-hidden="true">×</span>';
const lock = '<svg class="icon lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 2v4"/></svg>';
const foes = ['infected', 'crawler', 'guard', 'warden'];
const foeNames = ['The Infected', 'The Crawler', 'Harbor Guard', 'The Warden'];
const tiers = [
  { slots: [11], name: 'jackpot', x: 792, y: 578 },
  { slots: [10, 9], name: 'premium', x: 146, y: 578 },
  { slots: [8, 7, 6, 5], name: 'standard', x: 792, y: 64 },
  { slots: [4, 3, 2, 1, 0], name: 'basic', x: 146, y: 64 },
];
let phase = 'home', balance = LAUNCH_BALANCE, stake = 100, run, shot, muted = false, busy = false;

function header() {
  const tracked = run?.stage ?? 0;
  hud.innerHTML = `<div class="brand">LAST FERRY<span>DEAD CITY</span></div>
    <div class="wallet"><span>BALANCE<b>${credits(balance)}</b></span><span>BET<b>${credits(run?.stake ?? stake)}</b></span></div>
    <button class="sound" data-action="sound" aria-label="${muted ? 'Unmute' : 'Mute'} sound" aria-pressed="${muted}">${icon(muted ? 'muted' : 'sound')}</button>
    <div class="route-line" aria-label="Journey progress">
      ${[...ROUTES.map(item => item.place), 'Ferry Gate'].map((name, index) =>
        `<span class="${run && index < tracked ? 'done' : run && index === tracked ? 'active' : ''}" title="${name}">${index === 3 ? icon('exit') : String(index + 1).padStart(2, '0')}</span>`).join('')}
    </div>`;
}

function chambers(rounds) {
  return Array.from({ length: 6 }, (_, index) => index < rounds);
}

function routeCard(route) {
  const choice = planShot(run, route), isCover = route === 'cover';
  const dots = count => `<span class="ammo-dots">${chambers(count).map(live => `<i class="${live ? 'filled' : ''}"></i>`).join('')}</span>`;
  return `<button class="route-card ${route}" data-route="${route}" aria-label="${ROUTES[run.stage][route]}, ${percent(choice.rounds / 6)} hit, ${choice.seals} seals, ${choice.rounds} loaded, ${choice.carry} carry">
    <span class="route-type">${icon(isCover ? 'supply' : 'breach')} ${isCover ? 'COVER' : 'RUSH'}</span>
    <strong>${ROUTES[run.stage][route]}</strong>
    <span class="route-payoff"><span><b>${percent(choice.rounds / 6)}</b> HIT</span><span>${seal}<b>+${choice.seals}</b></span></span>
    <span class="ammo-change"><span>SHOT${dots(choice.rounds)}</span>${icon('arrow')}<span>CARRY${dots(choice.carry)}</span></span>
  </button>`;
}

function caseStack(count) {
  const open = openCrates(count);
  return `<div class="tower" aria-label="Supply tower, ${open.length} available and ${count} sealed">
    ${tiers.map(({ slots, name, x, y }) => `<div class="case-row ${name}" style="--x:${100 * x / 936}%;--y:${100 * y / 654}%">
      ${slots.map(index => {
        const crate = open.find(item => item.index === index);
        return `<div class="crate ${crate ? '' : 'sealed'}" data-crate="${index}" aria-label="${VALUES[index]} times, ${crate ? percent(crate.chance, 2) + ' chance' : 'sealed'}">
          <span class="case-art case-bottom"></span><span class="case-art case-lid"></span>
          <span class="crate-mark">${crate ? `<b>${crate.value}×</b><small>${percent(crate.chance, 2)}</small>` : lock}</span>
        </div>`;
      }).join('')}
    </div>`).join('')}
  </div>`;
}

function home() {
  phase = 'home';
  run = undefined;
  game.className = 'game home';
  scene.innerHTML = `<div class="backdrop ferry"></div><div class="lookout-tower" aria-hidden="true">${caseStack(0)}</div>
    <img class="lookout-guard" src="${art('warden')}" alt="">`;
  header();
  const index = STAKES.indexOf(stake);
  screen.innerHTML = `<div class="home-copy">
    <p class="overline">FLOODGATE EVACUATION</p><h1>LAST<br>FERRY</h1>
    <p>Fight to the pier. Seal low-value crates.<br>Take one aboard.</p>
    <div class="jackpot-note">${icon('supply')} <span>BLACK BOX <b>50×</b></span><strong>${credits(stake * VALUES[JACKPOT])}</strong></div>
    <div class="stake-control"><button data-action="less" aria-label="Decrease bet" ${index === 0 ? 'disabled' : ''}>−</button>
      <span><small>BET</small> ${credits(stake)}</span>
      <button data-action="more" aria-label="Increase bet" ${index === STAKES.length - 1 || STAKES[index + 1] > balance ? 'disabled' : ''}>+</button>
    </div>
    <button class="primary" data-action="start" ${balance < stake ? 'disabled' : ''}>${icon('exit')} ${balance < stake ? 'INSUFFICIENT CREDITS' : 'ENTER THE HARBOR'}</button>
    <p class="demo-note">DEMO CREDITS</p>
  </div>`;
}

function junction() {
  phase = 'junction';
  game.className = `game junction district-${run.stage}`;
  scene.innerHTML = '<div class="backdrop fork"></div>';
  header();
  screen.innerHTML = `<div class="story-heading"><p class="overline">CHOOSE A ROUTE</p><h1>${ROUTES[run.stage].place}</h1></div>
    <div class="crossroads">${routeCard('cover')}${routeCard('rush')}</div>
    <div class="seal-meter"><span>${seal} <b>${run.seals}</b> SEALED</span><span>${icon('supply')} ${VALUES.length - run.seals} CRATES LEFT</span></div>`;
}

async function encounter(route) {
  phase = 'encounter';
  shot = planShot(run, route);
  const boss = route === 'warden';
  const slot = boss ? 3 : run.stage;
  game.className = `game encounter arriving ${route} enemy-${slot}`;
  scene.innerHTML = `<div class="backdrop lane"></div><div class="warning-beam"></div>
    <img class="foe" src="${art(foes[slot])}" alt="">
    <div class="rig">
      <img class="weapon closed" src="${art('gun-closed')}" alt="">
      <div class="drum"><img class="weapon shell" src="${art('gun-open')}" alt=""><div id="cylinder">
        ${cylinder(chambers(shot.rounds), { pointer: true, added: shot.rounds > run.rounds ? shot.rounds - 1 : -1 })}
      </div></div>
      <img class="weapon frame" src="${art('gun-open')}" alt="">
      <img class="hand" src="${art('support-hand')}" alt=""><span class="flash"></span>
    </div>
    <img class="bite" src="${art(boss ? 'warden-bite' : 'bite')}" alt="">`;
  header();
  screen.innerHTML = `<div class="story-heading"><p class="overline">${boss ? 'FERRY GATE' : ROUTES[run.stage][route]}</p><h1>${foeNames[slot]}</h1></div>
    <div class="shot-controls"><div class="shot-info" id="shot-info" role="status">${icon('target')} ${percent(shot.rounds / 6)} hit <span>${icon('empty')} ${percent((6 - shot.rounds) / 6)} empty</span></div>
      <button class="primary" id="fire" data-action="fire" disabled>${icon('fire')} FIRE</button></div>`;
  sound.step(0);
  await pause(220);
  sound.step(1);
  await pause(240);
  sound.open();
  game.classList.replace('arriving', 'ready');
  if (shot.rounds > run.rounds) sound.load();
  await pause(280);
  document.getElementById('fire').disabled = false;
}

function turnCylinder(slot) {
  const rotor = game.querySelector('.rotor');
  const distance = 360 * (shortMotion ? 1 : 4) + (360 - slot * 60) % 360;
  const duration = shortMotion ? 520 : 1700;
  let tooth = 0;
  return new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const degree = distance * (1 - (1 - progress) ** 3);
      rotor.style.transform = `rotate(${degree}deg)`;
      const current = Math.floor(degree / 60);
      if (current !== tooth) { sound.tick(); tooth = current; }
      if (progress < 1) requestAnimationFrame(frame);
      else resolve(rotor.querySelector(`[data-slot="${slot}"]`));
    }
    requestAnimationFrame(frame);
  });
}

async function fire() {
  if (phase !== 'encounter' || busy) return;
  busy = true;
  const button = document.getElementById('fire');
  button.disabled = true;
  button.innerHTML = `${icon('spin')} SPINNING`;
  game.classList.add('spinning');
  sound.tension();
  const index = randomBelow(6);
  const chamber = await turnCylinder(index);
  const result = resolveShot(run, shot, index);
  const info = document.getElementById('shot-info');
  game.classList.replace('spinning', result.hit ? 'live-stop' : 'empty-stop');
  chamber.classList.add('selected');
  info.innerHTML = result.hit ? `${icon('bullet')} LIVE ROUND` : `${icon('empty')} EMPTY CHAMBER`;
  await hold(640);
  if (!result.hit) {
    sound.empty();
    game.classList.add('miss');
    await pause(430);
    sound.bite();
    game.classList.add('lunging');
    await pause(380);
    lose();
    busy = false;
    return;
  }
  game.classList.replace('ready', 'closing');
  await pause(240);
  game.classList.replace('closing', 'closed-shot');
  sound.close();
  await pause(220);
  game.classList.add('hit');
  sound.fire();
  await pause(430);
  const boss = shot.route === 'warden';
  run = result.next;
  if (boss) {
    sound.gate();
    cargo();
  } else {
    info.innerHTML = `${seal} +${shot.seals} SEALED <span>${VALUES.length - run.seals} CRATES LEFT</span>`;
    sound.seal();
    await pause(540);
    if (run.stage === ROUTES.length) await encounter('warden');
    else junction();
  }
  busy = false;
}

function cargo() {
  phase = 'cargo';
  game.className = 'game cargo';
  scene.innerHTML = '<div class="backdrop hold"></div>';
  header();
  screen.innerHTML = `<div class="story-heading"><p class="overline">ABOARD THE LAST FERRY</p><h1>One crate gets aboard</h1></div>
    <div class="cargo-center">${caseStack(run.seals)}</div>
    <div class="cargo-bottom"><p id="cargo-result" role="status">${seal} ${run.seals} SEALED <span>${VALUES.length - run.seals} AVAILABLE</span></p>
      <button class="primary" data-action="draw">${icon('supply')} OPEN A CRATE</button></div>`;
}

async function draw() {
  if (phase !== 'cargo' || busy) return;
  busy = true;
  const button = screen.querySelector('[data-action="draw"]');
  button.disabled = true;
  button.textContent = 'DRAWING';
  const crate = drawCrate(run.seals);
  const choices = [...screen.querySelectorAll('.crate:not(.sealed)')];
  const pick = screen.querySelector(`[data-crate="${crate.index}"]`);
  const turns = choices.length * 2 + choices.indexOf(pick) + 1;
  for (let tick = 0; tick < turns; tick++) {
    const cell = choices[tick % choices.length];
    cell.classList.add('scanning');
    sound.tick();
    await pause(32 + 105 * (tick / turns) ** 4);
    cell.classList.remove('scanning');
  }
  pick.classList.add('opened');
  await pause(430);
  const paid = settle(run.stake, crate);
  balance = Math.round((balance + paid) * 100) / 100;
  phase = 'settled';
  game.classList.add('paid');
  header();
  sound.win();
  document.getElementById('cargo-result').innerHTML = `<span>${crate.value}× PAYOUT</span><strong>${credits(paid)}</strong>`;
  button.dataset.action = 'again';
  button.textContent = 'NEW RUN';
  button.disabled = false;
  busy = false;
}

function lose() {
  phase = 'settled';
  game.className = 'game lost';
  scene.innerHTML = '<div class="backdrop lane"></div>';
  screen.innerHTML = `<div class="loss"><p class="overline">EMPTY CHAMBER</p><h1>Left behind</h1>
    <p>${credits(0)} <small>PAYOUT</small></p><button class="primary" data-action="again">NEW RUN</button></div>`;
}

game.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const { action, route } = button.dataset;
  if (action === 'sound') {
    muted = sound.toggle();
    button.innerHTML = icon(muted ? 'muted' : 'sound');
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  } else if (action === 'less' || action === 'more') {
    stake = STAKES[STAKES.indexOf(stake) + (action === 'less' ? -1 : 1)];
    home();
  } else if (action === 'start' && phase === 'home') {
    sound.start();
    sound.travel();
    run = startRun(balance, stake);
    balance = run.balance;
    junction();
  } else if (route && phase === 'junction') {
    encounter(route);
  } else if (action === 'fire') {
    fire();
  } else if (action === 'draw') {
    draw();
  } else if (action === 'again' && phase === 'settled') {
    stake = STAKES.findLast(value => value <= Math.min(stake, balance)) ?? STAKES[0];
    home();
  }
});

home();
for (const name of [...foes, 'gun-closed', 'gun-open', 'support-hand', 'bite', 'warden-bite']) new Image().src = art(name);
for (const name of ['fork', 'yard-fork', 'pier-fork', 'lane', 'hold']) new Image().src = `./assets/${name}.jpg`;
