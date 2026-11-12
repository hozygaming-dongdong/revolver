const {
  slots, finalStage, bossShotLimit, bossHealth, initialCylinder, countAmmo, ammoPurchaseCount, loadAmmo,
  chamberIndex, shoot, price, encounters, chestTiers, coinMultipliers, maxBaseMultiplier,
  supplyWheel, coinWheel, stackMultiplier, finalWheel, weightedIndex,
  drawBossPair, advanceBossPair, shootBarrel,
} = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const text = (id, value) => { ui[id].textContent = value; };
const money = cents => '$' + (cents / 100).toLocaleString('zh-TW', {
  minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
});
const signed = value => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mixedBossTrial = new URLSearchParams(location.search).get('boss') === 'barrel';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = ms => pause(reducedMotion.matches ? Math.min(ms, 140) : ms);
const bets = [10_000, 20_000, 50_000, 100_000, 200_000];
const startingBalance = 1_000_000;
const chestArt = type => `assets/chest-${type}.png`;
const finalCache = 'assets/final-cache.webp';
const cashIcons = [0, 0, 1, 2, 2, 3];
const multiplierText = multiplier => `${multiplier.toLocaleString('zh-TW', { maximumFractionDigits: 5 })}×`;
const ammoText = ammo => ammo ? `${ammo} 發` : '空箱';
const vaultNames = { coin: '金幣庫', ammo: '軍械庫' };
const bossIntros = {
  single: ['單首領', '四槍內命中三次'],
  twins: ['雙首領', '點角色開槍，命中可擊退'],
  oil: ['油桶首領', '射油桶時，實彈有 50% 機率引爆'],
};

let mode = 'ready';
let balance = startingBalance;
let betIndex = 0;
let stage = 1;
let targets = [];
let selectedVault = null;
let multiplier = 1;
let shotsLeft = bossShotLimit;
let hitsLeft = bossHealth;
let bossPair = null;
let barrelBoss = false;
let barrelState = 'available';
let spentOnAmmo = 0;
let chambers = initialCylinder();
let rotation = 0;
let hint = '';
let bossRevealTimer;

const stageCells = Array.from({ length: finalStage }, (_, i) => {
  const cell = document.createElement('li');
  cell.textContent = i + 1 === finalStage ? '首領' : `第 ${i + 1} 關`;
  ui.ladder.append(cell);
  return cell;
});
const bossStageLabel = stageCells[finalStage - 1].firstChild;
const bossStageThumb = document.createElement('span');
bossStageThumb.className = 'boss-stage-thumb';
bossStageThumb.setAttribute('aria-hidden', 'true');
bossStageLabel.before(bossStageThumb);
const twinTargets = [...ui['twin-bosses'].querySelectorAll('button')];
const twinArt = twinTargets.map(button => button.querySelector('img'));
const chamberCells = chambers.map((_, i) => {
  const cell = document.createElement('i');
  cell.style.setProperty('--angle', `${i * 60}deg`);
  ui.cylinder.append(cell);
  return cell;
});
const healthBar = ui['boss-health'];
const healthCells = Array.from({ length: bossHealth }, () => document.createElement('i'));
healthBar.append(...healthCells);
healthBar.setAttribute('aria-valuemax', bossHealth);
text('intro-cap', multiplierText(maxBaseMultiplier));
if (mixedBossTrial) {
  ui['barrel-prop'].src = 'assets/barrel-cover.webp';
  ui['reveal-barrel'].src = ui['barrel-prop'].src;
  ui['barrel-rules'].hidden = false;
  text('boss-draw-rules', '開局抽出單首領（48%）、雙首領（32%）或油桶首領（20%）。首領戰最多開 4 槍，入場至少要有 3 發彈藥。');
}

function renderBossPair(visible) {
  ui['twin-bosses'].hidden = !visible;
  if (!visible) return;
  const attacker = mode === 'boss-attack' && bossPair.reduce((closest, boss) =>
    boss.health && (!closest || boss.distance < closest.distance) ? boss : closest, null);
  twinTargets.forEach((button, i) => {
    const boss = bossPair[i];
    const danger = boss.health > 0 && boss.distance === 1 && mode !== 'boss-attack';
    button.disabled = mode !== 'boss' || !boss.health;
    button.toggleAttribute('data-danger', danger);
    button.toggleAttribute('data-defeated', !boss.health);
    button.toggleAttribute('data-lunge', boss === attacker);
    button.style.setProperty('--twin-step', 3 - boss.distance);
    button.querySelector('.twin-warning').hidden = !danger;
    button.querySelectorAll('.boss-health i').forEach((cell, index) => cell.classList.toggle('remaining', index < boss.health));
    button.setAttribute('aria-label', boss.health
      ? `射擊${button.dataset.name}，剩 ${boss.health} 格血${danger ? '，下一步撲擊' : ''}`
      : `${button.dataset.name}已擊倒`);
  });
}

