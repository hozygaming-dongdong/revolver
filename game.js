const {
  slots, finalStage, ammoLimit, bossShotLimit, bossHealth, initialCylinder, countAmmo, canBuy, loadAmmo,
  chamberIndex, shoot, price, encounters, openChest,
} = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const text = (id, value) => { ui[id].textContent = value; };
const money = cents => '$' + (cents / 100).toLocaleString('zh-TW', {
  minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
});
const signed = value => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 140) : ms));
const bets = [10_000, 20_000, 50_000, 100_000];
const startingBalance = 1_000_000;
const readyHint = '保留彈藥，打倒第五關首領';
const enemyInfo = {
  supply: ['補給殭屍', '擊倒掉落 2 發普通彈'],
  reward: ['獎勵殭屍', '擊倒獲得寶箱 1.5× 加成'],
  gold: ['金彈殭屍', '擊倒掉落 1 發金彈'],
};

let mode = 'ready';
let balance = startingBalance;
let betIndex = 0;
let stage = 1;
let targets = [];
let shotsLeft = bossShotLimit;
let hitsLeft = bossHealth;
let boosted = false;
let spentOnAmmo = 0;
let chambers = initialCylinder();
let rotation = 0;
let hint = readyHint;

const stageCells = Array.from({ length: finalStage }, (_, i) => {
  const cell = document.createElement('li');
  cell.textContent = i + 1 === finalStage ? '首領' : `第 ${i + 1} 關`;
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
  const ready = mode === 'ready';
  const finished = mode === 'result';
  const spinning = mode === 'spinning';
  const playing = !ready && !finished;
  const atBoss = stage === finalStage;
  const choosing = playing && !atBoss;
  const needsReset = ready && balance < bets[0];
  const goldLoaded = chambers.includes('gold');
  const cost = price(bet);
  ui.game.dataset.mode = mode;
  ui.arena.dataset.target = playing ? (atBoss ? 'boss' : targets[stage - 1]) : '';
  ui.intro.hidden = !ready;
  ui.decisions.hidden = !choosing;
  ui.settlement.hidden = !finished;
  ui.primary.hidden = choosing;
  ui.primary.disabled = spinning || needsReset;
  ui.skip.disabled = spinning;
  ui.fire.disabled = spinning || ammo === 0;
  ui.buy.disabled = spinning || !canBuy(ammo, balance, cost);
  ui['reset-assets'].disabled = spinning;
  ui['bet-down'].disabled = !ready || betIndex === 0;
  ui['bet-up'].disabled = !ready || betIndex === bets.length - 1;
  text('primary-text', ready ? (balance < bet && !needsReset ? '切換最低押注' : '開始遊戲') : finished ? '再玩一輪' : spinning ? '射擊中' : 'FIRE');
  text('balance', money(balance));
  text('bet', money(bet));
  text('ammo', `${ammo} / ${slots}`);
  ui['ammo-extra'].hidden = !goldLoaded && !boosted;
  text('ammo-extra', [goldLoaded ? '含 1 發金彈' : '', boosted ? '寶箱 1.5×' : ''].filter(Boolean).join(' · '));
  text('hint', needsReset ? '餘額不足，請從選單重設資產' : ready && balance < bet ? `目前押注 ${money(bet)}，餘額不足` : hint);
  const resetAmount = money(startingBalance);
  text('reset-note', spinning ? '等待射擊結束' : playing ? `結束本輪 · ${resetAmount}` : resetAmount);
  text('gate-number', String(stage).padStart(2, '0'));
  ui['stage-status'].hidden = !playing;
  ui['jackpot-banner'].hidden = !atBoss || (!goldLoaded && (ammo < hitsLeft || shotsLeft < hitsLeft));
  if (playing) {
    const [name, detail] = atBoss
      ? ['封鎖區首領', `剩 ${hitsLeft} 次命中 · 剩 ${shotsLeft} 次開槍`]
      : enemyInfo[targets[stage - 1]];
    text('stage-plate', name);
    text('encounter-detail', detail);
  }
  chamberCells.forEach((cell, i) => {
    cell.classList.toggle('loaded', Boolean(chambers[i]));
    cell.classList.toggle('gold', chambers[i] === 'gold');
  });
  ui.cylinder.style.transform = `rotate(${rotation}deg)`;
  stageCells.forEach((cell, i) => {
    cell.classList.toggle('cleared', i + 1 < stage || ui.game.dataset.outcome === 'clear');
    cell.classList.toggle('current', i + 1 === stage && !finished);
    if (i + 1 === stage && !finished) cell.setAttribute('aria-current', 'step');
    else cell.removeAttribute('aria-current');
  });
  text('fire-odds', ammo ? `命中 ${ammo}/${slots}` : '無彈藥');
  text('buy-cost', ammo >= ammoLimit ? '彈藥已滿' : balance < cost ? '餘額不足' : signed(-cost));
}

function finish(cleared) {
  const bet = bets[betIndex];
  const chest = cleared ? openChest(bet, spentOnAmmo, boosted) : null;
  const reward = chest?.reward ?? 0;
  balance += reward;
  mode = 'result';
  ui.game.dataset.outcome = cleared ? 'clear' : 'miss';
  text('result-caption', cleared ? 'FINAL CHEST' : 'MISSION FAILED');
  text('result-title', chest?.jackpot ? '10× 大獎' : cleared ? '最終寶箱' : '任務失敗');
  text('result-payout', signed(reward));
  text('result-net', `本輪淨額 ${signed(reward - bet - spentOnAmmo)}`);
  hint = !cleared ? '未能擊倒首領' : chest.floorApplied ? '已按本輪投入補足回本保底' : '獎金已計入餘額';
  render();
  if (cleared) revolverAudio.play('clear');
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
  if (!['encounter', 'boss'].includes(mode) || !countAmmo(chambers)) return;
  const atBoss = mode === 'boss';
  revolverAudio.unlock();
  mode = 'spinning';
  const selected = chamberIndex();
  const outcome = shoot(chambers, selected);
  const gold = outcome.round === 'gold';
  const lethal = outcome.round && (!atBoss || gold || hitsLeft === 1);
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
  if (outcome.round) animateShot();
  ui.arena.dataset.shot = gold ? 'gold' : lethal ? 'kill' : outcome.round ? 'hit' : 'miss';
  revolverAudio.play(outcome.round ? 'fire' : 'empty');
  hint = gold ? '金彈命中 · 一槍擊殺' : lethal ? '命中 · 目標擊倒' : outcome.round ? '命中首領' : '空槍 · 彈藥保留';
  render();
  await wait(620);
  chambers = outcome.chambers;
  chamberCells[selected].classList.remove('selected');
  delete ui.weapon.dataset.spin;
  delete ui.arena.dataset.shot;
  if (atBoss) {
    shotsLeft--;
    if (outcome.round) hitsLeft--;
    if (lethal) return finish(true);
    if (!shotsLeft || !countAmmo(chambers)) return finish(false);
    mode = 'boss';
    render();
    return;
  }
  if (!outcome.round) return advance(hint);
  const target = targets[stage - 1];
  if (target === 'reward') {
    boosted = true;
    return advance('擊倒殭屍 · 取得寶箱 1.5× 加成');
  }
  const loaded = reload(target === 'supply' ? 2 : 1, target === 'gold' ? 'gold' : 'normal');
  advance(target === 'gold' ? '擊倒殭屍 · 金彈已裝入' : `擊倒殭屍 · 裝入 ${loaded} 發普通彈`);
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
  targets = encounters();
  mode = 'encounter';
  hint = '選擇本關行動';
  render();
}

function advance(message) {
  stage++;
  mode = stage === finalStage ? 'boss' : 'encounter';
  hint = message;
  if (mode === 'boss' && !countAmmo(chambers)) return finish(false);
  render();
  if (mode === 'boss') ui.primary.focus();
}

function reload(amount, round) {
  const loaded = loadAmmo(chambers, amount, round);
  let added = 0;
  loaded.forEach((value, i) => {
    if (!value || chambers[i]) return;
    added++;
    chamberCells[i].animate([
      { filter: 'brightness(1.8) drop-shadow(0 0 8px #ffb750)' },
      { filter: 'none' },
    ], { duration: reducedMotion.matches ? 140 : 300, easing: 'ease-out' });
  });
  chambers = loaded;
  if (added) revolverAudio.play('reload');
  return added;
}

function buyAmmo() {
  if (mode !== 'encounter') return;
  const cost = price(bets[betIndex]);
  if (!canBuy(countAmmo(chambers), balance, cost)) return;
  balance -= cost;
  spentOnAmmo += cost;
  reload(1);
  advance(`補彈完成 · 已扣 ${money(cost)}`);
}

function resetRound() {
  mode = 'ready';
  stage = 1;
  shotsLeft = bossShotLimit;
  hitsLeft = bossHealth;
  boosted = false;
  spentOnAmmo = 0;
  chambers = initialCylinder();
  rotation = 0;
  hint = readyHint;
  delete ui.game.dataset.outcome;
  render();
}

ui.primary.addEventListener('click', () => {
  if (mode === 'ready') start();
  else if (mode === 'boss') fire();
  else if (mode === 'result') resetRound();
});
for (const [id, step] of [['bet-down', -1], ['bet-up', 1]]) {
  ui[id].addEventListener('click', () => { betIndex += step; render(); });
}
ui.skip.addEventListener('click', () => { if (mode === 'encounter') advance('已繞過 · 彈藥保留'); });
ui.fire.addEventListener('click', fire);
ui.buy.addEventListener('click', buyAmmo);
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
