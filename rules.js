const revolverRules = (() => {
  const slots = 6;
  const startAmmo = 5;
  const ammoLimit = 5;
  const multipliers = [0, 115, 172, 260, 387, 583, 875];
  const finalStage = multipliers.length - 1;
  const ammoPrices = [0, 29, 48, 63, 102, 145];
  const payout = (bet, stage) => bet * multipliers[stage] / 100;
  const price = (bet, cleared) => bet * ammoPrices[cleared] / 100;

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

  return { slots, startAmmo, ammoLimit, multipliers, finalStage, payout, price, initialCylinder, countAmmo, canBuy, chamberIndex, loadAmmo, shoot };
})();

if (typeof module !== 'undefined') module.exports = revolverRules;
