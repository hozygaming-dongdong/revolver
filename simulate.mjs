const targetTypes = ['ammo', 'bonus', 'crit', 'freeze', 'bounty'];
const base = {
  weights: { ammo: 42, bonus: 24, crit: 13, freeze: 12, bounty: 9 },
  ammo: [{ value: 1, weight: 50 }, { value: 2, weight: 35 }, { value: 3, weight: 15 }],
  special: [{ amount: 1, weight: 50 }, { amount: 2, weight: 32 }, { amount: 3, weight: 18 }],
  bounty: [{ bonus: .2, weight: 60 }, { bonus: .5, weight: 30 }, { bonus: 1, weight: 10 }],
};

const roll = (list, random = Math.random) => { let left = random() * list.reduce((sum, item) => sum + item.weight, 0); return list.find(item => (left -= item.weight) < 0); };
const sample = (params, amount, random = Math.random) => {
  const pool = [...targetTypes]; const result = [];
  while (result.length < amount) {
    const item = roll(pool.map(value => ({ value, weight: params.weights[value] })), random);
    const index = pool.indexOf(item.value); result.push(item.value); pool.splice(index, 1);
  }
  return result;
};
const addAmmo = (state, amount) => { state.ammo = Math.min(6, state.ammo + amount); };
const choose = (options, state, strategy) => {
  if (state.ammo < 2 && options.includes('ammo')) return 'ammo';
  if (strategy === 'safe') return options.includes('ammo') ? 'ammo' : options.includes('crit') ? 'crit' : options[0];
  if (strategy === 'greedy') return state.ammo >= 4 && options.includes('bonus') ? 'bonus' : options.includes('bounty') ? 'bounty' : options.includes('crit') ? 'crit' : options.includes('freeze') ? 'freeze' : options[0];
  if (strategy === 'combo') {
    if (options.includes('crit')) return 'crit';
    if (options.includes('freeze')) return 'freeze';
    if (options.includes('bounty')) return 'bounty';
    return options.includes('ammo') ? 'ammo' : options[0];
  }
  if (options.includes('ammo') && state.ammo <= 3) return 'ammo';
  const special = options.find(type => ['crit', 'freeze', 'bounty'].includes(type));
  return special || (options.includes('bonus') ? 'bonus' : options[0]);
};
const prepReward = (state, choice, params) => {
  if (choice === 'ammo') addAmmo(state, roll(params.ammo).value);
  else if (choice === 'bonus') state.bonus += roll(params.bounty).bonus;
  else state.pocket[choice] += roll(params.special).amount;
};
function bossPlay(state, strategy, params) {
  const chambers = Array(6).fill(null);
  for (let index = 0; index < Math.min(5, state.ammo); index++) chambers[index] = 'normal';
  let hp = 3, clock = 3, plan = [], critFired = 0, freezeFired = 0;
  for (let action = 0; action < 6; action++) {
    const loaded = chambers.filter(Boolean).length;
    const canLoad = loaded < 5 || chambers.includes('normal');
    if (canLoad) {
      let type = null;
      if (strategy === 'combo' || strategy === 'balanced') type = hp >= 2 && state.pocket.crit ? 'crit' : clock <= 2 && state.pocket.freeze ? 'freeze' : state.pocket.bounty ? 'bounty' : state.pocket.crit ? 'crit' : state.pocket.freeze ? 'freeze' : null;
      if (strategy === 'safe') type = state.pocket.crit ? 'crit' : state.pocket.freeze ? 'freeze' : state.pocket.bounty ? 'bounty' : null;
      if (strategy === 'greedy') type = state.pocket.bounty ? 'bounty' : state.pocket.crit ? 'crit' : state.pocket.freeze ? 'freeze' : null;
      if (type) { const index = loaded < 5 ? chambers.indexOf(null) : chambers.indexOf('normal'); chambers[index] = type; state.pocket[type]--; plan.push(type); }
    }
    if (!chambers.filter(Boolean).length) return { win: false, reason: 'no-ammo' };
    const index = Math.floor(Math.random() * 6); const type = chambers[index]; chambers[index] = null;
    if (!type) return { win: false, reason: 'empty' };
    let damage = type === 'crit' ? 2 : 1;
    const counts = { crit: plan.filter(value => value === 'crit').length, freeze: plan.filter(value => value === 'freeze').length };
    if (type === 'crit' && counts.crit >= 2 && critFired) damage++;
    if (type === 'freeze') { clock = Math.min(5, clock + (counts.freeze >= 2 && freezeFired ? 2 : 1)); freezeFired++; }
    hp -= damage; if (type === 'crit') critFired++; clock--;
    if (hp <= 0) return { win: true, reason: 'kill', special: plan.length };
    if (clock <= 0) return { win: false, reason: 'boss-attack' };
  }
  return { win: false, reason: 'timeout' };
}
function play(strategy, params, random = Math.random) {
  const state = { ammo: 6, pocket: { crit: 0, freeze: 0, bounty: 0 }, bonus: 0 };
  for (let round = 1; round <= 5; round++) {
    if (!state.ammo) return { win: false, phase: 'prep-empty', ammo: state.ammo, pocket: 0, bonus: state.bonus };
    const options = sample(params, round <= 2 ? 3 : 2, random);
    const choice = choose(options, state, strategy); state.ammo--; prepReward(state, choice, params);
  }
  const boss = bossPlay(state, strategy, params);
  return { win: boss.win, phase: boss.reason, ammo: state.ammo, pocket: state.pocket.crit + state.pocket.freeze + state.pocket.bounty, bonus: state.bonus, special: boss.special || 0 };
}

