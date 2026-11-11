const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 5;
  const ammoLimit = 5;
  const finalStage = 5;
  const multiplierScale = 1000;
  const targetRtp = 970;

  function winningSequences(ammo, shots) {
    let ways = 1;
    for (let shot = 0; shot < shots; shot++) ways *= Math.max(0, ammo - shot);
    return ways;
  }

  const multipliers = [0, ...Array.from({ length: finalStage }, (_, i) =>
    targetRtp * slots ** (i + 1) / winningSequences(startAmmo, i + 1))];
  const payout = (bet, stage) => bet * multipliers[stage] / multiplierScale;
  const naturalFinishWays = winningSequences(startAmmo, finalStage);

  function price(bet, cleared, ammo) {
    const remaining = finalStage - cleared;
    const extraWays = winningSequences(ammo + 1, remaining) - winningSequences(ammo, remaining);
    // Fee = bet × added conditional finish probability ÷ natural full-round finish probability.
    return bet * extraWays * slots ** cleared / naturalFinishWays;
  }

  const initialCylinder = () => Array.from({ length: slots }, (_, slot) => slot < startAmmo);
  const countAmmo = chambers => chambers.filter(Boolean).length;
  const canBuy = (ammo, balance, cost) => ammo < ammoLimit && balance >= cost;
  const chamberIndex = (random = Math.random) => Math.floor(random() * slots);

  function loadAmmo(chambers) {
    const empty = chambers.indexOf(false);
    return countAmmo(chambers) >= ammoLimit ? chambers : chambers.map((loaded, i) => loaded || i === empty);
  }

  function shoot(chambers, selected) {
    const hit = chambers[selected];
    return { hit, chambers: hit ? chambers.map((loaded, i) => i === selected ? false : loaded) : chambers };
  }

  return { slots, startAmmo, ammoLimit, multiplierScale, multipliers, finalStage, payout, price, initialCylinder, countAmmo, canBuy, chamberIndex, loadAmmo, shoot };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
