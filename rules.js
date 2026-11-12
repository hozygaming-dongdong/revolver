const revolverRules = (() => {
  const slots = 6;
  const rounds = 8;
  const prepRounds = 5;
  const bossRounds = 3;
  const startAmmo = 6;
  const bossMaxAmmo = 5;
  const ammoDraw = [
    { value: 1, weight: 50 },
    { value: 2, weight: 35 },
    { value: 3, weight: 15 },
  ];
  const specialDraw = [
    { type: 'crit', amount: 1, weight: 12 },
    { type: 'crit', amount: 2, weight: 8 },
    { type: 'crit', amount: 3, weight: 4 },
    { type: 'freeze', amount: 1, weight: 12 },
    { type: 'freeze', amount: 2, weight: 8 },
    { type: 'freeze', amount: 3, weight: 4 },
    { type: 'bounty', amount: 1, weight: 12 },
    { type: 'bounty', amount: 2, weight: 8 },
    { type: 'bounty', amount: 3, weight: 4 },
    { type: 'normal', amount: 1, weight: 18 },
    { type: 'normal', amount: 2, weight: 10 },
  ];
  const bountyDraw = [
    { bonus: 0.2, weight: 60 },
    { bonus: 0.5, weight: 30 },
    { bonus: 1, weight: 10 },
  ];
  const finalDraw = [
    { multiplier: 1, weight: 40 },
    { multiplier: 2, weight: 30 },
    { multiplier: 3, weight: 16 },
    { multiplier: 5, weight: 10 },
    { multiplier: 10, weight: 4 },
  ];
  const weightedIndex = (items, random = Math.random) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = random() * total;
    return items.findIndex(item => (roll -= item.weight) < 0);
  };
  const initialCylinder = () => Array.from({ length: slots }, () => 'normal');
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const loadRound = (chambers, type, limit = slots) => {
    if (countAmmo(chambers) >= limit) return false;
    const index = chambers.findIndex(value => !value);
    if (index < 0) return false;
    chambers[index] = type;
    return true;
  };
  const drawAmmo = (random = Math.random) => ammoDraw[weightedIndex(ammoDraw, random)].value;
  const drawSpecial = (random = Math.random) => specialDraw[weightedIndex(specialDraw, random)];
  const drawFinalMultiplier = (random = Math.random) => finalDraw[weightedIndex(finalDraw, random)].multiplier;
  const chamberIndex = (random = Math.random) => Math.floor(random() * slots);
  return { slots, rounds, prepRounds, bossRounds, startAmmo, bossMaxAmmo, ammoDraw, specialDraw, bountyDraw, finalDraw, initialCylinder, countAmmo, loadRound, drawAmmo, drawSpecial, drawFinalMultiplier, chamberIndex };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
