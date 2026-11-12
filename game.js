const { slots, rounds, prepRounds, bossRounds, bossMaxAmmo, initialCylinder, countAmmo, loadRound,
  ammoDraw, specialDraw, finalDraw, chamberIndex } = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 140) : ms));
const money = value => '$' + value.toLocaleString('en-US');
const multiplierText = value => value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + 'X';
const baseReward = 100;
const roundLabels = ['進入封鎖區', '穿過廢墟', '找到蹤跡', '逼近巢穴', '最後備戰', 'Boss 第一階段', 'Boss 第二階段', '最終處決'];
const targetOptions = ['ammo', 'special', 'bounty'];
const targetData = {
  ammo: { name: '補給殭屍', icon: 'assets/ammo-cache.webp', art: 'assets/boss-runner.webp', hint: '命中後抽普通彈，維持彈巢穩定。' },
  special: { name: '特殊彈殭屍', icon: 'assets/cylinder-ui.webp', art: 'assets/zombie.webp', hint: '命中後取得一顆爆擊彈或冰凍彈。' },
  bounty: { name: '賞金殭屍', icon: 'assets/bounty-token.webp', art: 'assets/boss-armored.webp', hint: '命中後取得一顆賞金彈，為 Boss 戰拚獎金。' },
};

let mode = 'ready';
let round = 0;
let selected = null;
let rotation = 0;
let chambers = initialCylinder();
let options = [...targetOptions];
let pocket = { crit: 0, freeze: 0, bounty: 0 };
let bossHp = 3;
let bossClock = 3;
let bossPlan = [];
let bossCritFired = 0;
let bossFreezeFired = 0;
let bossBountyFired = 0;
let bountyBonus = 0;

const chamberCells = chambers.map((loaded, index) => {
  const cell = document.createElement('i');
  cell.dataset.index = index;
  cell.className = loaded ? 'loaded' : '';
  ui.cylinder.append(cell);
  return cell;
});

function text(id, value) {
  ui[id].textContent = value;
}

function setHint(value, tone = '') {
  text('hint', value);
  ui.hint.dataset.tone = tone;
}

function pocketTotal() {
  return pocket.crit + pocket.freeze + pocket.bounty;
}

function pocketText() {
  return '爆 ' + pocket.crit + ' · 冰 ' + pocket.freeze + ' · 賞 ' + pocket.bounty;
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - .5);
}

function chooseOptions() {
  if (round <= 2) return [...targetOptions];
  const next = shuffle(targetOptions).slice(0, 2);
  if (countAmmo(chambers) <= 2 && !next.includes('ammo')) next[0] = 'ammo';
  return next;
}

function renderProgress() {
  ui.progress.replaceChildren(...Array.from({ length: rounds }, (_, index) => {
    const cell = document.createElement('li');
    cell.textContent = index + 1;
    cell.className = index < round ? 'cleared' : index === round - 1 ? 'current' : '';
    return cell;
  }));
}

function renderCylinder() {
  text('ammo', countAmmo(chambers));
  chamberCells.forEach((cell, index) => {
    const type = chambers[index];
    cell.className = type ? 'loaded ' + (type === 'normal' ? '' : 'special-' + type) : '';
    cell.classList.remove('selected');
  });
}

function renderTargetOptions() {
  const cards = { ammo: ui['choice-ammo'], special: ui['choice-special'], bounty: ui['choice-bonus'] };
  Object.entries(cards).forEach(([type, card]) => {
    card.hidden = !options.includes(type);
    card.disabled = mode !== 'doors' || !options.includes(type);
    card.classList.toggle('selected', selected === type);
  });
}

function renderLoadout() {
  const bossMode = ['boss-load', 'boss', 'spinning', 'loot'].includes(mode) && round > prepRounds;
  ui['boss-status'].hidden = !bossMode;
  ui['boss-load'].hidden = mode !== 'boss-load';
  text('boss-hp', Math.max(0, bossHp));
  text('boss-clock', bossClock);
  text('load-crit-count', pocket.crit);
  text('load-freeze-count', pocket.freeze);
  text('load-bounty-count', pocket.bounty);
  const canLoad = countAmmo(chambers) < bossMaxAmmo || chambers.includes('normal');
  ui['load-crit'].disabled = mode !== 'boss-load' || !pocket.crit || !canLoad;
  ui['load-freeze'].disabled = mode !== 'boss-load' || !pocket.freeze || !canLoad;
  ui['load-bounty'].disabled = mode !== 'boss-load' || !pocket.bounty || !canLoad;
  ui['load-skip'].disabled = mode !== 'boss-load';
}