function renderOilBoss(visible) {
  ui['oil-scene'].hidden = !visible;
  if (!visible) return;
  const boss = ui['oil-boss-target'];
  boss.disabled = mode !== 'boss' || !hitsLeft;
  boss.toggleAttribute('data-defeated', hitsLeft === 0);
  boss.toggleAttribute('data-lunge', mode === 'boss-attack');
  boss.style.setProperty('--twin-step', bossShotLimit - shotsLeft - Number(hitsLeft === 0));
  boss.setAttribute('aria-label', `射擊油桶首領，剩 ${hitsLeft} 格血`);
  ui['barrel-cover'].dataset.state = barrelState;
  ui['barrel-target'].hidden = barrelState !== 'available';
  ui['barrel-target'].disabled = mode !== 'boss';
}

function render() {
  const bet = bets[betIndex];
  const ammo = countAmmo(chambers);
  const ready = mode === 'ready';
  const revealing = mode === 'boss-reveal';
  const finished = mode === 'result';
  const spinning = mode === 'spinning';
  const looting = mode === 'loot';
  const transitioning = mode === 'transition';
  const opening = mode === 'entering';
  const attacking = mode === 'boss-attack';
  const bossSupply = mode === 'boss-supply';
  const bossReload = mode === 'boss-reload';
  const busy = revealing || spinning || looting || transitioning || opening || attacking || bossReload;
  const playing = !ready && !finished;
  const atBoss = stage === finalStage;
  const selecting = mode === 'vault';
  const choosing = selecting || opening || (transitioning && !atBoss && !selectedVault);
  const fighting = playing && !choosing && !revealing;
  const showTwins = fighting && atBoss && Boolean(bossPair);
  const showOil = fighting && atBoss && barrelBoss;
  const bossKind = barrelBoss ? 'oil' : bossPair ? 'twins' : 'single';
  const [bossName, bossRule] = bossIntros[bossKind];
  const showBossProgress = fighting && atBoss && !transitioning && !bossSupply && !bossReload;
  const inVault = fighting && !atBoss && Boolean(selectedVault);
  const target = inVault ? targets[stage - 1][selectedVault] : null;
  const needsReset = ready && balance < bets[0];
  const purchaseCount = ammoPurchaseCount(ammo, opening ? 'vault' : mode);
  const cost = price(bet) * purchaseCount;
  const ammoShortage = bossHealth - ammo;
  ui.game.dataset.mode = mode;
  ui.arena.dataset.scene = ready ? 'intro' : revealing ? 'reveal' : finished ? 'settlement' : choosing ? 'vault' : 'fight';
  ui.arena.dataset.target = fighting && atBoss ? (showTwins ? 'twins' : showOil ? 'oil' : 'boss') : target ?? '';
  ui.arena.dataset.vault = inVault ? selectedVault : '';
  ui.arena.toggleAttribute('data-boss-danger', fighting && atBoss && !attacking && shotsLeft === 1
    && (hitsLeft === 1 || (showOil && barrelState === 'available' && hitsLeft > 0)));
  ui['boss-enemy'].style.setProperty('--boss-steps', bossShotLimit - shotsLeft - Number(hitsLeft === 0));
  ui.enemy.hidden = !fighting || atBoss;
  ui['boss-enemy'].hidden = !fighting || !atBoss || showTwins || showOil;
  renderBossPair(showTwins);
  renderOilBoss(showOil);
  ui.weapon.hidden = !fighting;
  ui.intro.hidden = !ready;
  ui['boss-reveal'].hidden = !revealing;
  if (revealing) {
    ui['boss-reveal'].dataset.kind = bossKind;
    text('boss-reveal-name', bossName);
    text('boss-reveal-rule', bossRule);
  }
  ui.vaults.hidden = !choosing;
  ui.decisions.hidden = !inVault || transitioning;
  ui.settlement.hidden = !finished;
  ui.loot.hidden = !looting;
  ui['stage-transition'].hidden = !transitioning;
  ui.primary.hidden = playing && (!atBoss || ((showTwins || showOil) && !bossSupply && !bossReload));
  ui.primary.disabled = busy || needsReset || (bossSupply && balance < cost);
  ui['forfeit-boss'].hidden = !bossSupply && !bossReload;
  ui['forfeit-boss'].disabled = busy;
  ui.skip.disabled = busy;
  ui.fire.disabled = busy || ammo === 0;
  ui.buy.hidden = bossSupply || purchaseCount === 0;
  ui.buy.disabled = busy || balance < cost;
  ui['open-menu'].disabled = busy;
  ui['reset-assets'].disabled = busy;
  ui['bet-down'].disabled = !ready || betIndex === 0;
  ui['bet-up'].disabled = !ready || betIndex === bets.length - 1;
  text('primary-text', ready ? (balance < bet && !needsReset ? '切換最低押注' : '開始遊戲')
    : finished ? '再玩一輪'
    : bossSupply ? `補 ${purchaseCount} 發 · ${money(cost)}`
    : bossReload ? '補彈中'
    : spinning ? '射擊中' : 'FIRE');
  text('balance', money(balance));
  text('bet', money(bet));
  text('ammo', `${ammo} / ${slots}`);
  ui['boss-ammo'].hidden = !playing || (atBoss && !bossSupply) || ammoShortage <= 0;
  text('boss-ammo', ammoShortage > 0 ? `首領戰缺 ${ammoShortage} 發` : '');
  text('hint', needsReset ? '餘額不足，請從選單重設資產'
    : ready && balance < bet ? `目前押注 ${money(bet)}，餘額不足`
    : bossSupply && balance < cost ? '餘額不足，無法補齊彈藥'
    : showTwins && mode === 'boss' && shotsLeft === bossShotLimit ? '點首領開槍，命中擊退一步'
    : showOil && mode === 'boss' && shotsLeft === bossShotLimit ? '點首領或油桶開槍，引爆可一擊通關'
    : hint);
  const resetAmount = money(startingBalance);
  text('reset-note', busy ? '等待演出結束' : playing ? `結束本輪 · ${resetAmount}` : resetAmount);
  text('gate-number', String(stage).padStart(2, '0'));
  ui['stage-status'].hidden = !fighting || transitioning;
  ui['run-bonus'].hidden = !playing;
  text('run-multiplier', multiplierText(multiplier));
  text('jackpot-banner', `WIN UP TO ${multiplierText(maxBaseMultiplier * multiplier)}`);
  ui['encounter-detail'].hidden = atBoss;
  ui['boss-progress'].hidden = !showBossProgress;
  healthBar.hidden = showBossProgress && showTwins;
  bossStageLabel.textContent = ready ? '首領' : bossName;
  bossStageThumb.hidden = ready;
  bossStageThumb.dataset.kind = bossKind;
  ui['boss-draw'].hidden = !choosing || stage !== 1;
  text('boss-draw', `本輪首領 · ${bossName}`);
  const healthParent = showBossProgress ? ui['boss-progress'] : stageCells[finalStage - 1];
  if (healthBar.parentElement !== healthParent) {
    if (showBossProgress) healthParent.prepend(healthBar);
    else healthParent.append(healthBar);
  }
  healthBar.setAttribute('aria-valuenow', hitsLeft);
  healthCells.forEach((cell, i) => cell.classList.toggle('remaining', i < hitsLeft));
  text('boss-shots-left', shotsLeft);
  if (choosing) {
    for (const vault of ['coin', 'ammo']) {
      const door = ui[`vault-${vault}`];
      const tier = targets[stage - 1][vault];
      door.disabled = !selecting;
      door.dataset.tier = tier;
      door.toggleAttribute('data-opening', opening && selectedVault === vault);
      text(`vault-${vault}-tier`, chestTiers[tier].name.replace('箱', '級'));
    }
  } else if (fighting && !transitioning) {
    if (atBoss) {
      text('stage-plate', bossSupply || bossReload ? '首領門前' : showTwins || showOil ? bossName : '封鎖區首領');
    } else if (target) {
      const chest = chestTiers[target];
      const format = selectedVault === 'coin' ? i => multiplierText(coinMultipliers[i]) : ammoText;
      text('stage-plate', `${vaultNames[selectedVault]}守衛`);
      text('encounter-reward', `擊倒守衛可開${chest.name}`);
      text('encounter-odds', chest[selectedVault].flatMap((odds, i) => odds ? [`${format(i)} ${odds}%`] : []).join(' · '));
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

function focusBoss(preferred = 0) {
  const control = bossPair
    ? (twinTargets[preferred].disabled ? twinTargets[1 - preferred] : twinTargets[preferred])
    : barrelBoss ? ui['oil-boss-target'] : ui.primary;
  control.focus({ preventScroll: true });
}

function finish(prize = null, reason = '') {
  const bet = bets[betIndex];
  const cleared = Boolean(prize);
  const reward = prize?.reward ?? 0;
  balance += reward;
  mode = 'result';
  ui.game.dataset.outcome = cleared ? 'clear' : 'miss';
  const jackpot = prize?.baseMultiplier === maxBaseMultiplier;
  text('result-title', jackpot ? `${multiplierText(maxBaseMultiplier * multiplier)} 大獎` : cleared ? '首領已擊倒' : '任務失敗');
  ui['result-cache'].hidden = !cleared;
  ui['result-amount'].hidden = !cleared;
  text('result-payout', signed(reward));
  text('result-net', signed(reward - bet - spentOnAmmo));
  ui['result-breakdown'].hidden = !cleared || multiplier === 1;
  if (cleared) text('result-breakdown', `${money(prize.baseReward)} × ${multiplierText(multiplier).slice(0, -1)}`);
  hint = reason;
  render();
  if (cleared) revolverAudio.play('clear');
}

async function bossAttack(reason) {
  mode = 'boss-attack';
  hint = '首領撲向你';
  render();
  revolverAudio.play('bossAttack');
  await pause(reducedMotion.matches ? 360 : 520);
  finish(null, reason);
  ui.primary.focus({ preventScroll: true });
}

function animateShot(enemyArt, aimHeight = .07) {
  const gun = document.querySelector('.shooter').getBoundingClientRect();
  const enemy = enemyArt.getBoundingClientRect();
  const arena = ui.arena.getBoundingClientRect();
  const start = [gun.left + gun.width * .965 - arena.left, gun.top + gun.height * .182 - arena.top];
  const end = [enemy.left + enemy.width * .48 - arena.left, enemy.top + enemy.height * aimHeight - arena.top];
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
  const pockets = prizes.map(({ reward, tier, baseMultiplier }, i) => {
    const pocket = document.createElement('div');
    const angle = i * 2 * Math.PI / slots;
    const count = kind === 'ammo' ? reward : 1;
    const isPayout = kind === 'payout';
    const icon = kind === 'ammo' ? (reward ? 'assets/cartridge.png' : 'assets/reward-empty.webp')
      : isPayout ? `assets/reward-cash-${cashIcons[tier]}.webp` : `assets/reward-coin-${tier}.webp`;
    pocket.className = 'loot-pocket';
    pocket.dataset.count = String(count);
    pocket.classList.toggle('jackpot', isPayout && baseMultiplier === maxBaseMultiplier);
    pocket.setAttribute('role', 'img');
    pocket.setAttribute('aria-label', isPayout ? `${multiplierText(baseMultiplier)}，${formatReward(reward)}` : formatReward(reward));
    pocket.style.setProperty('--x', `${50 + 33 * Math.sin(angle)}%`);
    pocket.style.setProperty('--y', `${50 - 33 * Math.cos(angle)}%`);
    for (let j = 0; j < Math.max(1, count); j++) {
      const picture = document.createElement('img');
      picture.className = 'loot-icon';
      picture.src = icon;
      picture.alt = '';
      pocket.append(picture);
    }
    if (isPayout) {
      const label = document.createElement('span');
      label.className = 'loot-multiplier';
      label.textContent = multiplierText(baseMultiplier);
      pocket.append(label);
    }
    return pocket;
  });
  face.replaceChildren(...pockets);
  ui['loot-chest'].src = type ? chestArt(type) : finalCache;
  text('loot-title', type ? `${chestTiers[type].name}・${kind === 'coin' ? '倍率獎勵' : '彈藥補給'}` : '最終寶箱');
  text('loot-result', '');
  ui.loot.toggleAttribute('data-revealing', Boolean(type));
  mode = 'loot';
  render();
  await pause(700);
  ui.loot.removeAttribute('data-revealing');
  text('loot-result', '轉輪旋轉中…');
  const end = await spinDial(frame, face, selected, 0, 1450);
  face.style.setProperty('--upright', `${-end}deg`);
  pockets[selected].classList.add('landed');
  return prizes[selected];
}

async function fire(aim) {
  if (!['encounter', 'boss'].includes(mode) || !countAmmo(chambers)) return;
  const atBoss = mode === 'boss';
  const atTwins = atBoss && Boolean(bossPair);
  const atOil = atBoss && barrelBoss;
  const aimingBarrel = atOil && aim === 'barrel';
  if (atTwins && !bossPair[aim]?.health) return;
  if (atOil && aim !== 'body' && !(aimingBarrel && barrelState === 'available')) return;
  const aimedTarget = atTwins ? twinTargets[aim] : aimingBarrel ? ui['barrel-target'] : atOil ? ui['oil-boss-target'] : null;
  const enemyArt = atTwins ? twinArt[aim] : atOil ? ui['oil-boss-art'] : atBoss ? ui['boss-enemy'] : ui.enemy;
  aimedTarget?.setAttribute('data-aimed', '');
  revolverAudio.unlock();
  mode = 'spinning';
  const selected = chamberIndex();
  const outcome = shoot(chambers, selected);
  const barrelOutcome = aimingBarrel && outcome.hit ? shootBarrel() : null;
  const wallHit = barrelOutcome === 'blocked';
  const exploded = barrelOutcome === 'exploded';
  const lethal = exploded || (outcome.hit && !wallHit && (!atBoss || (atTwins ? bossPair[aim].health === 1 : hitsLeft === 1)));
  hint = '彈巢旋轉中…';
  render();
  rotation = await spinDial(ui.weapon, ui.cylinder, selected, rotation, 850);
  chamberCells[selected].classList.add('selected');
  await wait(85);
  if (outcome.hit) {
    if (aimingBarrel) animateShot(wallHit ? ui['barrel-prop'] : aimedTarget, .5);
    else animateShot(enemyArt, atTwins || atOil ? .16 : .07);
  }
  ui.arena.dataset.shot = lethal ? 'kill' : wallHit ? 'wall' : outcome.hit ? 'hit' : 'miss';
  revolverAudio.play(outcome.hit ? 'fire' : 'empty');
  if (barrelOutcome) {
    barrelState = barrelOutcome;
    revolverAudio.play(exploded ? 'blast' : 'rubble');
  }
  hint = exploded ? '油桶引爆 · 首領擊倒'
    : wallHit ? '實彈打中矮牆 · 碎石蓋住油桶'
    : lethal ? '命中 · 目標擊倒'
    : outcome.hit ? '命中首領' : '空槍 · 彈藥保留';
  if (atBoss) {
    shotsLeft--;
    if (exploded) hitsLeft = 0;
    else if (outcome.hit && !wallHit) hitsLeft--;
    if (atTwins) {
      aimedTarget.toggleAttribute('data-struck', outcome.hit && !lethal);
      bossPair = advanceBossPair(bossPair, aim, outcome.hit);
    }
  }
  render();
  await wait(620);
  chambers = outcome.chambers;
  chamberCells[selected].classList.remove('selected');
  delete ui.weapon.dataset.spin;
  aimedTarget?.removeAttribute('data-aimed');
  aimedTarget?.removeAttribute('data-struck');
  if (atBoss) {
    if (hitsLeft === 0) {
      const prize = await spinChest('payout', null, finalWheel(bets[betIndex], spentOnAmmo, multiplier), money);
      text('loot-result', `獲得 ${money(prize.reward)}`);
      await pause(1050);
      delete ui.arena.dataset.shot;
      return finish(prize);
    }
    delete ui.arena.dataset.shot;
    if (atTwins && bossPair.some(boss => boss.health && boss.distance === 0)) return bossAttack('首領已逼到面前');
    const ammo = countAmmo(chambers);
    const barrelCanFinish = atOil && barrelState === 'available' && shotsLeft > 0 && ammo > 0;
    if (!barrelCanFinish && shotsLeft < hitsLeft) return bossAttack('剩餘開槍次數不足以擊倒首領');
    if (!barrelCanFinish && ammo < hitsLeft) return bossAttack('彈藥不足以擊倒首領');
    mode = 'boss';
    render();
    if (atTwins || atOil) focusBoss(aim);
    return;
  }
  if (!outcome.hit) {
    delete ui.arena.dataset.shot;
    return advance(hint);
  }
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
  delete ui.arena.dataset.shot;
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
  barrelBoss = mixedBossTrial && weightedIndex([1, 4]) === 0;
  bossPair = barrelBoss ? null : drawBossPair();
  mode = 'boss-reveal';
  hint = '';
  render();
  bossRevealTimer = setTimeout(enterFirstVault, 1500);
  ui['boss-reveal-continue'].focus({ preventScroll: true });
}

function enterFirstVault() {
  if (mode !== 'boss-reveal') return;
  clearTimeout(bossRevealTimer);
  mode = 'vault';
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
  const bossTitle = barrelBoss ? '油桶首領' : bossPair ? '雙首領' : '首領';
  text('transition-title', `第 ${stage} 關 → 第 ${nextStage} 關${enteringBoss ? `・${bossTitle}` : ''}`);
  ui['transition-boss'].hidden = !enteringBoss;
  text('transition-boss', `${bossShotLimit} 次開槍機會・${barrelBoss ? '引爆油桶可一擊通關' : `需命中 ${bossHealth} 次`}`);
  mode = 'transition';
  hint = message;
  render();
  await pause(duration / 2);
  stage = nextStage;
  selectedVault = null;
  revolverAudio.play('lock');
  render();
  await pause(duration / 2);
  mode = enteringBoss ? (countAmmo(chambers) < bossHealth ? 'boss-supply' : 'boss') : 'vault';
  if (enteringBoss) hint = '';
  render();
  if (mode === 'boss') focusBoss();
  else {
    const nextControl = enteringBoss ? ui.primary : ui['vault-coin'];
    (nextControl.disabled ? ui['forfeit-boss'] : nextControl).focus({ preventScroll: true });
  }
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

async function buyAmmo() {
  const amount = ammoPurchaseCount(countAmmo(chambers), mode);
  const cost = price(bets[betIndex]) * amount;
  if (!amount || balance < cost) return;
  balance -= cost;
  spentOnAmmo += cost;
  reload(amount);
  hint = `補彈完成 · 已扣 ${money(cost)}`;
  if (mode === 'boss-supply') {
    mode = 'boss-reload';
    render();
    await wait(300);
    mode = 'boss';
    render();
    focusBoss();
    return;
  }
  render();
}

function resetRound() {
  mode = 'ready';
  stage = 1;
  selectedVault = null;
  multiplier = 1;
  shotsLeft = bossShotLimit;
  hitsLeft = bossHealth;
  bossPair = null;
  barrelBoss = false;
  barrelState = 'available';
  spentOnAmmo = 0;
  chambers = initialCylinder();
  rotation = 0;
  hint = '';
  delete ui.game.dataset.outcome;
  render();
}

ui.primary.addEventListener('click', () => {
  if (mode === 'ready') start();
  else if (mode === 'boss-supply') buyAmmo();
  else if (mode === 'boss') fire();
  else if (mode === 'result') resetRound();
});
ui['boss-reveal-continue'].addEventListener('click', enterFirstVault);
ui['forfeit-boss'].addEventListener('click', () => {
  if (mode === 'boss-supply') bossAttack('已放棄首領挑戰');
});
for (const [id, step] of [['bet-down', -1], ['bet-up', 1]]) {
  ui[id].addEventListener('click', () => { betIndex += step; render(); });
}
ui.skip.addEventListener('click', () => { if (mode === 'encounter') advance('已繞過 · 彈藥保留'); });
ui['vault-coin'].addEventListener('click', () => enterVault('coin'));
ui['vault-ammo'].addEventListener('click', () => enterVault('ammo'));
ui.fire.addEventListener('click', () => fire());
twinTargets.forEach((button, index) => button.addEventListener('click', () => fire(index)));
ui['barrel-target'].addEventListener('click', () => fire('barrel'));
ui['oil-boss-target'].addEventListener('click', () => fire('body'));
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
  if (ui['reset-assets'].disabled) return;
  balance = startingBalance;
  ui.menu.close();
  resetRound();
});
ui.help.addEventListener('click', () => {
  ui.menu.close();
  ui.rules.showModal();
});
render();
