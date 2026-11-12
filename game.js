const { slots, rounds, prepRounds, bossMaxAmmo, initialCylinder, countAmmo, loadRound, ammoDraw, specialQuantityDraw, bountyDraw, finalDraw, chamberIndex } = revolverRules;

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : ms));
const money = value => '$' + value.toLocaleString('en-US');
const multiplierText = value => value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + 'X';
const baseReward = 100;
const targetOptions = ['ammo', 'bonus', 'crit', 'freeze', 'bounty'];
const targetWeights = { ammo: 36, bonus: 24, crit: 14, freeze: 14, bounty: 12 };
const targetData = {
  ammo: { name: '補給殭屍', art: 'assets/zombie-supply-v2.png', icon: 'assets/zombie-supply-v2.png', rule: '命中後抽普通彈', hint: '你在追逐彈藥。命中後會轉出 +1、+2 或 +3。', tag: 'SUPPLY TARGET' },
  bonus: { name: '賞金殭屍', art: 'assets/zombie-bounty-v2.png', icon: 'assets/zombie-bounty-v2.png', rule: '命中後抽獎金', hint: '你在追逐獎金。命中後轉出 +0.2X、+0.5X 或 +1.0X。', tag: 'BOUNTY TARGET' },
  crit: { name: '爆擊彈殭屍', art: 'assets/zombie-special-v2.png', icon: 'assets/special-ammo-sheet-v2.png', rule: '命中後取得爆擊彈', hint: '你在追逐爆擊組合。命中後取得 1～3 顆爆擊彈。', tag: 'CRIT TARGET' },
  freeze: { name: '冰凍彈殭屍', art: 'assets/zombie-special-v2.png', icon: 'assets/special-ammo-sheet-v2.png', rule: '命中後取得冰凍彈', hint: '你在追逐容錯空間。命中後取得 1～3 顆冰凍彈。', tag: 'FREEZE TARGET' },
  bounty: { name: '賞金彈殭屍', art: 'assets/zombie-bounty-v2.png', icon: 'assets/special-ammo-sheet-v2.png', rule: '命中後取得賞金彈', hint: '你在追逐 Boss 賞金組合。命中後取得 1～3 顆賞金彈。', tag: 'GOLD SHELL TARGET' },
  boss: { name: '封鎖區 Boss', art: 'assets/boss-v2.png', icon: 'assets/bounty-token.webp', rule: '3 HP · 3 回合', hint: '最後一關。每次開槍前，都要決定是否押上一顆特殊彈。', tag: 'FINAL CHAMBER' },
};

let mode = 'ready';
let round = 0;
let selected = null;
let options = [...targetOptions];
let rotation = 0;
let chambers = initialCylinder();
let pocket = { crit: 0, freeze: 0, bounty: 0 };
let bountyBonus = 0;
let bossHp = 3;
let bossClock = 3;
let bossPlan = [];
let bossCritFired = 0;
let bossFreezeFired = 0;

const chamberCells = chambers.map((_, index) => {
  const cell = document.createElement('i');
  cell.dataset.index = index;
  ui.cylinder.append(cell);
  return cell;
});

