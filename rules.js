const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 3;
  const ammoLimit = 4;
  const finalStage = 5;
  const bossShotLimit = 4;
  const bossHealth = 2;
  const chestTiers = [[860_351, 1], [80_000, 1.5], [59_549, 3], [100, 10]];

  const initialCylinder = () => Array.from({ length: slots }, (_, i) => i < startAmmo ? 'normal' : null);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const price = bet => bet / 5;
  const canBuy = (ammo, balance, cost) => ammo < ammoLimit && balance >= cost;
  const chamberIndex = (random = Math.random) => Math.floor(random() * slots);

  function loadAmmo(chambers, amount = 1, round = 'normal') {
    const next = [...chambers];
    let remaining = Math.min(amount, ammoLimit - countAmmo(chambers));
    for (let i = 0; i < slots && remaining > 0; i++) {
      if (next[i]) continue;
      next[i] = round;
      remaining--;
    }
    return next;
  }

  function shoot(chambers, selected) {
    const round = chambers[selected];
    return { round, chambers: round ? chambers.map((value, i) => i === selected ? null : value) : chambers };
  }

  function encounters(random = Math.random) {
    const rewardStage = chamberIndex(random);
    const firstThree = [0, 1, 2].map(i => i === rewardStage ? 'reward' : 'supply');
    return [...firstThree, random() < .25 ? 'gold' : 'supply'];
  }

  function openChest(bet, spentOnAmmo, boosted, random = Math.random) {
    let roll = Math.floor(random() * 1_000_000);
    const [, multiplier] = chestTiers.find(([weight]) => (roll -= weight) < 0);
    const prize = Math.min(bet * 10, bet * multiplier * (boosted ? 1.5 : 1));
    const floor = bet + spentOnAmmo;
    return { reward: Math.max(prize, floor), floorApplied: floor > prize, jackpot: multiplier === 10 };
  }

  return {
    slots, startAmmo, ammoLimit, finalStage, bossShotLimit, bossHealth, chestTiers,
    initialCylinder, countAmmo, price, canBuy, chamberIndex, loadAmmo, shoot, encounters, openChest,
  };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
