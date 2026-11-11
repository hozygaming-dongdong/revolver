const {
  slots, finalStage, bossShotLimit, bossHealth, initialCylinder, countAmmo, canBuy, loadAmmo,
  chamberIndex, shoot, price, encounters, chestTiers, coinMultipliers, maxBaseMultiplier,
  supplyWheel, coinWheel, stackMultiplier, finalWheel, weightedIndex,
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
const chestArt = type => `assets/chest-${type}.png`;
const finalCache = 'assets/final-cache.webp';
const multiplierText = multiplier => `${multiplier.toLocaleString('zh-TW', { maximumFractionDigits: 5 })}×`;
const ammoText = ammo => ammo ? `${ammo} 發` : '空箱';
const vaultNames = { coin: '金幣庫', ammo: '軍械庫' };

let mode = 'ready';
let balance = startingBalance;
let betIndex = 0;
let stage = 1;
let targets = [];
let selectedVault = null;
let multiplier = 1;
let shotsLeft = bossShotLimit;
let hitsLeft = bossHealth;
let spentOnAmmo = 0;
let chambers = initialCylinder();
let rotation = 0;
let hint = '';

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
const bossCounters = [
  { value: 'boss-hits-left', marks: 'boss-hits', limit: bossHealth, remaining: () => hitsLeft },
  { value: 'boss-shots-left', marks: 'boss-shots', limit: bossShotLimit, remaining: () => shotsLeft },
];
for (const counter of bossCounters) {
  counter.cells = Array.from({ length: counter.limit }, () => document.createElement('i'));
  ui[counter.marks].append(...counter.cells);
}
text('intro-cap', multiplierText(maxBaseMultiplier));

function canOfferAmmo(ammo) {
  return canBuy(ammo, mode) && (mode !== 'boss' || shotsLeft === bossShotLimit);
}

function render() {
  const bet = bets[betIndex];
  const ammo = countAmmo(chambers);
  const ready = mode === 'ready';
  const finished = mode === 'result';
  const spinning = mode === 'spinning';
  const looting = mode === 'loot';
  const transitioning = mode === 'transition';
  const opening = mode === 'entering';
  const busy = spinning || looting || transitioning || opening;
  const playing = !ready && !finished;
  const atBoss = stage === finalStage;
  const selecting = mode === 'vault';
  const choosing = selecting || opening || (transitioning && !atBoss && !selectedVault);
  const fighting = playing && !choosing;
  const inVault = fighting && !atBoss && Boolean(selectedVault);
  const target = inVault ? targets[stage - 1][selectedVault] : null;
  const needsReset = ready && balance < bets[0];
  const cost = price(bet);
  ui.game.dataset.mode = mode;
  ui.arena.dataset.scene = ready ? 'intro' : finished ? 'settlement' : choosing ? 'vault' : 'fight';
  ui.arena.dataset.target = fighting && atBoss ? 'boss' : target ?? '';
  ui.arena.dataset.vault = inVault ? selectedVault : '';
  ui.enemy.hidden = !fighting || atBoss;
  ui['boss-enemy'].hidden = !fighting || !atBoss;
  ui.weapon.hidden = !fighting;
  ui.intro.hidden = !ready;
  ui.vaults.hidden = !choosing;
  ui.vaults.dataset.opening = opening ? selectedVault : '';
  ui.decisions.hidden = !inVault || transitioning;
  ui.settlement.hidden = !finished;
  ui.loot.hidden = !looting;
  ui['stage-transition'].hidden = !transitioning;
  ui.primary.hidden = playing && !atBoss;
  ui.primary.disabled = busy || needsReset;
  ui.skip.disabled = busy;
  ui.fire.disabled = busy || ammo === 0;
  ui.buy.hidden = !canOfferAmmo(ammo) && !(opening && canBuy(ammo, 'vault'));
  ui.buy.disabled = busy || balance < cost;
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
  ui['stage-status'].hidden = !fighting || transitioning;
  ui['run-bonus'].hidden = !playing;
  text('run-multiplier', multiplierText(multiplier));
  text('jackpot-banner', `WIN UP TO ${multiplierText(maxBaseMultiplier * multiplier)}`);
  ui['chest-preview'].hidden = !target;
  ui['encounter-detail'].hidden = atBoss;
  ui['boss-progress'].hidden = !atBoss;
  if (choosing) {
    for (const vault of ['coin', 'ammo']) {
      const door = ui[`vault-${vault}`];
      const tier = targets[stage - 1][vault];
      door.disabled = !selecting;
      door.dataset.tier = tier;
      text(`vault-${vault}-tier`, chestTiers[tier].name);
    }
  } else if (fighting && !transitioning) {
    if (atBoss) {
      text('stage-plate', '封鎖區首領');
      for (const counter of bossCounters) {
        const remaining = counter.remaining();
        text(counter.value, remaining);
        counter.cells.forEach((cell, index) => cell.classList.toggle('remaining', index < remaining));
      }
    } else if (target) {
      const chest = chestTiers[target];
      const format = selectedVault === 'coin' ? i => multiplierText(coinMultipliers[i]) : ammoText;
      ui['chest-preview'].src = chestArt(target);
      text('stage-plate', `${vaultNames[selectedVault]}・${chest.name}`);
      text('encounter-detail', chest[selectedVault].flatMap((odds, i) => odds ? [`${format(i)} ${odds}%`] : []).join(' · '));
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

function finish(prize = null) {
  const bet = bets[betIndex];
  const cleared = Boolean(prize);
  const reward = prize?.reward ?? 0;
  balance += reward;
  mode = 'result';
  ui.game.dataset.outcome = cleared ? 'clear' : 'miss';
  text('result-title', prize?.tier === 3 ? `${multiplierText(maxBaseMultiplier * multiplier)} 大獎` : cleared ? '首領已擊倒' : '任務失敗');
  ui['result-cache'].hidden = !cleared;
  ui['result-amount'].hidden = !cleared;
  text('result-payout', signed(reward));
  text('result-net', signed(reward - bet - spentOnAmmo));
  ui['result-breakdown'].hidden = !cleared || multiplier === 1;
  if (cleared) text('result-breakdown', `${money(prize.baseReward)} × ${multiplierText(multiplier).slice(0, -1)}`);
  hint = '';
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

async function spinChest(kind, type, prizes, formatReward) {
  const frame = ui['loot-wheel'];
  const face = ui['loot-disc'];
  const weights = prizes.map(({ weight }) => weight);
  const selected = weightedIndex(weights);
  delete frame.dataset.spin;
  ui.loot.dataset.kind = kind;
  face.style.transform = 'rotate(0deg)';
  face.style.setProperty('--upright', '0deg');
  const pockets = prizes.map(({ reward, tier }, i) => {
    const pocket = document.createElement('div');
    const angle = i * 2 * Math.PI / slots;
    const count = kind === 'ammo' ? reward : 1;
    const icon = kind === 'ammo' ? (reward ? 'assets/cartridge.png' : 'assets/reward-empty.webp')
      : `assets/reward-${kind === 'coin' ? 'coin' : 'cash'}-${tier}.webp`;
    pocket.className = 'loot-pocket';
    pocket.dataset.count = String(count);
    pocket.classList.toggle('jackpot', kind === 'payout' && tier === 3);
    pocket.setAttribute('role', 'img');
    pocket.setAttribute('aria-label', formatReward(reward));
    pocket.style.setProperty('--x', `${50 + 33 * Math.sin(angle)}%`);
    pocket.style.setProperty('--y', `${50 - 33 * Math.cos(angle)}%`);
    for (let j = 0; j < Math.max(1, count); j++) {
      const picture = document.createElement('img');
      picture.className = 'loot-icon';
      picture.src = icon;
      picture.alt = '';
      pocket.append(picture);
    }
    return pocket;
  });
  face.replaceChildren(...pockets);
  ui['loot-chest'].src = type ? chestArt(type) : finalCache;
  text('loot-title', type ? `${chestTiers[type].name}・${kind === 'coin' ? '倍率獎勵' : '彈藥補給'}` : '最終寶箱');
  text('loot-result', '');
  mode = 'loot';
  render();
  await pause(700);
  text('loot-result', '轉輪旋轉中…');
  const end = await spinDial(frame, face, selected, 0, 1450);
  face.style.setProperty('--upright', `${-end}deg`);
  pockets[selected].classList.add('landed');
  return prizes[selected];
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
      const prize = await spinChest('payout', null, finalWheel(bets[betIndex], spentOnAmmo, multiplier), money);
      text('loot-result', `獲得 ${money(prize.reward)}`);
      await pause(1050);
      return finish(prize);
    }
    if (!shotsLeft || countAmmo(chambers) < hitsLeft || shotsLeft < hitsLeft) return finish();
    mode = 'boss';
    render();
    return;
  }
  if (!outcome.hit) return advance(hint);
  const target = targets[stage - 1][selectedVault];
  let message;
  if (selectedVault === 'coin') {
    const { reward } = await spinChest('coin', target, coinWheel(target), multiplierText);
    multiplier = stackMultiplier(multiplier, reward);
    message = `抽中 ${multiplierText(reward)} · 累積 ${multiplierText(multiplier)}`;
  } else {
    const { reward } = await spinChest('ammo', target, supplyWheel(target), ammoText);
    const loaded = reward ? reload(reward) : 0;
    message = reward ? `抽中 ${reward} 發 · 裝入 ${loaded} 發` : '抽中空箱 · 未取得彈藥';
  }
  text('loot-result', message);
  render();
  await pause(1050);
  return advance(message);
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
  mode = 'vault';
  hint = '';
  render();
  ui['vault-coin'].focus({ preventScroll: true });
}

async function enterVault(vault) {
  if (mode !== 'vault') return;
  selectedVault = vault;
  revolverAudio.play('lock');
  if (!reducedMotion.matches) {
    mode = 'entering';
    render();
    await pause(320);
  }
  mode = 'encounter';
  hint = '';
  render();
  (ui.fire.disabled ? ui.skip : ui.fire).focus({ preventScroll: true });
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
  selectedVault = null;
  revolverAudio.play('lock');
  render();
  await pause(duration / 2);
  mode = enteringBoss ? 'boss' : 'vault';
  if (enteringBoss) {
    if (!countAmmo(chambers)) return finish();
    hint = '';
  }
  render();
  (enteringBoss ? ui.primary : ui['vault-coin']).focus({ preventScroll: true });
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
  const cost = price(bets[betIndex]);
  if (!canOfferAmmo(countAmmo(chambers)) || balance < cost) return;
  balance -= cost;
  spentOnAmmo += cost;
  reload(1);
  hint = `補彈完成 · 已扣 ${money(cost)}`;
  render();
}

function resetRound() {
  mode = 'ready';
  stage = 1;
  selectedVault = null;
  multiplier = 1;
  shotsLeft = bossShotLimit;
  hitsLeft = bossHealth;
  spentOnAmmo = 0;
  chambers = initialCylinder();
  rotation = 0;
  hint = '';
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
ui['vault-coin'].addEventListener('click', () => enterVault('coin'));
ui['vault-ammo'].addEventListener('click', () => enterVault('ammo'));
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
  if (['spinning', 'loot', 'transition', 'entering'].includes(mode)) return;
  balance = startingBalance;
  ui.menu.close();
  resetRound();
});
ui.help.addEventListener('click', () => {
  ui.menu.close();
  ui.rules.showModal();
});
render();
