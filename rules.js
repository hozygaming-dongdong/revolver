const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 3;
  const ammoLimit = slots;
  const finalStage = 6;
  const bossShotLimit = 3;
  const bossHealth = 2;
  const chestTiers = {
    bronze: { name: '銅箱', encounter: 45, ammo: [5, 65, 28, 2], coin: [100, 0] },
    silver: { name: '銀箱', encounter: 43, ammo: [0, 50, 43, 7], coin: [85, 15] },
    gold: { name: '金箱', encounter: 12, ammo: [0, 0, 80, 20], coin: [40, 60] },
  };
  const prizeTables = [
    { multipliers: [1, 1.2, 1.5, 2], weights: [8200, 1300, 490, 10] },
    { multipliers: [1, 1.5, 3, 5], weights: [2000, 2628, 5322, 50] },
    { multipliers: [1, 2, 4, 10], weights: [1000, 2490, 6500, 10] },
  ];
  const prizeCaps = prizeTables.map(({ multipliers }) => multipliers.at(-1));

  const initialCylinder = () => Array.from({ length: slots }, (_, i) => i < startAmmo);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const price = bet => bet / 5;
  const canBuy = (ammo, mode) => mode === 'vault' ? ammo < 2 : mode === 'boss' && ammo === 1;
  const chamberIndex = (random = Math.random) => Math.floor(random() * slots);

  function loadAmmo(chambers, amount = 1) {
    const next = [...chambers];
    let remaining = Math.min(amount, ammoLimit - countAmmo(chambers));
    for (let i = 0; i < slots && remaining > 0; i++) {
      if (next[i]) continue;
      next[i] = true;
      remaining--;
    }
    return next;
  }

  function shoot(chambers, selected) {
    const hit = chambers[selected];
    return { hit, chambers: hit ? chambers.map((value, i) => i === selected ? false : value) : chambers };
  }

  function weightedIndex(weights, random = Math.random) {
    let roll = Math.floor(random() * weights.reduce((sum, weight) => sum + weight, 0));
    return weights.findIndex(weight => (roll -= weight) < 0);
  }

  function encounters(random = Math.random) {
    const types = Object.keys(chestTiers);
    const weights = types.map(type => chestTiers[type].encounter);
    const roll = () => types[weightedIndex(weights, random)];
    return Array.from({ length: finalStage - 1 }, () => ({ coin: roll(), ammo: roll() }));
  }

  // Spread possible rewards across the six pockets while preserving their total odds.
  function wheelSlots(weights, rewards) {
    const active = weights.flatMap((weight, tier) => weight > 0 ? [tier] : []);
    const order = active.length === 4 ? [0, 1, 2, 0, 1, 3] : Array.from({ length: slots }, (_, i) => active[i % active.length]);
    const counts = weights.map((_, tier) => order.filter(index => index === tier).length);
    const remaining = [...weights];
    return order.map(tier => {
      const weight = Math.ceil(remaining[tier] / counts[tier]);
      remaining[tier] -= weight;
      counts[tier]--;
      return { tier, reward: rewards[tier], weight };
    });
  }

  const supplyWheel = type => wheelSlots(chestTiers[type].ammo, [0, 1, 2, 3]);
  const coinWeights = (type, prizeLevel) => prizeLevel === 0 ? chestTiers[type].coin : [100, 0];
  const coinWheel = (type, prizeLevel) => wheelSlots(coinWeights(type, prizeLevel), [1, 2]);
  function finalWheel(bet, spent, prizeLevel) {
    const { multipliers, weights } = prizeTables[prizeLevel];
    return wheelSlots(weights, multipliers.map(value => Math.max(bet + spent, Math.round(bet * value))));
  }

  return {
    slots, startAmmo, ammoLimit, finalStage, bossShotLimit, bossHealth, chestTiers, prizeCaps,
    initialCylinder, countAmmo, price, canBuy, chamberIndex, loadAmmo, shoot, encounters,
    supplyWheel, coinWeights, coinWheel, finalWheel, weightedIndex,
  };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
