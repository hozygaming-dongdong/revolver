const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 3;
  const ammoLimit = slots;
  const finalStage = 6;
  const bossShotLimit = 4;
  const bossHealth = 2;
  const chestTiers = {
    bronze: { name: '銅箱', encounter: 40, ammo: [50, 35, 12, 3], coin: [55, 34, 10, 1] },
    silver: { name: '銀箱', encounter: 40, ammo: [20, 37, 35, 8], coin: [15, 25, 30, 30] },
    gold: { name: '金箱', encounter: 20, ammo: [10, 25, 50, 15], coin: [5, 10, 25, 60] },
  };
  const coinMultipliers = [1, 1.2, 1.5, 2];
  const maxBaseMultiplier = 10;
  const finalChestWeights = [775_427, 80_000, 144_473, 100];
  const finalChestMultipliers = [1, 1.5, 3, maxBaseMultiplier];

  const initialCylinder = () => Array.from({ length: slots }, (_, i) => i < startAmmo);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const price = bet => bet / 5;
  const canBuy = (ammo, balance, cost) => ammo === 1 && balance >= cost;
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

  // Split the two common rewards across a pair of pockets each without changing their total odds.
  function wheelSlots(weights, rewards) {
    const first = Math.ceil(weights[0] / 2);
    const second = Math.ceil(weights[1] / 2);
    const pockets = [first, second, weights[2], weights[0] - first, weights[1] - second, weights[3]];
    return [0, 1, 2, 0, 1, 3].map((tier, i) => ({ tier, reward: rewards[tier], weight: pockets[i] }));
  }

  const supplyWheel = type => wheelSlots(chestTiers[type].ammo, [0, 1, 2, 3]);
  const coinWheel = type => wheelSlots(chestTiers[type].coin, coinMultipliers);
  const stackMultiplier = (current, earned) => Math.round(current * earned * 100_000) / 100_000;
  function finalWheel(bet, spent, multiplier) {
    const baseRewards = finalChestMultipliers.map(value => Math.max(bet + spent, bet * value));
    return wheelSlots(finalChestWeights, baseRewards).map(({ tier, weight, reward }) => ({
      tier, weight, baseReward: reward, reward: Math.round(reward * multiplier),
    }));
  }

  return {
    slots, startAmmo, ammoLimit, finalStage, bossShotLimit, bossHealth, chestTiers, coinMultipliers, maxBaseMultiplier,
    initialCylinder, countAmmo, price, canBuy, chamberIndex, loadAmmo, shoot, encounters,
    supplyWheel, coinWheel, stackMultiplier, finalWheel, weightedIndex,
  };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
