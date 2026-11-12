const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 3;
  const ammoLimit = slots;
  const finalStage = 6;
  const bossShotLimit = 4;
  const bossHealth = 3;
  const chestTiers = {
    bronze: { name: '銅箱', encounter: 45, ammo: [5, 65, 28, 2], coin: [55, 34, 10, 1] },
    silver: { name: '銀箱', encounter: 43, ammo: [0, 50, 43, 7], coin: [15, 25, 30, 30] },
    gold: { name: '金箱', encounter: 12, ammo: [0, 0, 80, 20], coin: [0, 0, 35, 65] },
  };
  const coinMultipliers = [1, 1.2, 1.5, 2];
  const maxBaseMultiplier = 10;
  const finalChestWeights = [200_000, 200_000, 250_000, 247_700, 102_200, 100];
  const finalChestMultipliers = [1, 1.5, 2, 3, 5, maxBaseMultiplier];

  const initialCylinder = () => Array.from({ length: slots }, (_, i) => i < startAmmo);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const price = bet => bet / 5;
  const canBuy = (ammo, mode) => mode === 'vault' && ammo < 3;
  const ammoPurchaseCount = (ammo, mode) => mode === 'boss-supply' ? Math.max(0, bossHealth - ammo) : Number(canBuy(ammo, mode));
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

  function drawBossPair(random = Math.random) {
    if (random() < .6) return null;
    const closer = random() < .5 ? 0 : 1;
    return [1, 2].map((health, i) => ({ health, distance: i === closer ? 2 : 3 }));
  }

  function advanceBossPair(pair, target, hit) {
    return pair.map((boss, i) => {
      if (!boss.health) return boss;
      const struck = hit && i === target;
      const health = boss.health - Number(struck);
      const distance = health ? boss.distance + (struck ? 1 : -1) : boss.distance;
      return { health, distance };
    });
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
  const coinWheel = type => wheelSlots(chestTiers[type].coin, coinMultipliers);
  const stackMultiplier = (current, earned) => Math.round(current * earned * 100_000) / 100_000;
  function finalWheel(bet, spent, multiplier) {
    const baseRewards = finalChestMultipliers.map(value => Math.max(bet + spent, bet * value));
    return wheelSlots(finalChestWeights, baseRewards).map(({ tier, weight, reward }) => ({
      tier, weight, baseMultiplier: finalChestMultipliers[tier], baseReward: reward, reward: Math.round(reward * multiplier),
    }));
  }

  return {
    slots, startAmmo, ammoLimit, finalStage, bossShotLimit, bossHealth, chestTiers, coinMultipliers, maxBaseMultiplier,
    initialCylinder, countAmmo, price, canBuy, ammoPurchaseCount, chamberIndex, loadAmmo, shoot, encounters,
    supplyWheel, coinWheel, stackMultiplier, finalWheel, weightedIndex, drawBossPair, advanceBossPair,
  };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
