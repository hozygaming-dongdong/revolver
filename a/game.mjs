import { BET, BET_OPTIONS, START_BALANCE, maxWinFor, newRun, preview, choose, beginShot, settleShot, cashOut, randomChamber } from './engine.mjs';
import { icon, cylinder } from './visuals.mjs';
import { soundscape } from './sound.mjs';

const $ = id => document.getElementById(id);
const app = $('game'), audio = soundscape();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = amount => `NT$${amount.toLocaleString('en-US')}`;
const percent = chance => `${(chance * 100).toFixed(1).replace('.0', '')}%`;
const wait = ms => new Promise(resolve => setTimeout(resolve, reduced ? ms * 0.55 : ms));
const districts = [
  { name: 'QUARANTINE LINE', image: 'checkpoint', line: 'The checkpoint is gone. Find a way through.' },
  { name: 'SERVICE TUNNELS', image: 'tunnels', line: 'Keep moving. The harbor lights are ahead.' },
  { name: 'FREIGHT YARD', image: 'harbor', line: 'The boat is waiting. Bring your bounty home.' },
  { name: 'EAST BARRICADE', image: 'harbor', line: 'One gate left. Something is guarding it.' },
  { name: 'THE LAST GATE', image: 'harbor', line: 'The Warden has the exit. Make this shot count.' },
];
let run = null, bet = BET, busy = false, transition = null, muted = false;

function progress() {
  const stage = run?.stage ?? -1;
  return Array.from({ length: 5 }, (_, i) => {
    const completed = run?.history[i]?.hit;
    const failed = run?.history[i]?.hit === false;
    const current = run && stage === i && !['lost', 'cashed'].includes(run.phase);
    return `<li class="${completed ? 'done' : ''} ${current ? 'current' : ''} ${failed ? 'failed' : ''}" aria-label="${i === 4 ? 'Boss' : `Street ${i + 1}`}${completed ? ', complete' : current ? ', current' : failed ? ', failed' : ''}"><span>${completed ? icon('check') : i === 4 ? icon('skull') : i + 1}</span></li>`;
  }).join('');
}

const riskLine = () => `<div class="risk-line">${icon('empty')}${icon('arrow')}<span>NT$0</span></div>`;
const cashButton = () => `<button class="button cash" data-action="cash" aria-label="Cash out ${money(run.bank)}">${icon('exit')}<span>CASH OUT <b>${money(run.bank)}</b></span></button>`;

function entryControls(balance) {
  const i = BET_OPTIONS.indexOf(bet), affordable = balance >= bet;
  return `<div class="entry-actions"><button class="bet-step" data-bet-step="-1" aria-label="Decrease bet" ${i === 0 ? 'disabled' : ''}>−</button><button class="button enter" data-action="start" ${affordable ? '' : 'disabled'}>${icon(run ? 'spin' : 'breach')}<span>${affordable ? `${run ? 'NEW RUN' : 'ENTER'} <b>${money(bet)}</b>` : 'INSUFFICIENT BALANCE'}</span></button><button class="bet-step" data-bet-step="1" aria-label="Increase bet" ${i === BET_OPTIONS.length - 1 || BET_OPTIONS[i + 1] > balance ? 'disabled' : ''}>+</button></div>`;
}

function routeCard(route) {
  const offer = preview(run, route);
  const name = route === 'supply' ? 'SUPPLY' : 'BREACH';
  return `<button class="route-card ${route}" data-route="${route}" aria-label="${name}. ${route === 'supply' ? 'Reload one cartridge before firing.' : 'No reload.'} This shot: ${percent(offer.chance)} hit chance. Win ${money(offer.payout)}.${offer.chance < 1 ? ' Empty chamber ends the run.' : ''}"><span class="route-title">${icon(route)}<b>${name}</b></span><span class="odds"><span>${icon('target')}<b>${percent(offer.chance)}</b></span><span class="miss">${icon('empty')}${percent(1 - offer.chance)}</span></span><span class="preview-label">BEFORE SHOT</span><span class="route-cylinder">${cylinder(offer.chambers, { added: offer.added })}${offer.added >= 0 ? `<span class="reload-symbol">${icon('bullet')}${icon('spin')}</span>` : ''}</span><span class="route-prize">${icon('coin')}<small>WIN</small><b>${money(offer.payout)}</b></span></button>`;
}

