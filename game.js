const {
  slots, prepRounds, bossRounds, bossMaxAmmo, maxMultiplier, payoutMultiplier, doorChoices,
  initialCylinder, countAmmo, loadRound, weightedIndex, chamberIndex, ammoDraw, specialQuantityDraw, bountyDraw, finalDraw,
} = revolverRules;
const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
const app = ui.app;
const text = (id, value) => { ui[id].textContent = value; };
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve => setTimeout(resolve, motion.matches ? 0 : ms));
const format = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });
const coin = 'assets/bounty-token.webp';
const cartridge = 'assets/cartridge.png';
const shells = { normal: '普通彈', crit: '爆擊彈', freeze: '冰凍彈', bounty: '賞金彈' };
const targets = {
  ammo: { label: '補給', reward: '普通彈 +1～3', icon: cartridge, art: 'supply' },
  bonus: { label: '賞金', reward: '加成 +0.2～1.0', icon: coin, art: 'bounty' },
  crit: { label: '爆擊彈', reward: '爆擊彈 +1～3', icon: cartridge, art: 'special' },
  freeze: { label: '冰凍彈', reward: '冰凍彈 +1～3', icon: cartridge, art: 'special' },
  bounty: { label: '賞金彈', reward: '賞金彈 +1～3', icon: cartridge, art: 'bounty' },
};
const bets = [5, 10, 25, 50, 100];
const storageKey = 'revolver-demo-credits';
let credits = 1000;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null && Number.isFinite(Number(saved)) && Number(saved) >= 0) credits = Number(saved);
} catch { /* The game also works with in-memory credits. */ }
let betIndex = 1;
let phase = 'ready';
let scene = 'doors';
let round = 0;
let selected;
let chambers = initialCylinder();
let pocket = { normal: 0, crit: 0, freeze: 0, bounty: 0 };
let undo;
let rotation = 0;
let bonus = 0;
let bossHp = 3;
let bossClock = bossRounds;
let reward;
let won = false;
let soundOn = true;

const doors = [...ui.doors.querySelectorAll('.door')];
const loadButtons = [...ui.armory.querySelectorAll('[data-load]')];
const slotsUI = Array.from({ length: slots }, (_, index) => {
  const node = document.createElement('span');
  placeOnCircle(node, index, slots, 30.5);
  ui.cylinder.append(node);
  return node;
});
const availableImages = Object.fromEntries(['corridor', 'boss', 'loot', 'supply', 'bounty', 'special'].map(name => {
  const img = new Image();
  img.src = 'assets/demo-' + name + '.webp';
  return [name, img];
}));

function placeOnCircle(node, index, count, radius) {
  const angle = index * 2 * Math.PI / count;
  node.style.left = 50 + radius * Math.sin(angle) + '%';
  node.style.top = 50 - radius * Math.cos(angle) + '%';
}

function setCredits(value) {
  credits = Math.round(value * 10) / 10;
  try { localStorage.setItem(storageKey, String(credits)); } catch { /* Continue in memory. */ }
}

function setPhase(next, backdrop = scene) {
  phase = next;
  scene = backdrop;
  render();
}

