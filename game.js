const { slots, rounds, prepRounds, startAmmo, shoot, drawAmmo, drawFinalMultiplier } = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const money = value => `$${value.toLocaleString('en-US')}`;
const multiplierText = value => `${value.toLocaleString('zh-TW', { maximumFractionDigits: 1 })}X`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const baseReward = 100;

let round = 0;
let ammo = startAmmo;
let up = 0;
let mode = 'ready';
let busy = false;
let currentChoice = null;

const roundLabels = ['進入封鎖區', '穿過廢墟', '找到蹤跡', '逼近巢穴', '最後備戰', '生死段一', '生死段二', '最終決鬥'];

function setText(id, value) {
  ui[id].textContent = value;
}

function setHint(value, tone = '') {
  setText('hint', value);
  ui.hint.dataset.tone = tone;
}

function renderProgress() {
  ui.progress.innerHTML = '';
  for (let index = 1; index <= rounds; index++) {
    const cell = document.createElement('li');
    cell.textContent = index;
    cell.className = index < round ? 'cleared' : index === round ? 'current' : '';
    ui.progress.append(cell);
  }
}

function render() {
  const ready = mode === 'ready';
  const result = mode === 'result';
  const play = !ready && !result;
  ui.game.dataset.mode = mode;
  ui.intro.hidden = !ready;
  ui.play.hidden = !play;
  ui.result.hidden = !result;
  ui['fire-panel'].hidden = !play;
  setText('round-title', ready ? '八回合左輪追獵' : roundLabels[Math.max(round - 1, 0)]);
  setText('round-number', ready ? '—' : `${round} / ${rounds}`);
  setText('ammo', `${ammo} / ${slots}`);
  setText('up', `${up} 層`);
  setText('jackpot', 'WIN UP TO 10X');
  setText('goal', ready ? '一路撐到第 8 回合，最後抽一次獎金倍率。' : `目標：完成第 ${round} 回合的開槍選擇。`);
  setText('play-goal', `目標：完成第 ${round} 回合的開槍選擇。`);
  renderProgress();
  ui['choice-ammo'].disabled = busy || !play || round > prepRounds;
  ui['choice-bonus'].disabled = busy || !play;
  ui['choice-ammo'].classList.toggle('selected', currentChoice === 'ammo');
  ui['choice-bonus'].classList.toggle('selected', currentChoice === 'bonus');
  ui['ammo-value'].textContent = round > prepRounds ? '後段不補彈' : '抽 +0 / +1 / +2';
  ui['bonus-value'].textContent = '成功累積 1 層 UP';
}

function resetRun() {
  round = 0;
  ammo = startAmmo;
  up = 0;
  mode = 'ready';
  busy = false;
  currentChoice = null;
  setHint('先看懂兩種選擇，再開始第一槍。');
  render();
}

function startRun() {
  round = 1;
  ammo = startAmmo;
  up = 0;
  mode = 'play';
  currentChoice = null;
  setHint('每回合必須開槍；實彈成功，空炮即死。');
  render();
}

async function choose(choice) {
  if (busy || mode !== 'play' || !ammo) {
    if (!ammo) fail('彈巢已空，無法完成下一槍。');
    return;
  }
  currentChoice = choice;
  busy = true;
  render();
  ui.target.classList.add('aiming');
  setHint(choice === 'ammo' ? '你選擇了穩健子彈，現在開槍。' : '你選擇了獎金 UP，現在開槍。');
  await wait(460);
  ui.target.classList.remove('aiming');
  const shot = shoot(ammo);
  if (!shot.hit) {
    fail('空炮。這一槍沒有子彈，玩家死亡。');
    return;
  }
  ammo = shot.ammo;
  if (choice === 'ammo') {
    const gained = drawAmmo();
    ammo = Math.min(slots, ammo + gained);
    setHint(`實彈命中補給殭屍，彈藥 +${gained}。`, 'success');
  } else {
    up += 1;
    setHint('實彈命中獎金殭屍，累積 UP +1。', 'success');
  }
  await wait(700);
  if (round === rounds) {
    finish();
    return;
  }
  round += 1;
  currentChoice = null;
  busy = false;
  render();
  setHint(round > prepRounds ? '進入生死段：後三回合不再補彈。' : '選擇下一個要追逐的目標。');
}

function fail(message) {
  mode = 'result';
  busy = false;
  setText('result-title', '本局結束');
  setText('result-message', message);
  setText('result-payout', '$0');
  setText('result-detail', `完成 ${Math.max(round - 1, 0)} / ${rounds} 回合 · 累積 ${up} 層 UP`);
  ui.result.dataset.outcome = 'loss';
  render();
}

function finish() {
  const draw = drawFinalMultiplier(up);
  const payout = Math.round(baseReward * draw.multiplier);
  mode = 'result';
  busy = false;
  setText('result-title', '通關成功');
  setText('result-message', `最終抽到 ${multiplierText(draw.multiplier)}。`);
  setText('result-payout', money(payout));
  setText('result-detail', `基礎獎金 ${money(baseReward)} · 原始抽到 ${multiplierText(draw.baseMultiplier)} · UP ${up} 層`);
  ui.result.dataset.outcome = 'win';
  render();
}

ui.start.addEventListener('click', startRun);
ui['choice-ammo'].addEventListener('click', () => choose('ammo'));
ui['choice-bonus'].addEventListener('click', () => choose('bonus'));
ui.restart.addEventListener('click', resetRun);

resetRun();