function render() {
  const ready = mode === 'ready';
  const result = mode === 'result';
  const doors = ['doors', 'entering'].includes(mode);
  const fight = ['fight', 'boss-load', 'boss', 'spinning', 'loot'].includes(mode);
  const play = doors || fight;
  ui.game.dataset.mode = mode;
  ui.intro.hidden = !ready;
  ui.hunt.hidden = !play;
  ui['door-select'].hidden = !doors;
  ui['fight-stage'].hidden = !fight;
  ui.result.hidden = !result;
  ui['weapon-panel'].hidden = !fight;
  ui.route.hidden = ready || result;
  text('round-number', ready ? '—' : round + ' / ' + rounds);
  text('up', pocketTotal());
  text('route-title', ready ? '進入封鎖區' : roundLabels[round - 1]);
  ui['route-dot'].style.setProperty('--progress', Math.max(0, round - 1) / (rounds - 1) * 100 + '%');
  renderProgress();
  renderCylinder();
  renderTargetOptions();
  renderLoadout();
  text('shot-state', mode === 'boss-load' ? '選擇裝填' : mode === 'boss' ? 'Boss 決鬥' : selected ? targetData[selected]?.name : '選擇目標');
  ui.fire.disabled = !['fight', 'boss'].includes(mode) || !countAmmo(chambers);
  ui.fire.querySelector('small').textContent = mode === 'boss' ? '隨機彈巢決定結果' : '選目標後開槍';
}

function reset() {
  mode = 'ready';
  round = 0;
  selected = null;
  rotation = 0;
  chambers = initialCylinder();
  options = [...targetOptions];
  pocket = { crit: 0, freeze: 0, bounty: 0 };
  bossHp = 3;
  bossClock = 3;
  bossPlan = [];
  bossCritFired = 0;
  bossFreezeFired = 0;
  bossBountyFired = 0;
  bountyBonus = 0;
  ui['enemy-stage'].dataset.state = '';
  ui['door-select'].dataset.state = '';
  ui.loot.hidden = true;
  setHint('先選目標，再轉彈巢。');
  render();
}

function start() {
  revolverAudio.unlock();
  revolverAudio.startMusic();
  mode = 'doors';
  round = 1;
  selected = null;
  chambers = initialCylinder();
  options = [...targetOptions];
  pocket = { crit: 0, freeze: 0, bounty: 0 };
  setHint('前期目標：維持普通彈，收集 Boss 特殊彈。');
  render();
}

async function selectChoice(choice) {
  if (mode !== 'doors' || !options.includes(choice)) return;
  selected = choice;
  const target = targetData[choice];
  ui['enemy-stage'].dataset.target = choice;
  ui['door-select'].dataset.state = 'opening';
  setHint(target.hint);
  mode = 'entering';
  render();
  await pause(550);
  ui['enemy-art'].src = target.art;
  ui['enemy-art'].alt = target.name;
  ui['target-icon'].src = target.icon;
  text('target-name', target.name);
  mode = 'fight';
  ui['door-select'].dataset.state = '';
  setHint('目標出現。轉動彈巢，準備開槍。');
  render();
}

function enterBoss() {
  while (countAmmo(chambers) > bossMaxAmmo) {
    const index = chambers.findIndex(type => type === 'normal');
    chambers[index < 0 ? chambers.findIndex(Boolean) : index] = null;
  }
  selected = 'boss';
  mode = 'boss-load';
  bossHp = 3;
  bossClock = 3;
  bossPlan = [];
  bossCritFired = 0;
  bossFreezeFired = 0;
  bossBountyFired = 0;
  ui['enemy-stage'].dataset.target = 'boss';
  ui['enemy-art'].src = 'assets/boss.webp';
  ui['enemy-art'].alt = 'Boss 殭屍';
  ui['target-icon'].src = 'assets/final-cache.webp';
  text('target-name', 'BOSS 決鬥');
  setHint('Boss 出現。最多裝填 5 顆，選擇要帶入的特殊彈。');
  render();
}

function loadSpecial(type) {
  if (mode !== 'boss-load' || !pocket[type]) return;
  let loaded = false;
  if (countAmmo(chambers) < bossMaxAmmo) loaded = loadRound(chambers, type, bossMaxAmmo);
  else {
    const index = chambers.findIndex(value => value === 'normal');
    if (index >= 0) {
      chambers[index] = type;
      loaded = true;
    }
  }
  if (!loaded) return;
  pocket[type]--;
  bossPlan.push(type);
  mode = 'boss';
  setHint('已裝填 ' + ({ crit: '爆擊彈', freeze: '冰凍彈', bounty: '賞金彈' }[type]) + '。準備開槍。');
  render();
}

function skipLoad() {
  if (mode !== 'boss-load') return;
  mode = 'boss';
  setHint('不再裝填。轉動彈巢，準備開槍。');
  render();
}