function shootingControls(bossChoice, added) {
  const offer = preview(run, bossChoice ? 'boss' : run.route);
  const action = added >= 0 ? `${icon('bullet')}<span>RELOADING</span>` : busy ? `${icon('spin', 'turning')}<span class="dots">···</span>` : `${icon('fire')}<span>FIRE</span>`;
  return `<div id="shot-message" class="shot-offer" role="status" aria-live="polite"><span>${icon('target')}<b>${percent(offer.chance)}</b></span><span>${icon('coin')}<small>WIN</small><strong>${money(offer.payout)}</strong></span></div><div id="shot-dial" class="shot-dial">${cylinder(run.chambers, { large: true, pointer: true, added })}</div>${offer.chance < 1 ? riskLine() : ''}<div class="trigger-row ${bossChoice ? 'boss-actions' : ''}">${bossChoice ? cashButton() : ''}<button id="fire" class="button fire" data-action="fire" ${busy ? 'disabled' : ''} aria-label="${added >= 0 ? 'Reloading' : `Fire one shot. ${percent(offer.chance)} hit chance. Win ${money(offer.payout)}`}">${action}</button></div>`;
}

function render(added = -1) {
  const phase = transition || run?.phase || 'intro';
  const result = run && ['won', 'lost', 'cashed'].includes(run.phase);
  const stage = Math.min(run?.stage ?? 0, 4), district = districts[stage];
  const balance = run?.balance ?? START_BALANCE;
  if (result && bet > balance) bet = BET_OPTIONS.findLast(amount => amount <= balance) ?? BET_OPTIONS[0];
  const currentBet = !run || result ? bet : run.bet;
  const maximum = maxWinFor(currentBet);
  app.dataset.phase = phase;
  app.dataset.stage = stage;
  $('maximum').textContent = money(maximum);
  $('balance').textContent = money(balance);
  $('bet-label').textContent = result ? 'NEXT BET' : 'BET';
  $('bet').textContent = money(currentBet);
  $('wallet-icon').innerHTML = icon('coin');
  $('bet-icon').innerHTML = icon('chips');
  $('bounty-label').textContent = result ? 'PAID' : 'BOUNTY';
  $('bounty').textContent = run ? money(result ? run.payout : run.bank) : '—';
  $('progress').innerHTML = progress();
  $('sound').innerHTML = icon(muted ? 'muted' : 'sound');
  $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
  $('sound').setAttribute('aria-pressed', String(muted));
  const image = `assets/${district.image}.png`;
  if ($('landscape').getAttribute('src') !== image) $('landscape').src = image;
  $('location').textContent = result ? run.phase === 'lost' ? 'SIGNAL LOST' : 'EXTRACTION COMPLETE' : district.name;
  const junction = run?.phase === 'choice' && stage < 4;
  $('story').innerHTML = !run || result ? '' : junction ? `<span class="comms">${icon('radio')}</span><p>${district.line}</p>` : `<div class="encounter-label">${icon(stage === 4 ? 'skull' : run.route)}<span>${stage === 4 ? 'THE WARDEN' : run.route === 'supply' ? 'SUPPLY' : 'BREACH'}</span>${stage === 4 ? '<small>ONE SHOT</small>' : run.route === 'supply' ? '<small>RELOAD BEFORE SHOT</small>' : ''}</div>`;
  $('center').innerHTML = '';
  $('weapon').hidden = !run || !!result;
  $('enemy-art').innerHTML = '';

  if (!run) {
    $('center').innerHTML = `<div class="intro"><span class="eyebrow">THE LAST BOAT IS WAITING.</span><h1>DEAD CITY<br><em>ESCAPE</em></h1><p>Four streets. One last shot.<br>Get out alive. Take the bounty.</p></div>`;
    $('controls').innerHTML = `<div class="starting-cylinder">${cylinder(newRun().chambers)}</div>${entryControls(balance)}<div class="jackpot-path" aria-label="Breach all four streets and beat the boss to reach the maximum">${icon('breach')}${icon('breach')}${icon('breach')}${icon('breach')}${icon('arrow')}${icon('skull')}<b>${money(maximum)}</b></div>`;
    return;
  }

  if (result) {
    const escaped = run.phase !== 'lost';
    const title = run.phase === 'won' ? 'GATE CLEARED' : escaped ? 'EXTRACTED' : 'EMPTY. OVER.';
    const line = run.phase === 'won' ? 'One last shot. The way home is open.' : escaped ? 'You made the call. Your bounty is safe.' : 'The cylinder stops. The city does not.';
    const net = run.payout - run.bet;
    $('center').innerHTML = `<div class="result ${escaped ? 'escaped' : 'lost'}"><span class="result-seal">${icon(escaped ? 'exit' : 'empty')}</span><span class="eyebrow">${escaped ? 'EVAC CONFIRMED' : 'RADIO SILENCE'}</span><h1>${title}</h1><p>${line}</p><span class="paid-label">TOTAL PAID</span><strong class="paid">${money(run.payout)}</strong><div class="settlement"><span>BET <b>${money(run.bet)}</b></span><span>NET <b class="${net < 0 ? 'negative' : 'positive'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</b></span></div><div class="path-trace" aria-label="Your route">${run.history.map(h => `<span class="${h.hit ? '' : 'failed'}">${icon(h.route === 'boss' ? 'skull' : h.route)}${h.hit ? '' : '<i>×</i>'}</span>`).join('')}</div></div>`;
    $('controls').innerHTML = entryControls(balance);
    return;
  }

  const boss = stage === 4;
  if (run.phase === 'choice' && !boss) {
    $('enemy-art').innerHTML = '<img class="enemy left" src="assets/infected.png" alt=""><img class="enemy right" src="assets/infected.png" alt="">';
    $('center').innerHTML = `<div class="inventory">${cylinder(run.chambers)}</div><div class="world-signs"><span class="supply">${icon('supply')}</span><span class="breach">${icon('breach')}</span></div>`;
    $('controls').innerHTML = `<div class="choices">${routeCard('supply')}${routeCard('breach')}</div>${riskLine()}${run.stage > 0 ? cashButton() : '<div class="choose-hint">CHOOSE YOUR WAY THROUGH</div>'}`;
  } else {
    $('enemy-art').innerHTML = `<img class="enemy solo ${boss ? 'warden' : ''}" src="assets/${boss ? 'warden' : 'infected'}.png" alt="">`;
    $('controls').innerHTML = shootingControls(run.phase === 'choice' && boss, added);
  }
}