function evaluate(label, params, rounds = 50000) {
  const strategies = ['safe', 'balanced', 'combo', 'greedy']; const summary = { label };
  for (const strategy of strategies) {
    const totals = { win: 0, prepEmpty: 0, empty: 0, bossAttack: 0, pocket: 0, bonus: 0, special: 0 };
    for (let index = 0; index < rounds; index++) { const result = play(strategy, params); totals.win += result.win; totals.prepEmpty += result.phase === 'prep-empty'; totals.empty += result.phase === 'empty'; totals.bossAttack += result.phase === 'boss-attack'; totals.pocket += result.pocket; totals.bonus += result.bonus; totals.special += result.special; }
    summary[strategy] = { winRate: +(totals.win / rounds).toFixed(3), prepEmpty: +(totals.prepEmpty / rounds).toFixed(3), bossEmpty: +(totals.empty / rounds).toFixed(3), bossAttack: +(totals.bossAttack / rounds).toFixed(3), avgPocket: +(totals.pocket / rounds).toFixed(2), avgBonus: +(totals.bonus / rounds).toFixed(2), avgSpecialLoaded: +(totals.special / rounds).toFixed(2) };
  }
  return summary;
}

const candidates = [
  ['final-current', base],
  ['more-supply', { ...base, weights: { ammo: 44, bonus: 22, crit: 13, freeze: 12, bounty: 9 } }],
  ['more-special', { ...base, weights: { ammo: 38, bonus: 20, crit: 16, freeze: 15, bounty: 11 }, special: [{ amount: 1, weight: 48 }, { amount: 2, weight: 34 }, { amount: 3, weight: 18 }] }],
  ['balanced-bonus', { ...base, weights: { ammo: 40, bonus: 24, crit: 14, freeze: 13, bounty: 9 }, bounty: [{ bonus: .2, weight: 55 }, { bonus: .5, weight: 32 }, { bonus: 1, weight: 13 }] }],
  ['recommended', { ...base, weights: { ammo: 42, bonus: 24, crit: 13, freeze: 12, bounty: 9 }, special: [{ amount: 1, weight: 50 }, { amount: 2, weight: 32 }, { amount: 3, weight: 18 }] }],
];
for (const [label, params] of candidates) console.log(JSON.stringify(evaluate(label, params)));
