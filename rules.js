const revolverRules = (() => {
  const slots = 6;
  const rounds = 8;
  const prepRounds = 5;
  const startAmmo = 6;
  const ammoDraw = [
    { value: 0, weight: 5 },
    { value: 1, weight: 55 },
    { value: 2, weight: 40 },
  ];
  const finalDraw = [
    { multiplier: 1.2, weight: 40 },
    { multiplier: 1.5, weight: 30 },
    { multiplier: 2, weight: 16 },
    { multiplier: 3, weight: 10 },
    { multiplier: 10, weight: 4 },
  ];
  const weightedIndex = (items, random = Math.random) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = random() * total;
    return items.findIndex(item => (roll -= item.weight) < 0);
  };
  const initialCylinder = () => Array.from({ length: slots }, () => true);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const loadAmmo = (chambers, amount) => {
    const next = [...chambers];
    for (let i = 0; i < next.length && amount > 0; i++) {
      if (next[i]) continue;
      next[i] = true;
      amount--;
    }
    return next;
  };
  const drawAmmo = (random = Math.random) => ammoDraw[weightedIndex(ammoDraw, random)].value;
  const drawFinalMultiplier = (up, random = Math.random) => {
    const index = weightedIndex(finalDraw, random);
    const finalIndex = Math.min(finalDraw.length - 1, index + up);
    return { ...finalDraw[finalIndex], baseMultiplier: finalDraw[index].multiplier };
  };
  const chamberIndex = (random = Math.random) => Math.floor(random() * slots);
  return { slots, rounds, prepRounds, startAmmo, ammoDraw, finalDraw, initialCylinder, countAmmo, loadAmmo, drawAmmo, drawFinalMultiplier, chamberIndex };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
