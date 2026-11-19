export const START_BALANCE = 10000;
export const BETS = [10, 25, 50, 100, 200, 500, 1000];
export const PRIZES = [0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.5, 2, 2.5, 4, 8];
export const CAPS = [3, 5, 7, 9];
export const RARITIES = ['WHITE', 'BLUE', 'ORANGE'];
const ordinary = ['conserve', 'charge'];
export const loaded = chambers => chambers.filter(Boolean).length;
export const remaining = tokens => PRIZES.slice(tokens);

export function randomIndex(size, next = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const limit = Math.floor(4294967296 / size) * size;
  let value;
  do { value = next(); } while (value >= limit);
  return value % size;
}

function refill(chambers, amount) {
  const next = [...chambers];
  for (let i = 0; i < next.length && amount > 0; i++) {
    if (!next[i]) { next[i] = true; amount--; }
  }
  return next;
}

function offer(run, kind, tier, reserve) {
  const n = loaded(run.chambers);
  const aim = kind === 'conserve' && n < 5 ? refill(run.chambers, 1) : [...run.chambers];
  let ordinal = 0;
  const rewards = aim.map(live => {
    if (!live) return null;
    if (kind === 'security') return ordinal++ < 2 ? 4 : 1;
    return kind === 'conserve' ? tier : kind === 'charge' ? tier + 2 : kind === 'radio' ? 2 : 0;
  });
  const resultCount = kind === 'conserve' ? n : kind === 'armory' ? 5 : kind === 'boss' ? n - 1 : 4;
  return { kind, tier, aim, rewards, resultCount, reserve, max: Math.max(0, ...rewards) };
}

function pairs(run, reserve) {
  const space = CAPS[run.stage] - run.tokens;
  const safe = [0, 1, 2].filter(tier => (tier === 0 || !run.seen.includes(tier)) && tier <= space);
  const rush = [0, 1, 2].filter(tier => tier + 2 <= space);
  const options = safe.flatMap(s => rush.map(c => [s, c])).filter(([s, c]) => c + 2 > s && (!reserve || (reserve === 'conserve' ? s === 2 : c === 2)));
  const useful = options.filter(([s, c]) => loaded(run.chambers) === 5 || 5 * (c + 2 - s) > 12 - run.tokens - s);
  return useful.length ? useful : options;
}

export function packRoutes(run, pick = randomIndex, reserve = null) {
  const options = pairs(run, reserve);
  const [s, c] = options[pick(options.length)];
  const base = [offer(run, 'conserve', s), offer(run, 'charge', c)];
  const seen = s ? [...run.seen, s] : run.seen;
  const space = CAPS[run.stage] - run.tokens;
  const extras = [];
  if (!run.armory && run.stage < 2 && loaded(run.chambers) === 4) extras.push(offer(run, 'armory', 0));
  if (space >= 4 && c < 2) extras.push(offer(run, 'security', 1));
  if (run.stage < 3 && space >= 2 && c > 0) {
    const next = { ...run, stage: run.stage + 1, tokens: run.tokens + 2, chambers: [true, true, true, true, false, false], seen };
    const possible = ordinary.filter(kind => pairs(next, kind).length);
    if (possible.length) extras.push(offer(run, 'radio', 2, possible[pick(possible.length)]));
  }
  if (extras.length && pick(10) < 3) base.push(extras[pick(extras.length)]);
  return { ...run, seen, offers: base };
}

export function newRun(balance, bet, pick = randomIndex) {
  if (!BETS.includes(bet) || balance < bet) throw new Error('Invalid demo bet');
  return packRoutes({ phase: 'route', stage: 0, tokens: 0, chambers: [true, true, true, true, false, false], balance: balance - bet, bet, seen: [], armory: false, cleared: [], payout: null }, pick);
}

export function takeRoute(run, kind) {
  const route = run.phase === 'route' && run.offers.find(item => item.kind === kind);
  if (!route) throw new Error('Route unavailable');
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
  return stage === 4 ? next : packRoutes(next, pick, route.reserve);
}

export function startDraw(run) {
  if (run.phase !== 'bounty') throw new Error('Bounty draw unavailable');
  return { ...run, phase: 'drawing' };
}

export function settleDraw(run, index) {
  const multiplier = remaining(run.tokens)[index];
  if (run.phase !== 'drawing' || multiplier === undefined) throw new Error('Invalid bounty draw');
  const payout = run.bet * multiplier;
  return { ...run, phase: 'paid', multiplier, payout, balance: run.balance + payout, index };
}