async function takeRoute(route) {
  if (busy || run?.phase !== 'choice' || run.stage >= 4) return;
  busy = true;
  const { added } = preview(run, route);
  run = choose(run, route);
  transition = 'travel';
  audio.travel(); render(added);
  if (added >= 0) audio.load();
  await wait(added >= 0 ? 700 : 450);
  transition = null; busy = false; render();
}

async function spinTo(index) {
  const rotor = document.querySelector('#shot-dial .rotor');
  const destination = 1800 + (360 - index * 60) % 360;
  const duration = reduced ? 1000 : 2750;
  let lastTick = -1;
  await new Promise(resolve => {
    const started = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - started) / duration);
      const angle = destination * (1 - (1 - t) ** 4);
      rotor.style.transform = `rotate(${angle}deg)`;
      const tick = Math.floor(angle / 60);
      if (tick !== lastTick) { lastTick = tick; audio.tick(); }
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
  rotor.style.transform = `rotate(${destination}deg)`;
  return rotor.querySelector(`[data-slot="${index}"]`);
}

async function fire() {
  if (busy || !run || (run.phase !== 'aim' && !(run.phase === 'choice' && run.stage === 4))) return;
  busy = true;
  if (run.phase === 'choice') run = choose(run, 'boss');
  run = beginShot(run);
  const index = randomChamber(), hit = run.chambers[index];
  render(); audio.tension();
  const chamber = await spinTo(index);
  chamber.classList.add('selected', hit ? 'live-stop' : 'empty-stop');
  app.dataset.phase = 'reveal';
  await wait(400);
  const next = settleShot(run, index);
  app.classList.add(hit ? 'shot-hit' : 'shot-empty');
  if (hit) {
    audio.fire();
    chamber.querySelector('.cartridge').style.opacity = '0';
    $('shot-message').innerHTML = `<span>${icon('check')}<b>${next.phase === 'won' ? 'GATE CLEARED' : 'CLEAR'}</b></span><strong>${money(next.bank)}</strong>`;
  } else {
    audio.empty(); $('shot-message').innerHTML = `<span>${icon('empty')}<b>EMPTY</b></span><strong>NT$0</strong>`;
  }
  $('bounty').textContent = money(next.bank);
  await wait(hit ? 950 : 1050);
  run = next; busy = false; transition = null;
  app.classList.remove('shot-hit', 'shot-empty');
  if (run.phase === 'won') audio.win();
  render();
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  audio.start();
  if (button.id === 'sound') { muted = audio.toggle(); $('sound').innerHTML = icon(muted ? 'muted' : 'sound'); $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound'); $('sound').setAttribute('aria-pressed', String(muted)); return; }
  if (busy) return;
  if (button.dataset.betStep) {
    bet = BET_OPTIONS[BET_OPTIONS.indexOf(bet) + Number(button.dataset.betStep)];
    render();
    const step = document.querySelector(`[data-bet-step="${button.dataset.betStep}"]`);
    (step.disabled ? document.querySelector('[data-action="start"]') : step).focus();
    return;
  }
  if (button.dataset.route) { takeRoute(button.dataset.route); return; }
  if (button.dataset.action === 'start') { run = newRun(run?.balance ?? START_BALANCE, bet); transition = null; audio.travel(); render(); }
  if (button.dataset.action === 'fire') fire();
  if (button.dataset.action === 'cash') { run = cashOut(run); audio.win(); render(); }
});

render();
for (const name of ['tunnels', 'harbor', 'infected', 'warden', 'weapon']) { const img = new Image(); img.src = `assets/${name}.png`; }
