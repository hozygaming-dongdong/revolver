const { slots, rounds, prepRounds, startAmmo, initialCylinder, countAmmo, loadAmmo,
  ammoDraw, finalDraw, chamberIndex } = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 140) : ms));
const money = value => '$' + value.toLocaleString('en-US');
const multiplierText = value => value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + 'X';
const baseReward = 100;
const roundLabels = ['進入封鎖區', '穿過廢墟', '找到蹤跡', '逼近巢穴', '最後備戰', '生死段一', '生死段二', '最終決鬥'];
const finalLabels = [1.2, 1.5, 2, 3, 10];

let mode = 'ready';
let round = 0;
let up = 0;
let selected = null;
let rotation = 0;
let chambers = initialCylinder();

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
    cell.classList.toggle('loaded', chambers[index]);
    cell.classList.remove('selected');
  });
}

function render() {
  const ready = mode === 'ready';
  const result = mode === 'result';
  const play = ['play', 'spinning', 'loot'].includes(mode);
  ui.game.dataset.mode = mode;
  ui.intro.hidden = !ready;
  ui.hunt.hidden = !play;
  ui.result.hidden = !result;
  ui['weapon-panel'].hidden = !play;
  ui.route.hidden = ready || result;
  text('round-number', ready ? '—' : round + ' / ' + rounds);
  text('up', up);
  text('route-title', ready ? '進入封鎖區' : roundLabels[round - 1]);
  ui['route-dot'].style.setProperty('--progress', Math.max(0, round - 1) / (rounds - 1) * 100 + '%');
  renderProgress();
  renderCylinder();
  ui['choice-ammo'].disabled = mode !== 'play' || round > prepRounds;
  ui['choice-bonus'].disabled = mode !== 'play';
  ui['choice-ammo'].classList.toggle('selected', selected === 'ammo');
  ui['choice-bonus'].classList.toggle('selected', selected === 'bonus');
  ui.fire.disabled = mode !== 'play' || selected === null || !countAmmo(chambers);
  text('shot-state', selected === null ? '選擇目標' : selected === 'ammo' ? '補彈路線' : '獎金路線');
  ui['choice-ammo'].querySelector('small').textContent = round > prepRounds ? '生死段封鎖' : '轉輪抽 +0 / +1 / +2';
}

function reset() {
  mode = 'ready';
  round = 0;
  up = 0;
  selected = null;
  rotation = 0;
  chambers = initialCylinder();
  ui['enemy-stage'].dataset.state = '';
  ui['loot'].hidden = true;
  setHint('先選目標，再轉彈巢。');
  render();
}

function start() {
  revolverAudio.unlock();
  revolverAudio.startMusic();
  mode = 'play';
  round = 1;
  up = 0;
  selected = null;
  chambers = initialCylinder();
  setHint('選擇你要追逐的目標。');
  render();
}

function selectChoice(choice) {
  if (mode !== 'play' || (choice === 'ammo' && round > prepRounds)) return;
  selected = choice;
  ui['enemy-stage'].dataset.target = choice;
  setHint(choice === 'ammo' ? '補彈：成功後轉輪抽出補充數量。' : '獎金 UP：成功後累積一層，最後抽倍率。');
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
  const values = kind === 'ammo' ? [0, 1, 2] : [1.2, 1.5, 2, 3, 10];
  ui['loot-disc'].replaceChildren(...values.map((value, index) => {
    const pocket = document.createElement('span');
    pocket.className = 'wheel-pocket';
    pocket.style.setProperty('--angle', index * (360 / values.length) + 'deg');
    pocket.innerHTML = kind === 'ammo'
      ? (value ? '<img src="assets/cartridge.png" alt=""><b>+' + value + '</b>' : '<b>0</b>')
      : '<b>' + value + 'X</b>';
    return pocket;
  }));
}

function pickWeighted(list) {
  let remaining = Math.random() * list.reduce((sum, item) => sum + item.weight, 0);
  return list.findIndex(item => (remaining -= item.weight) < 0);
}