function spinDial(selectedIndex, duration = 900) {
  const step = 360 / slots;
  const startRotation = rotation;
  const endRotation = startRotation + 1080 + (720 - selectedIndex * step - startRotation % 360) % 360;
  const animation = ui.cylinder.animate([
    { transform: 'rotate(' + startRotation + 'deg)' },
    { transform: 'rotate(' + endRotation + 'deg)' },
  ], { duration: reducedMotion.matches ? 0 : duration, easing: 'cubic-bezier(.17,.62,.24,1)' });
  let lastTick = Math.floor(startRotation / step);
  const tick = () => {
    const progress = animation.effect ? animation.effect.getComputedTiming().progress || 1 : 1;
    const crossed = Math.floor((startRotation + (endRotation - startRotation) * progress) / step);
    if (crossed !== lastTick) {
      revolverAudio.play('tick');
      lastTick = crossed;
    }
    if (progress < 1) requestAnimationFrame(tick);
  };
  if (!reducedMotion.matches) requestAnimationFrame(tick);
  return animation.finished.then(() => {
    rotation = endRotation;
    ui.cylinder.style.transform = 'rotate(' + rotation + 'deg)';
    revolverAudio.play('lock');
  });
}

function buildWheel(kind) {
  const values = kind === 'ammo' ? [0, 1, 2] : kind === 'special' ? ['爆擊', '冰凍'] : kind === 'bounty' ? ['賞金彈'] : finalDraw.map(({ multiplier }) => multiplier);
  ui['loot-disc'].replaceChildren(...values.map((value, index) => {
    const pocket = document.createElement('span');
    pocket.className = 'wheel-pocket';
    pocket.style.setProperty('--angle', index * (360 / values.length) + 'deg');
    pocket.innerHTML = kind === 'ammo'
      ? (value ? '<img src="assets/cartridge.png" alt=""><b>+' + value + '</b>' : '<b>0</b>')
      : '<b>' + (typeof value === 'number' ? value + 'X' : value) + '</b>';
    return pocket;
  }));
}

function pickWeighted(list) {
  let remaining = Math.random() * list.reduce((sum, item) => sum + item.weight, 0);
  return list.findIndex(item => (remaining -= item.weight) < 0);
}

async function spinReward(kind) {
  const lists = { ammo: ammoDraw, special: specialDraw, bounty: [{ value: 'bounty', weight: 1 }], final: finalDraw };
  const list = lists[kind];
  const index = pickWeighted(list);
  const item = list[index];
  const value = kind === 'ammo' ? item.value : kind === 'special' ? item.type : kind === 'bounty' ? 'bounty' : item.multiplier;
  buildWheel(kind);
  ui['loot-core'].src = kind === 'ammo' ? 'assets/ammo-cache.webp' : 'assets/bounty-token.webp';
  text('loot-kicker', kind === 'final' ? '最終獎金抽選' : '戰利品抽選');
  text('loot-title', kind === 'ammo' ? '轉出普通彈' : kind === 'special' ? '取得特殊彈' : kind === 'bounty' ? '取得賞金彈' : '最後一槍，抽出倍率');
  text('loot-result', '抽選中…');
  ui.loot.hidden = false;
  mode = 'loot';
  render();
  await pause(260);
  const count = kind === 'ammo' ? 3 : kind === 'special' ? 2 : kind === 'bounty' ? 1 : finalDraw.length;
  const step = 360 / count;
  const end = 1440 + (360 - index * step);
  const animation = ui['loot-disc'].animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + end + 'deg)' }], { duration: reducedMotion.matches ? 0 : 1100, easing: 'cubic-bezier(.17,.62,.24,1)' });
  await animation.finished;
  ui['loot-disc'].style.transform = 'rotate(' + end + 'deg)';
  text('loot-result', kind === 'ammo' ? '補充 ' + value + ' 發' : kind === 'special' ? '取得 ' + (value === 'crit' ? '爆擊彈' : '冰凍彈') : kind === 'bounty' ? '取得 賞金彈' : '抽到 ' + multiplierText(value));
  revolverAudio.play('lock');
  await pause(650);
  ui.loot.hidden = true;
  return value;
}

function comboCounts() {
  return {
    crit: bossPlan.filter(type => type === 'crit').length,
    freeze: bossPlan.filter(type => type === 'freeze').length,
    bounty: bossPlan.filter(type => type === 'bounty').length,
  };
}

