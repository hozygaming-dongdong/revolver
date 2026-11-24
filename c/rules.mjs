export const STAKES = [10, 25, 50, 100, 200, 500, 1000];
export const LAUNCH_BALANCE = 10000;
export const ROUTES = [
  { place: 'Floodgate', cover: 'Pump Walk', rush: 'Flood Street' },
  { place: 'Container Yard', cover: 'Service Steps', rush: 'Load Bay' },
  { place: 'Ferry Approach', cover: 'Sea Wall', rush: 'Boarding Ramp' },
];
export const VALUES = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.25, 2, 5, 50];
export const JACKPOT = VALUES.length - 1;
export const MAX_SEALS = 9;

export function randomBelow(size) {
  const ceiling = 2 ** 32 - (2 ** 32 % size);
  const word = new Uint32Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return word[0] % size;
}

export function startRun(balance, stake) {
  if (!STAKES.includes(stake) || balance < stake) throw new RangeError('Unavailable stake');
  return { balance: balance - stake, stake, stage: 0, rounds: 5, seals: 0 };
}

export function planShot(run, route) {
  const cover = route === 'cover';
  const rounds = route === 'warden' ? Math.max(5, run.rounds) : Math.min(6, run.rounds + Number(cover));
  const seals = route === 'warden' ? 0 : Math.min(MAX_SEALS - run.seals, cover ? 1 : 3);
  return { route, rounds, carry: rounds - 1, seals };
}

export function resolveShot(run, plan, slot) {
  return slot < plan.rounds
    ? { next: { ...run, stage: run.stage + 1, rounds: plan.carry, seals: run.seals + plan.seals }, hit: true }
    : { next: run, hit: false };
}

export function openCrates(seals) {
  const total = (JACKPOT - seals) * 100 + 2;
  return VALUES.slice(seals).map((value, offset) => {
    const index = seals + offset;
    const weight = index === JACKPOT ? 2 : 100;
    return { index, value, weight, chance: weight / total };
  });
}

export function drawCrate(seals, random = randomBelow) {
  const available = openCrates(seals);
  let ticket = random(available.reduce((sum, crate) => sum + crate.weight, 0));
  return available.find(crate => (ticket -= crate.weight) < 0);
}

export const settle = (stake, crate) => Math.round(stake * crate.value * 100) / 100;
