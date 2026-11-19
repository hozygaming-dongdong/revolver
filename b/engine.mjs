export const START_BALANCE = 10000;
export const BETS = [10, 25, 50, 100, 200, 500, 1000];
export const PRIZES = [0.5, 50, 4.5, 2.25, 2, 1.5, 1.25, 1, 1, 0.75, 0.75, 0.5];
export const JACKPOT = 50;
export const JACKPOT_SLOT = PRIZES.indexOf(JACKPOT);
const ordinaryWeight = 100, jackpotWeight = 2;
export const WEIGHT_TOTAL = ordinaryWeight * (PRIZES.length - 1) + jackpotWeight;
const lowSlots = PRIZES.map((_, i) => i).sort((a, b) => PRIZES[a] - PRIZES[b]);
export const MAX_SEALS = 9;
export const RARITIES = ['WHITE', 'BLUE', 'ORANGE'];
export const loaded = chambers => chambers.filter(Boolean).length;
export const prizeSlots = (tokens, jackpot = JACKPOT) => PRIZES.map((value, i) => lowSlots.indexOf(i) < tokens ? null : i === JACKPOT_SLOT ? jackpot : value);
export const jackpotOdds = tokens => jackpotWeight / (WEIGHT_TOTAL - ordinaryWeight * tokens);
export const ordinaryOdds = ordinaryWeight / WEIGHT_TOTAL;

export function randomIndex(size, next = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const limit = Math.floor(4294967296 / size) * size;
  let value;
  do { value = next(); } while (value >= limit);
  return value % size;
}

export function drawBountyIndex(pick = randomIndex) {
  let ticket = pick(WEIGHT_TOTAL);
  for (let i = 0; i < PRIZES.length; i++) {
    ticket -= i === JACKPOT_SLOT ? jackpotWeight : ordinaryWeight;
    if (ticket < 0) return i;
  }
  throw new Error('Invalid bounty ticket');
}

function refill(chambers, amount) {
  const next = [...chambers];
  for (let i = 0; i < next.length && amount > 0; i++) {
    if (!next[i]) { next[i] = true; amount--; }
  }
  return next;
}

export const bossAim = chambers => refill(chambers, 4 - loaded(chambers));

function offer(run, kind, tier, reserve) {
  const n = loaded(run.chambers);
  const space = MAX_SEALS - run.tokens;
  const loadLimit = run.stage < 3 ? 6 : 5;
  const aim = kind === 'boss' ? bossAim(run.chambers) : refill(run.chambers, kind === 'conserve' && n < loadLimit ? 1 : 0);
  const locked = kind === 'charge' && n === 1;
  const seals = kind === 'conserve' ? Number(tier === 2) : kind === 'charge' && !locked ? tier + 3 : kind === 'radio' ? 2 : 0;
  let ordinal = 0;
  const rewards = aim.map(live => {
    if (!live) return null;
    return Math.min(space, kind === 'security' ? (ordinal++ < 2 ? 4 : 1) : seals);
  });
  const carryLimit = run.stage === 0 ? 6 : 5;
  const resultCount = kind === 'charge' || kind === 'boss' ? loaded(aim) - 1 : kind === 'armory' ? 5 : kind === 'conserve' ? Math.min(carryLimit, n + (tier ? 2 : 0)) : n;
  return { kind, tier, aim, rewards, resultCount, reserve, locked, max: Math.max(0, ...rewards) };
}

function packRoutes(run, pick, reserved) {
  const n = loaded(run.chambers), space = MAX_SEALS - run.tokens;
  const safeTier = run.stage === run.supplyStage ? run.supplyTier : 0;
  const rushTier = run.stage === run.chargeStage && n > 1 && space > 3 ? (n <= 4 || reserved === 'charge' ? 2 : 1) : 0;
  const base = [offer(run, 'conserve', safeTier), offer(run, 'charge', rushTier)];
  const extras = [];
  if (!run.armory && run.stage < 3 && n < 5) extras.push(offer(run, 'armory', 0));
  if (run.stage > 0 && space >= 4 && n >= 2 && rushTier < 2) extras.push(offer(run, 'security', 1));
  if (run.stage > 0 && run.stage < 3 && space >= 2) {
    const destinations = [];
    if (run.supplyStage > run.stage) destinations.push('conserve');
    if (run.chargeStage > run.stage && n >= 2 && n <= 5 && space >= 6) destinations.push('charge');
    if (destinations.length) extras.push(offer(run, 'radio', 2, destinations[pick(destinations.length)]));
  }
  if (extras.length && pick(10) < 3) base.push(extras[pick(extras.length)]);
  return { ...run, offers: base };
}

export function newRun(balance, bet, pick = randomIndex) {
  if (!BETS.includes(bet) || balance < bet) throw new Error('Invalid demo bet');
  const supplyStage = 1 + pick(2), supplyTier = pick(4) === 0 ? 2 : 1;
  const chargeStage = [supplyStage, supplyStage, 1, 2, 3][pick(5)];
  return packRoutes({ phase: 'route', stage: 0, tokens: 0, jackpot: JACKPOT, respins: 0, chambers: [true, true, true, true, true, true], balance: balance - bet, bet, supplyStage, supplyTier, chargeStage, armory: false, cleared: [], payout: null }, pick);
}

export function takeRoute(run, kind) {
  const route = run.phase === 'route' && run.offers.find(item => item.kind === kind);
  if (!route || route.locked) throw new Error('Route unavailable');
  return { ...run, phase: 'ready', route };
}

export function beginShot(run) {
  if (run.phase === 'boss') return { ...run, phase: 'spinning', route: offer(run, 'boss') };
  if (run.phase !== 'ready') throw new Error('Shot unavailable');
  return { ...run, phase: 'spinning' };
}

export function resolveShot(run, index, pick = randomIndex) {
  if (run.phase !== 'spinning' || !Number.isInteger(index) || index < 0 || index >= 6) throw new Error('Invalid shot');
  const { route } = run;
  if (!route.aim[index]) return { ...run, phase: 'lost', payout: 0, index };
  const after = [...route.aim];
  after[index] = false;
  const chambers = refill(after, route.resultCount - loaded(after));
  if (route.kind === 'boss') return { ...run, phase: 'bounty', chambers, index };
  const gain = route.rewards[index];
  const tokens = run.tokens + gain;
  const stage = run.stage + 1;
  const next = { ...run, phase: stage === 4 ? 'boss' : 'route', stage, tokens, chambers, gain, index, armory: run.armory || route.kind === 'armory', cleared: [...run.cleared, route.kind] };
  if (route.reserve === 'conserve') { next.supplyStage = stage; next.supplyTier = 2; }
  if (route.reserve === 'charge') next.chargeStage = stage;
  return stage === 4 ? next : packRoutes(next, pick, route.reserve);
}

export function startDraw(run) {
  if (run.phase !== 'bounty') throw new Error('Bounty draw unavailable');
  return { ...run, phase: 'drawing' };
}

export function settleDraw(run, index) {
  if (run.phase !== 'drawing' || !Number.isInteger(index) || index < 0 || index >= PRIZES.length) throw new Error('Invalid bounty draw');
  const multiplier = prizeSlots(run.tokens, run.jackpot)[index];
  if (multiplier === null) return { ...run, jackpot: run.jackpot + 2, respins: run.respins + 1, index };
  const payout = run.bet * multiplier;
  return { ...run, phase: 'paid', multiplier, payout, balance: run.balance + payout, index };
}