function render() {
  const boss = round > prepRounds;
  const combat = phase === 'aim' || phase === 'spinning';
  const ready = phase === 'ready';
  const result = phase === 'result';
  const ammo = countAmmo(chambers);
  app.dataset.phase = phase;
  app.dataset.scene = scene;
  for (const [id, shown] of Object.entries({
    ready, doors: phase === 'doors', enemy: combat && !boss, target: combat && !boss,
    'boss-status': combat && boss, combat, armory: combat && boss, reward: phase === 'reward', result, wager: ready || result,
    advance: phase === 'reward',
  })) ui[id].hidden = !shown;
  text('credits', format.format(credits));
  text('bet', bets[betIndex]);
  text('ceiling', format.format(bets[betIndex] * maxMultiplier));
  text('round-label', boss ? '最終決鬥' : '備戰');
  text('round', boss ? 'BOSS' : round ? round + '/' + prepRounds : '—');
  text('ammo', ammo + '/' + slots);
  text('bonus', '×' + (1 + bonus).toFixed(1));
  text('boss-hp', Array.from({ length: 3 }, (_, index) => index < bossHp ? '◆' : '◇').join(' '));
  ui['boss-hp'].setAttribute('aria-label', 'Boss 剩餘 ' + bossHp + ' 點生命');
  text('boss-clock', bossClock + ' 槍');
  [...ui.route.children].forEach((node, index) => {
    node.classList.toggle('done', index < round - 1 || (result && won));
    node.classList.toggle('current', !result && index === round - 1);
  });
  slotsUI.forEach((node, index) => {
    const type = chambers[index];
    node.className = type ? 'slot loaded ' + type : 'slot';
    node.textContent = '';
    if (type && type !== 'normal') {
      const mark = document.createElement('b');
      mark.textContent = shells[type][0];
      node.append(mark);
    }
    node.setAttribute('aria-label', type ? shells[type] : '空彈室');
  });
  loadButtons.forEach(button => {
    const type = button.dataset.load;
    button.disabled = phase !== 'aim' || !pocket[type] || (ammo >= bossMaxAmmo && (type === 'normal' || !chambers.includes('normal')));
    button.querySelector('b').textContent = pocket[type];
  });
  ui.undo.hidden = phase !== 'aim' || !undo;
  ui.fire.disabled = phase !== 'aim';
  text('load-guide', ammo === bossMaxAmmo ? '特殊彈可替換普通彈' : '裝填彈藥 · 最多 5/6');
  const lower = app.querySelector('[data-action="lower"]');
  const higher = app.querySelector('[data-action="higher"]');
  lower.disabled = betIndex === 0 || credits < bets[0];
  higher.disabled = betIndex === bets.length - 1 || bets[betIndex + 1] > credits;
  ui.start.disabled = credits >= bets[0] && bets[betIndex] > credits;
  text('start', credits < bets[0] ? '補充試玩點數' : result ? '再押一局' : '押分開局');
  if (phase === 'reward') {
    text('advance', ({ ready: '轉動輪盤', spinning: '輪盤轉動中…', drawn: reward.kind === 'final' ? '查看派彩' : '繼續 →' })[reward.state]);
    ui.advance.disabled = reward.state === 'spinning';
  }
  text('footer-status', ({
    ready: '試玩點數',
    doors: '點選門上的獎勵',
    aim: boss ? '打倒 Boss，解鎖最終派彩輪盤' : '命中後可抽獎 · 空炮結束本局',
    spinning: boss ? '空炮耗掉 1 次機會' : '每槍隨機轉至一格',
    reward: reward?.kind === 'final' ? '基礎倍率 × 賞金加成 · 最高 10X' : '抽出本關獎勵',
    result: '派彩已結算 · 試玩點數',
  })[phase]);
}

function showDoors() {
  const options = doorChoices(countAmmo(chambers));
  doors.forEach((button, index) => {
    const type = options[index];
    const target = targets[type];
    button.className = 'door ' + type;
    button.dataset.door = type;
    button.querySelector('img').src = target.icon;
    button.querySelector('strong').textContent = target.label;
    button.querySelector('small').textContent = target.reward;
  });
  app.dataset.impact = '';
  setPhase('doors', 'doors');
}

function start() {
  if (phase !== 'ready' && phase !== 'result') return;
  if (credits < bets[0]) {
    setCredits(1000);
    render();
    return;
  }
  if (credits < bets[betIndex]) return;
  revolverAudio.unlock();
  if (soundOn) revolverAudio.startMusic();
  setCredits(credits - bets[betIndex]);
  round = 1;
  bonus = 0;
  won = false;
  chambers = initialCylinder();
  pocket = { normal: 0, crit: 0, freeze: 0, bounty: 0 };
  undo = null;
  bossHp = 3;
  bossClock = bossRounds;
  reward = null;
  rotation = 0;
  ui.cylinder.style.transform = '';
  showDoors();
}

function enterDoor(type) {
  if (phase !== 'doors') return;
  selected = type;
  const target = targets[type];
  ui.enemy.src = availableImages[target.art].src;
  ui.enemy.className = 'enemy ' + type;
  ui.target.className = 'target ' + type;
  ui['target-icon'].src = target.icon;
  text('target-name', target.label + '殭屍');
  text('target-reward', target.reward);
  text('shot', '');
  setPhase('aim', 'corridor');
}

function enterBoss() {
  if (countAmmo(chambers) > bossMaxAmmo) {
    chambers[chambers.indexOf('normal')] = null;
    pocket.normal++;
  }
  text('shot', '決鬥開始');
  app.dataset.impact = '';
  setPhase('aim', 'vault');
}

