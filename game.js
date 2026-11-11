const {
  slots, multiplierScale, multipliers, finalStage, ammoLimit, initialCylinder, countAmmo, canBuy, loadAmmo,
  chamberIndex, shoot, payout, price,
} = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const text = (id, value) => { ui[id].textContent = value; };
const money = cents => '$' + (cents / 100).toLocaleString('zh-TW', {
  minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
});
const signed = value => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
const multiple = stage => `${(multipliers[stage] / multiplierScale).toFixed(3)}×`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 140) : ms));
const bets = [10_000, 20_000, 50_000, 100_000];
const startingBalance = 1_000_000;
const readyHint = '按下開始遊戲，進入封鎖區';

let mode = 'ready';
let balance = startingBalance;
let betIndex = 0;
let cleared = 0;
let spentOnAmmo = 0;
let chambers = initialCylinder();
let rotation = 0;
let hint = readyHint;

const stageCells = multipliers.slice(1).map((_, i) => {
  const cell = document.createElement('li');
  cell.innerHTML = `<span>第 ${i + 1} 關</span><b>${multiple(i + 1)}</b>`;
  ui.ladder.append(cell);
  return cell;
});
const chamberCells = chambers.map((_, i) => {
  const cell = document.createElement('i');
  cell.style.setProperty('--angle', `${i * 60}deg`);
  ui.cylinder.append(cell);
  return cell;
});

function render() {
  const bet = bets[betIndex];
  const ammo = countAmmo(chambers);
  const deciding = mode === 'decision';
  const ready = mode === 'ready';
  const finished = mode === 'result';
  const spinning = mode === 'spinning';
  const needsReset = ready && balance < bets[0];
  const activeStage = Math.min(finalStage, cleared + 1);
  ui.game.dataset.mode = mode;
  ui.intro.hidden = !ready;
  ui.decisions.hidden = !deciding;
  ui.settlement.hidden = !finished;
  ui.primary.hidden = deciding;
  ui.primary.disabled = spinning || needsReset;
  ui['reset-assets'].disabled = spinning;
  ui['bet-down'].disabled = !ready || betIndex === 0;
  ui['bet-up'].disabled = !ready || betIndex === bets.length - 1;
  text('primary-text', ready ? (balance < bet && !needsReset ? '切換最低押注' : '開始遊戲') : finished ? '再玩一輪' : spinning ? '射擊中' : 'FIRE');
  text('balance', money(balance));
  text('bet', money(bet));
  text('ammo', `${ammo} / ${slots}`);
  text('hint', needsReset ? '餘額不足，請從選單重設資產' : ready && balance < bet ? `目前押注 ${money(bet)}，餘額不足` : hint);
  const resetAmount = money(startingBalance);
  text('reset-note', spinning ? '等待射擊結束' : mode === 'aim' || deciding ? `結束本輪 · ${resetAmount}` : resetAmount);
  text('gate-number', String(Math.min(finalStage, activeStage + (deciding ? 0 : 1))).padStart(2, '0'));
  ui['stage-plate'].hidden = ready || finished;
  text('stage-plate', deciding ? `第 ${cleared} 關完成 → 第 ${activeStage} 關` : `第 ${activeStage} 關 / ${finalStage}`);
  chamberCells.forEach((cell, i) => cell.classList.toggle('loaded', chambers[i]));
  ui.cylinder.style.transform = `rotate(${rotation}deg)`;
  stageCells.forEach((cell, i) => {
    cell.classList.toggle('cleared', i < cleared);
    cell.classList.toggle('current', i + 1 === activeStage && i >= cleared && !finished);
    if (i + 1 === activeStage && !finished) cell.setAttribute('aria-current', 'step');
    else cell.removeAttribute('aria-current');
  });
  if (deciding) {
    const cost = price(bet, cleared, ammo);
    text('cash-multiple', multiple(cleared));
    text('cash-amount', signed(payout(bet, cleared)));
    text('keep-odds', `${ammo}/${slots}`);
    text('keep-next', `下一關 ${multiple(activeStage)}`);
    text('buy-next', `下一關 ${multiple(activeStage)}`);
    text('buy-odds', `${Math.min(ammoLimit, ammo + 1)}/${slots}`);
    ui.continue.disabled = ammo === 0;
    text('keep-cost', ammo ? '免費' : '彈藥耗盡');
    ui.buy.disabled = !canBuy(ammo, balance, cost);
    text('buy-label', ammo >= ammoLimit ? '已達上限' : balance < cost ? '餘額不足' : '補一發');
    text('buy-cost', signed(-cost));
  }
}

function finish(reason) {
  const bet = bets[betIndex];
  const reward = reason === 'miss' ? 0 : payout(bet, cleared);
  balance += reward;
  mode = 'result';
  ui.game.dataset.outcome = reason;
  text('result-caption', reason === 'miss' ? 'EMPTY CHAMBER' : reason === 'clear' ? 'ALL STAGES CLEARED' : 'CASH OUT');
  text('result-title', reason === 'miss' ? '任務失敗' : reason === 'clear' ? '突破封鎖' : '撤離成功');
  text('result-payout', signed(reward));
  text('result-net', `本輪淨額 ${signed(reward - bet - spentOnAmmo)}`);
  hint = reason === 'miss' ? '抽中空槽，未領獎金歸零' : '獎金已計入餘額';
  render();
  if (reason !== 'miss') revolverAudio.play(reason);
}

