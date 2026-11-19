export const BET = 100;
export const BET_OPTIONS = [10, 25, 50, 100, 200, 500, 1000];
export const START_BALANCE = 10000;
export const SLOTS = 6;
export const RISK_RETURN = 0.96;
export const count = chambers => chambers.filter(Boolean).length;
const payoutFor = (bet, survival) => survival === 1 ? bet : Math.floor(bet * RISK_RETURN / survival + 1e-8);
export const maxWinFor = bet => payoutFor(bet, [5, 4, 3, 2, 1].reduce((p, n) => p * n / SLOTS, 1));

export function newRun(balance = START_BALANCE, bet = BET) {
  if (!BET_OPTIONS.includes(bet) || balance < bet) throw new Error('Invalid or unaffordable demo bet.');
  return { phase: 'choice', stage: 0, balance: balance - bet, bet, chambers: [true, true, true, true, true, false], survival: 1, bank: bet, route: null, history: [], payout: null };
}

export function preview(run, route) {
  const chambers = [...run.chambers];
  const added = run.phase === 'choice' && route === 'supply' ? chambers.indexOf(false) : -1;
  if (added >= 0) chambers[added] = true;
  const chance = count(chambers) / SLOTS;
  return { chambers, added, chance, payout: payoutFor(run.bet, run.survival * chance) };
}

export function choose(run, route) {
  if (run.phase !== 'choice') throw new Error('A route can only be chosen at a junction.');
  const allowed = run.stage === 4 ? ['boss'] : ['supply', 'breach'];
  if (!allowed.includes(route)) throw new Error('Route unavailable at this stage.');
  return { ...run, phase: 'aim', route, chambers: preview(run, route).chambers };
}

export function beginShot(run) {
  if (run.phase !== 'aim') throw new Error('Shot already committed or unavailable.');
  return { ...run, phase: 'spinning' };
}

export function settleShot(run, index) {
  if (run.phase !== 'spinning' || !Number.isInteger(index) || index < 0 || index >= SLOTS) throw new Error('Invalid shot resolution.');
  const hit = run.chambers[index];
  const chance = count(run.chambers) / SLOTS;
  const bank = hit ? payoutFor(run.bet, run.survival * chance) : 0;
  const history = [...run.history, { route: run.route, hit, index, payout: bank }];
  if (!hit) return { ...run, phase: 'lost', bank: 0, payout: 0, history };
  const chambers = [...run.chambers];
  chambers[index] = false;
  const stage = run.stage + 1;
  return { ...run, phase: stage === 5 ? 'won' : 'choice', stage, chambers, survival: run.survival * chance, bank, balance: run.balance + (stage === 5 ? bank : 0), route: null, history, payout: stage === 5 ? bank : null };
}

export function cashOut(run) {
  if (run.phase !== 'choice' || run.stage < 1) throw new Error('Cash-out is unavailable now.');
  return { ...run, phase: 'cashed', payout: run.bank, balance: run.balance + run.bank };
}

export function randomChamber(next = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  let value;
  do { value = next(); } while (value >= 4294967292);
  return value % SLOTS;
}