function load(type) {
  if (phase !== 'aim' || round <= prepRounds || !pocket[type]) return;
  const ammo = countAmmo(chambers);
  const replace = ammo === bossMaxAmmo ? chambers.indexOf('normal') : -1;
  if (ammo >= bossMaxAmmo && (replace < 0 || type === 'normal')) return;
  undo ??= { chambers: [...chambers], pocket: { ...pocket } };
  if (replace >= 0) {
    chambers[replace] = type;
    pocket.normal++;
  } else loadRound(chambers, type, bossMaxAmmo);
  pocket[type]--;
  const count = chambers.filter(value => value === type).length;
  text('shot', type === 'crit' && count >= 3 ? '爆擊組合 · 命中 3 傷害' :
    type === 'freeze' && count >= 3 ? '冰凍組合 · 反擊延後 2 槍' : shells[type] + '已裝填');
  revolverAudio.play('reload');
  render();
}

async function rotate(node, from, to, duration) {
  const animation = node.animate([
    { transform: 'rotate(' + from + 'deg)' }, { transform: 'rotate(' + to + 'deg)' },
  ], { duration: motion.matches ? 0 : duration, easing: 'cubic-bezier(.16,.63,.2,1)', fill: 'forwards' });
  let last = -1;
  function tick() {
    if (animation.playState !== 'running') return;
    const turn = Math.floor((animation.effect.getComputedTiming().progress ?? 0) * 22);
    if (turn !== last) revolverAudio.play('tick');
    last = turn;
    requestAnimationFrame(tick);
  }
  if (!motion.matches) requestAnimationFrame(tick);
  await animation.finished;
  node.style.transform = 'rotate(' + to + 'deg)';
  animation.cancel();
  revolverAudio.play('lock');
}

async function fire() {
  if (phase !== 'aim') return;
  const boss = round > prepRounds;
  const index = chamberIndex();
  const type = chambers[index];
  const matching = type ? chambers.filter(value => value === type).length : 0;
  undo = null;
  app.dataset.impact = '';
  text('shot', '彈巢轉動中…');
  setPhase('spinning');
  const end = rotation + 1080 + (720 - index * 60 - rotation % 360) % 360;
  await rotate(ui.cylinder, rotation, end, 930);
  rotation = end;
  slotsUI[index].classList.add('selected');
  await pause(190);
  chambers[index] = null;
  app.dataset.impact = type ? 'hit' : 'miss';
  revolverAudio.play(type ? 'fire' : 'empty');
  if (!boss) {
    text('shot', type ? '命中！' : '空炮');
    render();
    await pause(400);
    if (!type) finish(false, '殭屍反擊 · 本局結束');
    else {
      app.dataset.impact = 'kill';
      await pause(240);
      showReward(selected === 'ammo' ? 'ammo' : selected === 'bonus' ? 'bonus' : 'special', selected);
    }
    return;
  }
  const damage = type === 'crit' ? (matching >= 3 ? 3 : 2) : Number(Boolean(type));
  const delay = type === 'freeze' ? (matching >= 3 ? 2 : 1) : 0;
  bossHp = Math.max(0, bossHp - damage);
  bossClock += delay - 1;
  text('shot', !type ? '空炮 · 剩 ' + bossClock + ' 槍' :
    delay ? '冰凍命中 · 延後 ' + delay + ' 槍' : (type === 'crit' ? '爆擊' : '命中') + ' · −' + damage + ' HP');
  render();
  await pause(580);
  if (type === 'bounty') showReward('boss-bonus');
  else afterBossShot();
}

function afterBossShot() {
  app.dataset.impact = '';
  if (bossHp === 0) showReward('final');
  else if (bossClock === 0) {
    revolverAudio.play('bossAttack');
    finish(false, 'Boss 反擊 · 本局結束');
  } else setPhase('aim', 'vault');
}

function showReward(kind, type) {
  const isBonus = kind === 'bonus' || kind === 'boss-bonus';
  const title = kind === 'ammo' ? '普通彈補給' : kind === 'special' ? shells[type] + '補給' : isBonus ? '賞金加成輪盤' : '最終派彩輪盤';
  const values = kind === 'ammo' ? ammoDraw : kind === 'special' ? specialQuantityDraw : isBonus ? bountyDraw : finalDraw;
  const icon = isBonus || kind === 'final' ? coin : cartridge;
  const label = item => kind === 'final' ? item.multiplier + 'X' : '+' + (isBonus ? item.bonus.toFixed(1) : item.value ?? item.amount);
  reward = { kind, type, values, label, state: 'ready' };
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  const step = 360 / values.length;
  const colors = ['#783022', '#352c30', '#745333', '#412827', '#614333'];
  const sectors = values.flatMap((_, index) => [colors[index] + ' ' + (index * step) + 'deg ' + ((index + 1) * step - 1.1) + 'deg', '#d49b61 ' + ((index + 1) * step - 1.1) + 'deg ' + ((index + 1) * step) + 'deg']);
  ui.wheel.style.setProperty('--sectors', 'conic-gradient(from ' + (-step / 2) + 'deg, ' + sectors.join(',') + ')');
  ui.wheel.style.transform = '';
  ui.wheel.replaceChildren(...values.map((item, index) => {
    const node = document.createElement('span');
    node.className = 'wedge' + (kind === 'special' ? ' ' + type : '');
    const img = new Image();
    img.src = icon;
    img.alt = '';
    const chance = document.createElement('small');
    chance.textContent = format.format(100 * item.weight / totalWeight) + '%';
    node.append(img, label(item), chance);
    placeOnCircle(node, index, values.length, 34);
    return node;
  }));
  ui['wheel-icon'].src = icon;
  ui['wheel-icon'].className = kind === 'special' ? type : '';
  text('reward-title', title);
  text('reward-result', '');
  text('reward-detail', kind === 'special' ? '另外獲得 1 顆普通彈' : '');
  app.dataset.impact = '';
  setPhase('reward', 'loot');
}