function animateShot() {
  const gun = document.querySelector('.shooter').getBoundingClientRect();
  const enemy = document.querySelector('.enemy').getBoundingClientRect();
  const arena = ui.arena.getBoundingClientRect();
  const start = [gun.left + gun.width * .965 - arena.left, gun.top + gun.height * .182 - arena.top];
  const end = [enemy.left + enemy.width * .48 - arena.left, enemy.top + enemy.height * .07 - arena.top];
  for (const [element, coords] of [[ui.muzzle, start], [ui.tracer, start], [ui.impact, end]]) {
    element.style.left = `${coords[0]}px`;
    element.style.top = `${coords[1]}px`;
  }
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (reducedMotion.matches) return;
  const angle = Math.atan2(dy, dx);
  ui.tracer.animate([
    { transform: `translate(0, 0) rotate(${angle}rad)`, opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${angle}rad)`, opacity: .85, offset: 2 / 3 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${angle}rad)`, opacity: 0 },
  ], { duration: 180 });
}

async function fire() {
  if (mode !== 'aim') return;
  revolverAudio.unlock();
  mode = 'spinning';
  const selected = chamberIndex();
  const outcome = shoot(chambers, selected);
  const startRotation = rotation;
  const turn = (360 - selected * 60 - rotation % 360 + 360) % 360;
  rotation += turn + 1080;
  hint = '彈巢旋轉中…';
  ui.weapon.dataset.spin = 'rolling';
  render();
  const duration = reducedMotion.matches ? 0 : 850;
  const spin = ui.cylinder.animate([
    { transform: `rotate(${startRotation}deg)` },
    { transform: `rotate(${rotation}deg)` },
  ], { duration, easing: 'cubic-bezier(.17,.62,.24,1)' });
  let slot = Math.floor(startRotation / 60);
  let tickFrame;
  function tick() {
    const progress = spin.effect.getComputedTiming().progress ?? 0;
    const crossed = Math.floor((startRotation + (rotation - startRotation) * progress) / 60);
    if (crossed !== slot && progress < 1) revolverAudio.play('tick');
    slot = crossed;
    tickFrame = requestAnimationFrame(tick);
  }
  if (duration) tickFrame = requestAnimationFrame(tick);
  await spin.finished;
  cancelAnimationFrame(tickFrame);

  ui.weapon.dataset.spin = 'locked';
  chamberCells[selected].classList.add('selected');
  revolverAudio.play('lock');
  await wait(85);
  if (outcome.hit) animateShot();
  ui.arena.dataset.shot = outcome.hit ? 'hit' : 'miss';
  revolverAudio.play(outcome.hit ? 'fire' : 'empty');
  hint = outcome.hit ? '命中 · 目標擊倒' : '空槽 · 槍手遭到襲擊';
  render();
  await wait(620);
  chambers = outcome.chambers;
  chamberCells[selected].classList.remove('selected');
  delete ui.weapon.dataset.spin;
  delete ui.arena.dataset.shot;
  if (!outcome.hit) return finish('miss');
  cleared++;
  if (cleared === finalStage) return finish('clear');
  mode = 'decision';
  hint = '領取獎金，或挑戰下一關';
  render();
}

function start() {
  const bet = bets[betIndex];
  if (balance < bets[0]) return;
  if (balance < bet) {
    betIndex = 0;
    render();
    return;
  }
  revolverAudio.startMusic();
  balance -= bet;
  mode = 'aim';
  hint = '按下 FIRE 抽取一格彈槽';
  render();
}

function advance(buy) {
  if (mode !== 'decision') return;
  const bet = bets[betIndex];
  const ammo = countAmmo(chambers);
  let reloadedSlot;
  if (buy) {
    const cost = price(bet, cleared, ammo);
    if (!canBuy(ammo, balance, cost)) return;
    balance -= cost;
    spentOnAmmo += cost;
    const loaded = loadAmmo(chambers);
    reloadedSlot = chamberCells[loaded.findIndex((hasRound, slot) => hasRound && !chambers[slot])];
    chambers = loaded;
  } else if (!ammo) return;
  mode = 'aim';
  hint = buy ? '補彈完成 · 按下 FIRE' : '按下 FIRE 挑戰下一關';
  render();
  if (reloadedSlot) {
    reloadedSlot.animate([
      { filter: 'brightness(1.8) drop-shadow(0 0 8px #ffb750)' },
      { filter: 'none' },
    ], { duration: reducedMotion.matches ? 140 : 300, easing: 'ease-out' });
    revolverAudio.play('reload');
  }
  ui.primary.focus();
}

function resetRound() {
  mode = 'ready';
  cleared = 0;
  spentOnAmmo = 0;
  chambers = initialCylinder();
  rotation = 0;
  hint = readyHint;
  delete ui.game.dataset.outcome;
  render();
}

ui.primary.addEventListener('click', () => {
  if (mode === 'ready') start();
  else if (mode === 'aim') fire();
  else if (mode === 'result') resetRound();
});
for (const [id, step] of [['bet-down', -1], ['bet-up', 1]]) {
  ui[id].addEventListener('click', () => { betIndex += step; render(); });
}
ui.cash.addEventListener('click', () => { if (mode === 'decision') finish('cash'); });
ui.continue.addEventListener('click', () => advance(false));
ui.buy.addEventListener('click', () => advance(true));
ui['open-menu'].addEventListener('click', () => ui.menu.showModal());
ui.sound.addEventListener('click', () => {
  const muted = revolverAudio.toggleMute();
  ui.sound.setAttribute('aria-pressed', String(muted));
  text('sound-state', muted ? '關' : '開');
});
ui.music.addEventListener('click', () => {
  const enabled = revolverAudio.toggleMusic();
  ui.music.setAttribute('aria-pressed', String(enabled));
  text('music-state', enabled ? '開' : '關');
});
ui['reset-assets'].addEventListener('click', () => {
  if (mode === 'spinning') return;
  balance = startingBalance;
  ui.menu.close();
  resetRound();
});
ui.help.addEventListener('click', () => {
  ui.menu.close();
  ui.rules.showModal();
});
render();