function text(id, value) { ui[id].textContent = value; }
function setHint(value, tone = '') { ui.hint.textContent = value; ui.hint.dataset.tone = tone; }
function pocketTotal() { return pocket.crit + pocket.freeze + pocket.bounty; }
function weightedIndex(list) { let roll = Math.random() * list.reduce((sum, item) => sum + item.weight, 0); return list.findIndex(item => (roll -= item.weight) < 0); }
function weightedSample(values, amount) {
  const pool = [...values];
  const result = [];
  while (result.length < amount && pool.length) {
    const index = weightedIndex(pool.map(value => ({ value, weight: targetWeights[value] })));
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
function chooseOptions() {
  const amount = round <= 2 ? 3 : 2;
  const next = weightedSample(targetOptions, amount);
  if (countAmmo(chambers) < 2 && !next.includes('ammo')) next[0] = 'ammo';
  return next;
}

function renderProgress() {
  ui.progress.replaceChildren(...Array.from({ length: rounds }, (_, index) => {
    const cell = document.createElement('li');
    cell.className = index < round - 1 ? 'done' : index === round - 1 ? 'current' : '';
    cell.ariaLabel = '第 ' + (index + 1) + ' 回合';
    return cell;
  }));
}

function renderCylinder() {
  text('ammo', countAmmo(chambers));
  chamberCells.forEach((cell, index) => {
    const type = chambers[index];
    cell.className = type ? 'loaded ' + (type === 'normal' ? '' : 'special-' + type) : '';
    cell.style.setProperty('--slot-angle', index * 60 + 'deg');
    cell.classList.remove('selected');
  });
}

function renderTargetOptions() {
  const cards = { ammo: ui['choice-ammo'], bonus: ui['choice-bonus'], crit: ui['choice-crit'], freeze: ui['choice-freeze'], bounty: ui['choice-bounty'] };
  Object.entries(cards).forEach(([type, card]) => {
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
  ui.game.dataset.mode = mode;
  ui.intro.hidden = !ready;
  ui.hunt.hidden = !(doors || fight);
  ui['door-select'].hidden = !doors;
  ui['fight-stage'].hidden = !fight;
  ui.result.hidden = !result;
  ui['weapon-panel'].hidden = !fight;
  ui.route.hidden = ready || result;
  text('round-number', ready ? '—' : round);
  text('up', bountyBonus.toFixed(1));
  text('route-title', ready ? '準備進入封鎖區' : round > prepRounds ? 'FINAL CHAMBER · BOSS' : '準備階段 · 選擇你的獎勵');
  ui['route-dot'].style.transform = 'translate(' + Math.max(0, round - 1) / (rounds - 1) * 100 + '%, -4px)';
  renderProgress();
  renderCylinder();
  renderTargetOptions();
  renderLoadout();
  text('shot-state', mode === 'boss-load' ? '配置特殊彈' : mode === 'boss' ? 'Boss 決鬥' : selected ? targetData[selected]?.name : '選擇目標');
  ui.fire.disabled = !['fight', 'boss'].includes(mode) || !countAmmo(chambers);
  ui.fire.querySelector('small').textContent = mode === 'boss' ? '隨機彈巢決定結果' : '選定後轉彈巢';
}

function reset() {
  mode = 'ready'; round = 0; selected = null; options = [...targetOptions]; rotation = 0; chambers = initialCylinder(); pocket = { crit: 0, freeze: 0, bounty: 0 }; bountyBonus = 0; bossHp = 3; bossClock = 3; bossPlan = []; bossCritFired = 0; bossFreezeFired = 0;
  ui['enemy-stage'].dataset.state = ''; ui['enemy-stage'].dataset.target = ''; ui.loot.hidden = true; setHint('先選目標，再轉彈巢。'); render();
}

function start() {
  revolverAudio.unlock(); revolverAudio.startMusic(); mode = 'doors'; round = 1; selected = null; chambers = initialCylinder(); options = [...targetOptions]; pocket = { crit: 0, freeze: 0, bounty: 0 }; bountyBonus = 0; setHint('第一步：選擇你現在最想累積的資源。'); render();
}

async function selectChoice(choice) {
  if (mode !== 'doors' || !options.includes(choice)) return;
  selected = choice; const target = targetData[choice]; ui['door-select'].dataset.state = 'opening'; setHint(target.hint); mode = 'entering'; render(); await pause(420);
  ui['enemy-stage'].dataset.target = choice; ui['enemy-art'].src = target.art; ui['enemy-art'].alt = target.name; ui['target-icon'].src = target.icon; text('target-name', target.name); text('encounter-rule', target.rule); text('enemy-tag', target.tag); text('target-index', String(round).padStart(2, '0')); text('encounter-kicker', 'TARGET ACQUIRED'); mode = 'fight'; ui['door-select'].dataset.state = ''; setHint('目標出現。轉動彈巢，結果會決定你是否拿到它的獎勵。'); render();
}

function enterBoss() {
  while (countAmmo(chambers) > bossMaxAmmo) { const index = chambers.findIndex(type => type === 'normal'); chambers[index < 0 ? chambers.findIndex(Boolean) : index] = null; }
  selected = 'boss'; mode = 'boss-load'; bossHp = 3; bossClock = 3; bossPlan = []; bossCritFired = 0; bossFreezeFired = 0; ui['enemy-stage'].dataset.target = 'boss'; ui['enemy-art'].src = targetData.boss.art; ui['enemy-art'].alt = targetData.boss.name; ui['target-icon'].src = targetData.boss.icon; text('target-name', targetData.boss.name); text('encounter-rule', targetData.boss.rule); text('enemy-tag', targetData.boss.tag); text('encounter-kicker', 'FINAL CHAMBER'); setHint(targetData.boss.hint); render();
}

function loadSpecial(type) {
  if (mode !== 'boss-load' || !pocket[type]) return;
  let loaded = false;
  if (countAmmo(chambers) < bossMaxAmmo) loaded = loadRound(chambers, type, bossMaxAmmo);
  else { const index = chambers.findIndex(value => value === 'normal'); if (index >= 0) { chambers[index] = type; loaded = true; } }
  if (!loaded) return;
  pocket[type]--; bossPlan.push(type); mode = 'boss'; setHint('已裝填 ' + ({ crit: '爆擊彈', freeze: '冰凍彈', bounty: '賞金彈' }[type]) + '。這一發值得押下去嗎？'); render();
}
function skipLoad() { if (mode !== 'boss-load') return; mode = 'boss'; setHint('不再裝填。這一發交給彈巢決定。'); render(); }

function spinDial(selectedIndex, duration = 940) {
  const step = 360 / slots; const startRotation = rotation; const endRotation = startRotation + 1080 + (720 - selectedIndex * step - startRotation % 360) % 360;
  const animation = ui.cylinder.animate([{ transform: 'rotate(' + startRotation + 'deg)' }, { transform: 'rotate(' + endRotation + 'deg)' }], { duration: reducedMotion.matches ? 0 : duration, easing: 'cubic-bezier(.17,.62,.24,1)' });
  let lastTick = Math.floor(startRotation / step); const tick = () => { const progress = animation.effect ? animation.effect.getComputedTiming().progress || 1 : 1; const crossed = Math.floor((startRotation + (endRotation - startRotation) * progress) / step); if (crossed !== lastTick) { revolverAudio.play('tick'); lastTick = crossed; } if (progress < 1) requestAnimationFrame(tick); }; if (!reducedMotion.matches) requestAnimationFrame(tick);
  return animation.finished.then(() => { rotation = endRotation; ui.cylinder.style.transform = 'rotate(' + rotation + 'deg)'; revolverAudio.play('lock'); });
}

function buildWheel(kind, specialType = 'crit') {
  const labels = { crit: '爆擊', freeze: '冰凍', bounty: '賞金' };
  const values = kind === 'ammo' ? ammoDraw.map(({ value }) => '+' + value + ' 普通彈') : kind === 'special' ? specialQuantityDraw.map(({ amount }) => labels[specialType] + ' ×' + amount) : kind === 'bounty' ? bountyDraw.map(({ bonus }) => '+' + bonus.toFixed(1) + 'X') : finalDraw.map(({ multiplier }) => multiplier + 'X');
  ui['loot-disc'].replaceChildren(...values.map((value, index) => { const item = document.createElement('span'); item.className = 'wheel-pocket'; item.style.setProperty('--angle', index * (360 / values.length) + 'deg'); item.textContent = value; return item; }));
}

async function spinReward(kind, specialType = 'crit') {
  const lists = { ammo: ammoDraw, special: specialQuantityDraw, bounty: bountyDraw, final: finalDraw }; const list = lists[kind]; const item = list[weightedIndex(list)]; const value = kind === 'ammo' ? item.value : kind === 'special' ? item.amount : kind === 'bounty' ? item.bonus : item.multiplier;
  buildWheel(kind, specialType); ui['loot-core'].src = kind === 'special' ? 'assets/special-ammo-sheet-v2.png' : kind === 'bounty' ? 'assets/bounty-token.webp' : kind === 'final' ? 'assets/bounty-token.webp' : 'assets/cartridge.png'; text('loot-kicker', kind === 'final' ? 'FINAL PRIZE DRAW' : 'REWARD DRAW'); text('loot-title', kind === 'ammo' ? '普通彈補給' : kind === 'special' ? ({ crit: '爆擊彈', freeze: '冰凍彈', bounty: '賞金彈' }[specialType]) + ' 抽選' : kind === 'bounty' ? '獎金加成抽選' : '最後一槍，抽出倍率'); text('loot-result', '抽選中…'); text('loot-round', 'ROUND ' + round); ui.loot.hidden = false; mode = 'loot'; render(); await pause(180);
  const step = 360 / list.length; const index = list.indexOf(item); const end = 1440 + (360 - index * step); const animation = ui['loot-disc'].animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + end + 'deg)' }], { duration: reducedMotion.matches ? 0 : 1150, easing: 'cubic-bezier(.12,.7,.2,1)' }); await animation.finished; ui['loot-disc'].style.transform = 'rotate(' + end + 'deg)';
  text('loot-result', kind === 'ammo' ? '普通彈 +' + value : kind === 'special' ? ({ crit: '爆擊彈', freeze: '冰凍彈', bounty: '賞金彈' }[specialType]) + ' ×' + value : kind === 'bounty' ? '獎金加成 +' + value.toFixed(1) + 'X' : '最終倍率 ' + multiplierText(value)); revolverAudio.play('lock'); await pause(600); ui.loot.hidden = true; return value;
}

function comboCounts() { return { crit: bossPlan.filter(type => type === 'crit').length, freeze: bossPlan.filter(type => type === 'freeze').length }; }

async function fire() {
  if (!['fight', 'boss'].includes(mode) || !countAmmo(chambers)) return;
  const isBoss = mode === 'boss'; const choice = selected; const chamber = chamberIndex(); const type = chambers[chamber]; mode = 'spinning'; ui['enemy-stage'].dataset.state = 'aim'; text('shot-state', '彈巢旋轉中'); render(); await spinDial(chamber); chamberCells[chamber].classList.add('selected'); await pause(120); chambers[chamber] = null;
  if (!type) { revolverAudio.play('empty'); ui['enemy-stage'].dataset.state = 'miss'; setHint(isBoss ? '空炮。Boss 發動攻擊。' : '空炮。追獵中止。', 'loss'); await pause(650); finish(false, 0, 0, isBoss ? 'Boss 攻擊' : '空炮'); return; }
  revolverAudio.play('fire'); ui['enemy-stage'].dataset.state = 'hit';
  if (!isBoss) {
    setHint('命中。目標倒下，開始抽取獎勵。', 'success'); await pause(430);
    if (choice === 'ammo') { const gained = await spinReward('ammo'); for (let index = 0; index < gained; index++) loadRound(chambers, 'normal'); }
    else if (choice === 'bonus') bountyBonus = Number((bountyBonus + await spinReward('bounty')).toFixed(1));
    else { const gained = await spinReward('special', choice); pocket[choice] += gained; }
    round++; selected = null; if (round > prepRounds) enterBoss(); else { options = chooseOptions(); mode = 'doors'; setHint('下一回合：看彈藥、口袋與獎金，選下一個目標。'); render(); } return;
  }
  const counts = comboCounts(); let damage = type === 'crit' ? 2 : 1; let reward = 0;
  if (type === 'crit' && counts.crit >= 2 && bossCritFired > 0) damage++;
  if (type === 'freeze') { bossClock = Math.min(5, bossClock + (counts.freeze >= 2 && bossFreezeFired > 0 ? 2 : 1)); bossFreezeFired++; }
  if (type === 'bounty') { reward = await spinReward('bounty'); bountyBonus = Number((bountyBonus + reward).toFixed(1)); }
  if (type === 'crit') bossCritFired++;
  bossHp = Math.max(0, bossHp - damage); bossClock--; setHint(type === 'crit' ? '爆擊命中，造成 ' + damage + ' 點傷害。' : type === 'freeze' ? '冰凍命中，Boss 攻擊延後。' : type === 'bounty' ? '賞金命中，獎金池增加 +' + reward.toFixed(1) + 'X。' : '普通彈命中，造成 1 點傷害。', 'success'); await pause(620);
  if (bossHp <= 0) { const finalMultiplier = await spinReward('final'); finish(true, finalMultiplier * (1 + bountyBonus), finalMultiplier, 'Boss 擊殺'); return; }
  if (bossClock <= 0) { finish(false, 0, 0, 'Boss 攻擊'); return; }
  mode = 'boss-load'; setHint('Boss 尚有 ' + bossHp + ' HP。下一發要不要再押一顆特殊彈？'); render();
}

function finish(win, totalMultiplier = 0, finalMultiplier = 0, reason = '空炮') { mode = 'result'; ui.loot.hidden = true; ui['enemy-stage'].dataset.state = win ? 'clear' : 'miss'; text('result-kicker', win ? 'RUN COMPLETE' : 'RUN FAILED'); text('result-title', win ? '總倍率 ' + multiplierText(totalMultiplier) : reason); text('result-payout', win ? money(Math.round(baseReward * totalMultiplier)) : '$0'); text('result-detail', win ? '最終倍率 ' + multiplierText(finalMultiplier) + ' × 獎金池 ' + (1 + bountyBonus).toFixed(1) + 'X' : '完成準備回合 ' + Math.min(prepRounds, Math.max(0, round - 1)) + ' 回合 · 口袋 ' + pocketTotal() + ' 顆特殊彈'); setHint(win ? '獎金已結算。' : '這一輪結束，再試一次。', win ? 'success' : 'loss'); render(); }

ui.start.addEventListener('click', start); ui.restart.addEventListener('click', reset); ui.fire.addEventListener('click', fire);
ui['choice-ammo'].addEventListener('click', () => selectChoice('ammo')); ui['choice-bonus'].addEventListener('click', () => selectChoice('bonus')); ui['choice-crit'].addEventListener('click', () => selectChoice('crit')); ui['choice-freeze'].addEventListener('click', () => selectChoice('freeze')); ui['choice-bounty'].addEventListener('click', () => selectChoice('bounty'));
ui['load-crit'].addEventListener('click', () => loadSpecial('crit')); ui['load-freeze'].addEventListener('click', () => loadSpecial('freeze')); ui['load-bounty'].addEventListener('click', () => loadSpecial('bounty')); ui['load-skip'].addEventListener('click', skipLoad);
reset();