async function advance() {
  if (phase !== 'reward' || reward.state === 'spinning') return;
  const { kind, type, values, label } = reward;
  if (reward.state === 'drawn') {
    if (kind === 'final') finish(true, '', reward.item.multiplier);
    else if (kind === 'boss-bonus') afterBossShot();
    else if (++round > prepRounds) enterBoss();
    else showDoors();
    return;
  }
  const index = weightedIndex(values);
  const item = values[index];
  reward.state = 'spinning';
  render();
  const angle = 1440 - index * 360 / values.length;
  await rotate(ui.wheel, 0, angle, 1150);
  for (const wedge of ui.wheel.children) wedge.style.rotate = -angle + 'deg';
  ui.wheel.children[index].classList.add('selected');
  reward.item = item;
  let result = label(item);
  let detail = '';
  if (kind === 'ammo' || kind === 'special') {
    const before = pocket.normal;
    const gained = kind === 'ammo' ? item.value : 1;
    for (let i = 0; i < gained; i++) if (!loadRound(chambers, 'normal')) pocket.normal++;
    if (kind === 'special') pocket[type] += item.amount;
    result = (kind === 'ammo' ? shells.normal : shells[type]) + ' ' + result;
    const stored = pocket.normal - before;
    detail = '普通彈 · 彈巢 +' + (gained - stored) + ' / 口袋 +' + stored;
  } else if (kind === 'bonus' || kind === 'boss-bonus') {
    bonus = Math.round((bonus + item.bonus) * 10) / 10;
    detail = '累計賞金加成 ×' + (1 + bonus).toFixed(1);
  } else {
    const total = payoutMultiplier(item.multiplier, bonus);
    detail = '實際 ' + format.format(total) + 'X · ' + format.format(bets[betIndex] * total) + ' 點';
  }
  text('reward-result', result);
  text('reward-detail', detail);
  reward.state = 'drawn';
  render();
}

function finish(win, reason, base = 0) {
  won = win;
  const total = payoutMultiplier(base, bonus);
  const payout = Math.round(bets[betIndex] * total * 10) / 10;
  if (win) setCredits(credits + payout);
  while (betIndex > 0 && bets[betIndex] > credits) betIndex--;
  ui['result-icon'].src = win ? coin : cartridge;
  text('result-title', win ? '金庫賞金' : '追獵結束');
  text('payout', format.format(payout) + ' 點');
  const formula = base + 'X × ' + (1 + bonus).toFixed(1) + ' → ' + format.format(total) + 'X';
  text('result-detail', win ? formula + (base * (1 + bonus) > maxMultiplier ? '（上限）' : '') : reason);
  app.dataset.impact = '';
  setPhase('result', win ? 'loot' : scene);
  if (win) revolverAudio.play('clear');
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.door) enterDoor(button.dataset.door);
  if (button.dataset.load) load(button.dataset.load);
  switch (button.dataset.action) {
    case 'lower': betIndex--; render(); break;
    case 'higher': betIndex++; render(); break;
    case 'start': start(); break;
    case 'fire': fire(); break;
    case 'advance': advance(); break;
    case 'undo':
      ({ chambers, pocket } = undo);
      undo = null;
      text('shot', '已復原裝填');
      render();
      break;
  }
});

ui.sound.addEventListener('click', () => {
  soundOn = !soundOn;
  revolverAudio.toggleMute();
  revolverAudio.toggleMusic();
  ui.sound.setAttribute('aria-pressed', String(soundOn));
});
while (betIndex > 0 && bets[betIndex] > credits) betIndex--;
render();
