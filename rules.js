const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 3;
  const ammoLimit = 4;
  const finalStage = 5;
  const bossShotLimit = 4;
  const bossHealth = 2;
  const ammoChests = {
    bronze: { name: '銅箱', encounter: 40, drops: [50, 35, 12, 3] },
    silver: { name: '銀箱', encounter: 40, drops: [35, 40, 20, 5] },
    gold: { name: '金箱', encounter: 20, drops: [22, 32, 30, 16] },
  };
  const finalChestWeights = [610_911, 80_000, 308_989, 100];
  const finalChestMultipliers = [1, 1.5, 3, 10];

  const initialCylinder = () => Array.from({ length: slots }, (_, i) => i < startAmmo);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const price = bet => bet / 5;
  const canBuy = (ammo, balance, cost) => ammo <= 2 && balance >= cost;
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
    const types = Object.keys(ammoChests);
    const weights = types.map(type => ammoChests[type].encounter);
    return Array.from({ length: finalStage - 1 }, () => types[weightedIndex(weights, random)]);
  }

  // Split the two common rewards across a pair of pockets each without changing their total odds.
  function wheelSlots(weights, rewards) {
    const first = Math.ceil(weights[0] / 2);
    const second = Math.ceil(weights[1] / 2);
    const pockets = [first, second, weights[2], weights[0] - first, weights[1] - second, weights[3]];
    return [0, 1, 2, 0, 1, 3].map((tier, i) => ({ tier, reward: rewards[tier], weight: pockets[i] }));
  }

  const supplyWheel = type => wheelSlots(ammoChests[type].drops, [0, 1, 2, 3]);
  const finalWheel = (bet, spent) => wheelSlots(finalChestWeights,
    finalChestMultipliers.map(multiplier => Math.max(bet + spent, bet * multiplier)));

  return {
    slots, startAmmo, ammoLimit, finalStage, bossShotLimit, bossHealth, ammoChests,
    initialCylinder, countAmmo, price, canBuy, chamberIndex, loadAmmo, shoot, encounters, supplyWheel, finalWheel, weightedIndex,
  };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