async function fire() {
  if (!['fight', 'boss'].includes(mode) || !countAmmo(chambers)) return;
  const isBoss = mode === 'boss';
  const choice = selected;
  const chamber = chamberIndex();
  const type = chambers[chamber];
  mode = 'spinning';
  ui['enemy-stage'].dataset.state = 'aim';
  text('shot-state', '彈巢旋轉中');
  render();
  await spinDial(chamber);
  chamberCells[chamber].classList.add('selected');
  await pause(130);
  chambers[chamber] = null;
  if (!type) {
    revolverAudio.play('empty');
    ui['enemy-stage'].dataset.state = 'miss';
    setHint(isBoss ? '空炮。Boss 發動攻擊。' : '空炮。追獵中止。', 'loss');
    await pause(700);
    finish(false, 0, 0, isBoss ? 'Boss 攻擊' : '空炮');
    return;
  }
  revolverAudio.play('fire');
  ui['enemy-stage'].dataset.state = 'hit';
  if (!isBoss) {
    setHint('命中。目標倒下。', 'success');
    await pause(500);
    if (choice === 'ammo') {
      const gained = await spinReward('ammo');
      for (let i = 0; i < gained; i++) loadRound(chambers, 'normal');
    } else if (choice === 'special') {
      pocket[await spinReward('special')]++;
    } else {
      pocket[await spinReward('bounty')]++;
    }
    round++;
    selected = null;
    if (round > prepRounds) enterBoss();
    else {
      options = chooseOptions();
      mode = 'doors';
      setHint('下一回合：補普通彈，還是收集特殊彈？');
      render();
    }
    return;
  }
  const counts = comboCounts();
  let damage = type === 'crit' ? 2 : 1;
  let reward = 0;
  if (type === 'crit' && counts.crit >= 2 && bossCritFired > 0) damage++;
  if (type === 'freeze') {
    bossClock = Math.min(5, bossClock + (counts.freeze >= 2 && bossFreezeFired > 0 ? 2 : 1));
    bossFreezeFired++;
  }
  if (type === 'bounty') {
    reward = .2 + (counts.bounty >= 2 && bossBountyFired > 0 ? .2 : 0) + (counts.bounty >= 3 && bossBountyFired > 1 ? .4 : 0);
    bountyBonus = Number((bountyBonus + reward).toFixed(1));
    bossBountyFired++;
  }
  if (type === 'crit') bossCritFired++;
  bossHp = Math.max(0, bossHp - damage);
  bossClock--;
  setHint(type === 'crit' ? '爆擊命中，造成 ' + damage + ' 點傷害。' : type === 'freeze' ? '冰凍命中，Boss 攻擊延後。' : type === 'bounty' ? '賞金命中，路線加成 +' + reward.toFixed(1) + 'X。' : '普通彈命中，造成 1 點傷害。', 'success');
  await pause(650);
  if (bossHp <= 0) {
    const finalMultiplier = await spinReward('final');
    finish(true, finalMultiplier * (1 + bountyBonus), finalMultiplier, 'Boss 擊殺');
    return;
  }
  if (bossClock <= 0) {
    finish(false, 0, 0, 'Boss 攻擊');
    return;
  }
  mode = 'boss-load';
  setHint('Boss 尚有 ' + bossHp + ' HP。開槍前決定是否裝填。');
  render();
}

function finish(win, totalMultiplier = 0, finalMultiplier = 0, reason = '空炮') {
  mode = 'result';
  ui.loot.hidden = true;
  ui['enemy-stage'].dataset.state = win ? 'clear' : 'miss';
  text('result-kicker', win ? '追獵完成' : '追獵中止');
  text('result-title', win ? '總倍率 ' + multiplierText(totalMultiplier) : reason);
  text('result-payout', win ? money(Math.round(baseReward * totalMultiplier)) : '$0');
  text('result-detail', win ? '最終倍率 ' + multiplierText(finalMultiplier) + ' × 路線加成 ' + (1 + bountyBonus).toFixed(1) + 'X' : '完成準備回合 ' + Math.min(prepRounds, Math.max(0, round - 1)) + ' 回合 · 口袋 ' + pocketText());
  setHint(win ? '獎金已結算。' : '再試一次。', win ? 'success' : 'loss');
  render();
}

ui.start.addEventListener('click', start);
ui.restart.addEventListener('click', reset);
ui['choice-ammo'].addEventListener('click', () => selectChoice('ammo'));
ui['choice-special'].addEventListener('click', () => selectChoice('special'));
ui['choice-bonus'].addEventListener('click', () => selectChoice('bounty'));
ui['load-crit'].addEventListener('click', () => loadSpecial('crit'));
ui['load-freeze'].addEventListener('click', () => loadSpecial('freeze'));
ui['load-bounty'].addEventListener('click', () => loadSpecial('bounty'));
ui['load-skip'].addEventListener('click', skipLoad);
ui.fire.addEventListener('click', fire);

reset();
