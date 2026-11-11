const {
  slots, finalStage, ammoLimit, bossShotLimit, bossHealth, initialCylinder, countAmmo, canBuy, loadAmmo,
  chamberIndex, shoot, price, encounters, ammoChests, supplyWheel, finalWheel, weightedIndex,
} = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const text = (id, value) => { ui[id].textContent = value; };
const money = cents => '$' + (cents / 100).toLocaleString('zh-TW', {
  minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
});
const signed = value => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = ms => pause(reducedMotion.matches ? Math.min(ms, 140) : ms);
const bets = [10_000, 20_000, 50_000, 100_000];
const startingBalance = 1_000_000;
const readyHint = '保留彈藥，打倒第五關首領';
const chestArt = type => `assets/chest-${type}.png`;

let mode = 'ready';
let balance = startingBalance;
let betIndex = 0;
let stage = 1;
let targets = [];
let shotsLeft = bossShotLimit;
let hitsLeft = bossHealth;
let spentOnAmmo = 0;
let chambers = initialCylinder();
let rotation = 0;
let hint = readyHint;

const stageCells = Array.from({ length: finalStage }, (_, i) => {
  const cell = document.createElement('li');
  if (i + 1 === finalStage) {
    const name = document.createElement('span');
    name.textContent = '首領';
    const jackpot = document.createElement('small');
    jackpot.className = 'ladder-jackpot';
    jackpot.textContent = 'WIN UP TO 10×';
    cell.append(name, jackpot);
  } else {
    cell.textContent = `第 ${i + 1} 關`;
  }
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
  const looting = mode === 'loot';
  const transitioning = mode === 'transition';
  const busy = spinning || looting || transitioning;
  const playing = !ready && !finished;
  const atBoss = stage === finalStage;
  const choosing = playing && !atBoss;
  const needsReset = ready && balance < bets[0];
  const cost = price(bet);
  ui.game.dataset.mode = mode;
  ui.arena.dataset.target = playing ? (atBoss ? 'boss' : targets[stage - 1]) : '';
  ui.enemy.hidden = atBoss;
  ui['boss-enemy'].hidden = !atBoss;
  ui.intro.hidden = !ready;
  ui.decisions.hidden = !choosing;
  ui.settlement.hidden = !finished;
  ui.loot.hidden = !looting;
  ui['stage-transition'].hidden = !transitioning;
  ui.primary.hidden = choosing;
  ui.primary.disabled = busy || needsReset;
  ui.skip.disabled = busy;
  ui.fire.disabled = busy || ammo === 0;
  ui.buy.hidden = mode !== 'boss' || shotsLeft !== bossShotLimit || Boolean(spentOnAmmo) || ammo > 2;
  ui.buy.disabled = !canBuy(ammo, balance, cost);
  ui['open-menu'].disabled = busy;
  ui['reset-assets'].disabled = busy;
  ui['bet-down'].disabled = !ready || betIndex === 0;
  ui['bet-up'].disabled = !ready || betIndex === bets.length - 1;
  text('primary-text', ready ? (balance < bet && !needsReset ? '切換最低押注' : '開始遊戲') : finished ? '再玩一輪' : spinning ? '射擊中' : 'FIRE');
  text('balance', money(balance));
  text('bet', money(bet));
  text('ammo', `${ammo} / ${slots}`);
  text('hint', needsReset ? '餘額不足，請從選單重設資產' : ready && balance < bet ? `目前押注 ${money(bet)}，餘額不足` : hint);
  const resetAmount = money(startingBalance);
  text('reset-note', busy ? '等待演出結束' : playing ? `結束本輪 · ${resetAmount}` : resetAmount);
  text('gate-number', String(stage).padStart(2, '0'));
  ui['stage-status'].hidden = !playing || transitioning;
  ui['jackpot-banner'].hidden = !atBoss || ammo < hitsLeft || shotsLeft < hitsLeft;
  ui['chest-preview'].hidden = atBoss || !playing;
  if (playing) {
    if (atBoss) {
      text('stage-plate', '封鎖區首領');
      text('encounter-detail', `剩 ${hitsLeft} 次命中 · 剩 ${shotsLeft} 次開槍`);
    } else {
      const type = targets[stage - 1];
      const { name, drops } = ammoChests[type];
      ui['chest-preview'].src = chestArt(type);
      text('stage-plate', name);
      text('encounter-detail', drops.map((odds, ammo) => `${ammo ? `${ammo} 發` : '空箱'} ${odds}%`).join(' · '));
    }
  }
  chamberCells.forEach((cell, i) => cell.classList.toggle('loaded', chambers[i]));
  ui.cylinder.style.transform = `rotate(${rotation}deg)`;
  stageCells.forEach((cell, i) => {
    cell.classList.toggle('cleared', i + 1 < stage || ui.game.dataset.outcome === 'clear');
    cell.classList.toggle('current', i + 1 === stage && !finished);
    if (i + 1 === stage && !finished) cell.setAttribute('aria-current', 'step');
    else cell.removeAttribute('aria-current');
  });
  text('fire-odds', ammo ? `命中 ${ammo}/${slots}` : '無彈藥');
  text('buy-cost', balance < cost ? '餘額不足' : signed(-cost));
}

function finish(cleared, reward = 0) {
  const bet = bets[betIndex];
  balance += reward;
  mode = 'result';
  ui.game.dataset.outcome = cleared ? 'clear' : 'miss';
  text('result-caption', cleared ? 'FINAL CHEST' : 'MISSION FAILED');
  text('result-title', reward === bet * 10 ? '10× 大獎' : cleared ? '最終寶箱' : '任務失敗');
  text('result-payout', signed(reward));
  text('result-net', `本輪淨額 ${signed(reward - bet - spentOnAmmo)}`);
  hint = !cleared ? '未能擊倒首領' : reward === bet + spentOnAmmo ? '已領回本輪投入' : '獎金已計入餘額';
  render();
  if (cleared) revolverAudio.play('clear');
}

function animateShot() {
  const gun = document.querySelector('.shooter').getBoundingClientRect();
  const enemy = (stage === finalStage ? ui['boss-enemy'] : ui.enemy).getBoundingClientRect();
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

async function spinDial(frame, face, selected, start, time) {
  const step = 360 / slots;
  const end = start + 1080 + (720 - selected * step - start % 360) % 360;
  frame.dataset.spin = 'rolling';
  const duration = reducedMotion.matches ? 0 : time;
  const spin = face.animate([
    { transform: `rotate(${start}deg)` },
    { transform: `rotate(${end}deg)` },
  ], { duration, easing: 'cubic-bezier(.17,.62,.24,1)' });
  let slot = Math.floor(start / step);
  let tickFrame;
  function tick() {
    const progress = spin.effect.getComputedTiming().progress ?? 0;
    const crossed = Math.floor((start + (end - start) * progress) / step);
    if (crossed !== slot && progress < 1) revolverAudio.play('tick');
    slot = crossed;
    tickFrame = requestAnimationFrame(tick);
  }
  if (duration) tickFrame = requestAnimationFrame(tick);
  await spin.finished;
  if (tickFrame !== undefined) cancelAnimationFrame(tickFrame);
  face.style.transform = `rotate(${end}deg)`;
  frame.dataset.spin = 'locked';
  revolverAudio.play('lock');
  return end;
}

async function spinChest(type, prizes, formatReward) {
  const frame = ui['loot-wheel'];
  const face = ui['loot-disc'];
  const weights = prizes.map(({ weight }) => weight);
  const selected = weightedIndex(weights);
  delete frame.dataset.spin;
  frame.dataset.kind = type ? 'ammo' : 'payout';
  face.style.transform = 'rotate(0deg)';
  face.style.setProperty('--upright', '0deg');
  const pockets = prizes.map(({ reward, tier }, i) => {
    const pocket = document.createElement('div');
    const angle = i * 2 * Math.PI / slots;
    const jackpot = !type && tier === 3;
    const count = type ? reward : jackpot ? 1 : tier + 1;
    const icon = type ? 'assets/cartridge.png' : jackpot ? chestArt('gold') : 'assets/coin.png';
    pocket.className = 'loot-pocket';
    pocket.dataset.count = String(count);
    pocket.classList.toggle('jackpot', jackpot);
    pocket.setAttribute('role', 'img');
    pocket.setAttribute('aria-label', formatReward(reward));
    pocket.style.setProperty('--x', `${50 + 33 * Math.sin(angle)}%`);
    pocket.style.setProperty('--y', `${50 - 33 * Math.cos(angle)}%`);
    for (let j = 0; j < count; j++) {
      const picture = document.createElement('img');
      picture.className = 'loot-icon';
      picture.src = icon;
      picture.alt = '';
      pocket.append(picture);
    }
    return pocket;
  });
  face.replaceChildren(...pockets);
  ui['loot-chest'].src = chestArt(type ?? 'gold');
  text('loot-title', type ? `${ammoChests[type].name}・彈藥補給` : '最終寶箱');
  text('loot-result', '');
  mode = 'loot';
  render();
  await pause(700);
  text('loot-result', '轉輪旋轉中…');
  const end = await spinDial(frame, face, selected, 0, 1450);
  face.style.setProperty('--upright', `${-end}deg`);
  pockets[selected].classList.add('landed');
  return prizes[selected].reward;
}

async function fire() {
  if (!['encounter', 'boss'].includes(mode) || !countAmmo(chambers)) return;
  const atBoss = mode === 'boss';
  revolverAudio.unlock();
  mode = 'spinning';
  const selected = chamberIndex();
  const outcome = shoot(chambers, selected);
  const lethal = outcome.hit && (!atBoss || hitsLeft === 1);
  hint = '彈巢旋轉中…';
  render();
  rotation = await spinDial(ui.weapon, ui.cylinder, selected, rotation, 850);
  chamberCells[selected].classList.add('selected');
  await wait(85);
  if (outcome.hit) animateShot();
  ui.arena.dataset.shot = lethal ? 'kill' : outcome.hit ? 'hit' : 'miss';
  revolverAudio.play(outcome.hit ? 'fire' : 'empty');
  hint = lethal ? '命中 · 目標擊倒' : outcome.hit ? '命中首領' : '空槍 · 彈藥保留';
  render();
  await wait(620);
  chambers = outcome.chambers;
  chamberCells[selected].classList.remove('selected');
  delete ui.weapon.dataset.spin;
  delete ui.arena.dataset.shot;
  if (atBoss) {
    shotsLeft--;
    if (outcome.hit) hitsLeft--;
    if (lethal) {
      const reward = await spinChest(null, finalWheel(bets[betIndex], spentOnAmmo), money);
      text('loot-result', `獲得 ${money(reward)}`);
      await pause(1050);
      return finish(true, reward);
    }
    if (!shotsLeft || countAmmo(chambers) < hitsLeft || shotsLeft < hitsLeft) return finish(false);
    mode = 'boss';
    render();
    return;
  }
  if (!outcome.hit) return advance(hint);
  const target = targets[stage - 1];
  const reward = await spinChest(target, supplyWheel(target), ammo => ammo ? `${ammo} 發` : '空箱');
  const loaded = reward ? reload(reward) : 0;
  const message = reward ? `抽中 ${reward} 發 · 裝入 ${loaded} 發` : '抽中空箱 · 未取得彈藥';
  text('loot-result', message);
  render();
  await pause(1050);
  advance(message);
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

async function advance(message) {
  const nextStage = stage + 1;
  const enteringBoss = nextStage === finalStage;
  const duration = reducedMotion.matches ? (enteringBoss ? 460 : 300) : (enteringBoss ? 1000 : 600);
  const transition = ui['stage-transition'];
  transition.dataset.boss = String(enteringBoss);
  transition.style.setProperty('--transition-time', `${duration}ms`);
  text('transition-result', message);
  text('transition-title', `第 ${stage} 關 → 第 ${nextStage} 關${enteringBoss ? '・首領' : ''}`);
  ui['transition-boss'].hidden = !enteringBoss;
  text('transition-boss', `${bossShotLimit} 次開槍機會・需命中 ${bossHealth} 次`);
  mode = 'transition';
  hint = message;
  render();
  await pause(duration / 2);
  stage = nextStage;
  revolverAudio.play('lock');
  render();
  await pause(duration / 2);
  mode = enteringBoss ? 'boss' : 'encounter';
  if (enteringBoss && !countAmmo(chambers)) return finish(false);
  render();
  if (enteringBoss) ui.primary.focus({ preventScroll: true });
}

function reload(amount) {
  const loaded = loadAmmo(chambers, amount);
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
  if (mode !== 'boss' || shotsLeft !== bossShotLimit || spentOnAmmo) return;
  const cost = price(bets[betIndex]);
  if (!canBuy(countAmmo(chambers), balance, cost)) return;
  balance -= cost;
  spentOnAmmo += cost;
  reload(1);
  hint = `補彈完成 · 已扣 ${money(cost)}`;
  render();
}

function resetRound() {
  mode = 'ready';
  stage = 1;
  shotsLeft = bossShotLimit;
  hitsLeft = bossHealth;
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
  if (['spinning', 'loot', 'transition'].includes(mode)) return;
  balance = startingBalance;
  ui.menu.close();
  resetRound();
});
ui.help.addEventListener('click', () => {
  ui.menu.close();
  ui.rules.showModal();
});
render();