async function spinReward(kind) {
  const isFinal = kind === 'final';
  const list = isFinal ? revolverRules.finalDraw : revolverRules.ammoDraw;
  const index = pickWeighted(list);
  const value = isFinal ? finalDraw[Math.min(finalDraw.length - 1, index + up)].multiplier : ammoDraw[index].value;
  buildWheel(isFinal ? 'final' : 'ammo');
  ui['loot-core'].src = isFinal ? 'assets/bounty-token.webp' : 'assets/ammo-cache.webp';
  text('loot-kicker', isFinal ? '最終獎金抽選' : '補給抽選');
  text('loot-title', isFinal ? '最後一槍，抽出倍率' : '轉出你的補給');
  text('loot-result', '轉輪啟動中…');
  ui.loot.hidden = false;
  mode = 'loot';
  render();
  await pause(320);
  const visualIndex = index;
  const count = isFinal ? finalLabels.length : 3;
  const step = 360 / count;
  const end = 1440 + (360 - visualIndex * step);
  const animation = ui['loot-disc'].animate([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(' + end + 'deg)' },
  ], { duration: reducedMotion.matches ? 0 : 1500, easing: 'cubic-bezier(.17,.62,.24,1)' });
  await animation.finished;
  ui['loot-disc'].style.transform = 'rotate(' + end + 'deg)';
  text('loot-result', isFinal ? '抽到 ' + multiplierText(value) : '補充 ' + value + ' 發');
  revolverAudio.play('lock');
  await pause(850);
  ui.loot.hidden = true;
  return value;
}

async function fire() {
  if (mode !== 'play' || selected === null || !countAmmo(chambers)) return;
  const choice = selected;
  const chamber = chamberIndex();
  const hit = chambers[chamber];
  mode = 'spinning';
  ui['enemy-stage'].dataset.state = 'aim';
  text('shot-state', '彈巢旋轉中');
  render();
  await spinDial(chamber);
  chamberCells[chamber].classList.add('selected');
  await pause(130);
  chambers[chamber] = false;
  if (!hit) {
    revolverAudio.play('empty');
    ui['enemy-stage'].dataset.state = 'miss';
    setHint('空炮。追獵中止。', 'loss');
    await pause(700);
    finish(false);
    return;
  }
  revolverAudio.play('fire');
  ui['enemy-stage'].dataset.state = 'hit';
  setHint('命中。目標倒下。', 'success');
  await pause(650);
  if (choice === 'ammo') {
    const gained = await spinReward('ammo');
    chambers = loadAmmo(chambers, gained);
  } else {
    up++;
    text('up', up);
    ui['enemy-stage'].dataset.state = 'up';
    await pause(430);
  }
  if (round === rounds) {
    const finalMultiplier = await spinReward('final');
    finish(true, finalMultiplier);
    return;
  }
  round++;
  selected = null;
  mode = 'play';
  ui['enemy-stage'].dataset.state = '';
  setHint(round > prepRounds ? '生死段：只剩獎金路線。' : '下一回合，選擇你的目標。');
  render();
}

function finish(win, finalMultiplier = 0) {
  mode = 'result';
  ui.loot.hidden = true;
  ui['enemy-stage'].dataset.state = win ? 'clear' : 'miss';
  text('result-kicker', win ? '追獵完成' : '追獵中止');
  text('result-title', win ? '最終倍率 ' + multiplierText(finalMultiplier) : '空炮，玩家死亡');
  text('result-payout', win ? money(Math.round(baseReward * finalMultiplier)) : '$0');
  text('result-detail', win ? '第 8 回合完成 · 累積 UP ' + up + ' 層' : '完成 ' + Math.max(0, round - 1) + ' / ' + rounds + ' 回合 · UP ' + up + ' 層');
  setHint(win ? '獎金已結算。' : '再試一次。', win ? 'success' : 'loss');
  render();
}

ui.start.addEventListener('click', start);
ui.restart.addEventListener('click', reset);
ui['choice-ammo'].addEventListener('click', () => selectChoice('ammo'));
ui['choice-bonus'].addEventListener('click', () => selectChoice('bonus'));
ui.fire.addEventListener('click', fire);

reset();
