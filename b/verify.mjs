import test from 'node:test';
import assert from 'node:assert/strict';
import { START_BALANCE, MAX_SEALS, PRIZES, JACKPOT_SLOT, WEIGHT_TOTAL, loaded, prizeSlots, jackpotOdds, drawBountyIndex, randomIndex, newRun, takeRoute, beginShot, resolveShot, startDraw, settleDraw } from './engine.mjs';

const noEvent = n => n === 10 ? 9 : 0;
const firstEvent = () => 0;
const hit = (run, kind, pick = noEvent) => {
  const firing = beginShot(kind === 'boss' ? run : takeRoute(run, kind));
  return resolveShot(firing, firing.route.aim.findIndex(Boolean), pick);
};

test('the first junction has two fixed routes and an eligible junction rolls events at 30%', () => {
  for (let roll = 0; roll < 10; roll++) {
    const start = newRun(START_BALANCE, 100, noEvent);
    assert.deepEqual(start.offers.map(r => r.kind), ['conserve', 'charge']);
    const run = hit(start, 'conserve', n => n === 10 ? roll : 0);
    assert.equal(run.offers.length, roll < 3 ? 3 : 2);
    assert.equal(run.balance, 9900);
  }
});

test('five chambers from Armory persist on conserve and are spent on charge', () => {
  const start = hit(newRun(START_BALANCE, 100, noEvent), 'charge');
  const low = hit(start, 'charge', firstEvent);
  const armory = hit(low, 'armory');
  assert.equal(loaded(armory.chambers), 5);
  assert.equal(armory.tokens, low.tokens);
  assert.equal(loaded(takeRoute(armory, 'charge').route.aim), 5);
  assert.equal(loaded(takeRoute(armory, 'conserve').route.aim), 5);
  assert.equal(loaded(hit(armory, 'conserve').chambers), 5);
  assert.equal(loaded(hit(armory, 'charge').chambers), 4);
});

test('charging all four streets spends one round per street and Boss supply tops it to four', () => {
  const lateSupply = n => n === 10 ? 9 : n === 2 || n === 4 ? 1 : 0;
  let run = newRun(START_BALANCE, 100, lateSupply);
  for (const expected of [5, 4, 3, 2]) {
    run = hit(run, 'charge');
    assert.equal(loaded(run.chambers), expected);
  }
  assert.equal(run.tokens, 9);
  assert.equal(run.phase, 'boss');
  assert.equal(loaded(beginShot(run).route.aim), 4);
  assert.equal(loaded(hit(run, 'boss').chambers), 3);

  run = hit(hit(newRun(START_BALANCE, 100, lateSupply), 'charge'), 'charge');
  const supply = takeRoute(run, 'conserve').route;
  assert.equal(loaded(supply.aim), 5);
  assert.equal(supply.max, 0);
  assert.equal(loaded(hit(run, 'conserve').chambers), 5);
});

test('full conserve has three full cylinders followed by two five-round shots', () => {
  for (const supplyStage of [0, 1]) {
    let run = newRun(START_BALANCE, 100, n => n === 2 ? supplyStage : noEvent(n));
    for (const [i, expected] of [6, 6, 6, 5].entries()) {
      assert.equal(loaded(takeRoute(run, 'conserve').route.aim), expected);
      run = hit(run, 'conserve');
      assert.equal(loaded(run.chambers), i === 0 ? 6 : 5);
    }
    assert.equal(loaded(beginShot(run).route.aim), 5);
  }
});

test('empty stops the run, and only the final draw pays', () => {
  const run = newRun(START_BALANCE, 200, noEvent);
  const firing = beginShot(takeRoute(hit(run, 'charge'), 'charge'));
  const lost = resolveShot(firing, firing.route.aim.findIndex(v => !v));
  assert.equal(lost.payout, 0);
  assert.equal(lost.balance, 9800);
  assert.throws(() => startDraw(lost));
  assert.throws(() => beginShot(lost));
  let journey = run;
  for (let i = 0; i < 4; i++) journey = hit(journey, 'conserve');
  assert.equal(journey.phase, 'boss');
  assert.equal(journey.balance, 9800);
  assert.throws(() => startDraw(journey));
  const cleared = hit(journey, 'boss');
  assert.equal(cleared.balance, 9800);
  const paid = settleDraw(startDraw(cleared), JACKPOT_SLOT);
  assert.equal(paid.multiplier, 50);
  assert.equal(paid.balance, 19800);
  assert.throws(() => settleDraw(paid, 0));
});

test('seeded journeys exercise every route and preserve ammo, rarity and seal limits', () => {
  const kinds = new Set(), tiers = new Set();
  for (let seed = 1; seed <= 800; seed++) {
    let value = seed;
    const pick = n => ((value = (Math.imul(1664525, value) + 1013904223) >>> 0) >>> 8) % n;
    let run = newRun(START_BALANCE, 100, pick);
    let strongSupply = 0, strongCharge = 0;
    let reserved;
    for (let stage = 0; stage < 4; stage++) {
      const before = run.tokens;
      assert.deepEqual(run.offers.slice(0, 2).map(r => r.kind), ['conserve', 'charge']);
      const [safe, charge] = run.offers;
      const n = loaded(run.chambers);
      strongSupply += Number(safe.tier > 0);
      strongCharge += Number(charge.tier > 0);
      assert.equal(charge.resultCount, n - 1);
      assert.equal(charge.locked, n === 1);
      if (charge.tier === 2) assert.ok(n <= 4 || reserved === 'charge');
      for (const route of run.offers) {
        kinds.add(route.kind); tiers.add(`${route.kind}-${route.tier}`);
        assert.ok(before + route.max <= MAX_SEALS);
        if (route.kind === 'security') assert.equal(route.rewards.filter(v => v === 4).length, 2);
      }
      const available = run.offers.filter(route => !route.locked);
      const route = available[pick(available.length)];
      const firing = beginShot(takeRoute(run, route.kind));
      const live = firing.route.aim.flatMap((v, i) => v ? [i] : []);
      const index = live[pick(live.length)];
      run = resolveShot(firing, index, pick);
      assert.equal(run.tokens, before + route.rewards[index]);
      assert.equal(loaded(run.chambers), route.resultCount);
      assert.ok(loaded(run.chambers) >= 1);
      if (route.reserve) assert.equal(run.offers.find(offer => offer.kind === route.reserve).tier, 2);
      reserved = route.reserve;
      assert.deepEqual(prizeSlots(run.tokens).filter(v => v !== null).sort((a,b) => a-b), [...PRIZES].sort((a,b) => a-b).slice(before + route.rewards[index]));
    }
    assert.equal(strongSupply, 1);
    assert.ok(strongCharge <= 1);
    assert.equal(prizeSlots(run.tokens).length, 12);
    assert.ok(prizeSlots(run.tokens).filter(v => v !== null).length >= 3);
  }
  assert.equal(kinds.size, 5);
  assert.equal(tiers.size, 9);
});

test('the six shooting chambers are uniform and the 12 bounty chambers use exact weights', () => {
  for (let i = 0; i < 6; i++) assert.equal(randomIndex(6, () => i), i);
  const values = [4294967295, 8];
  assert.equal(randomIndex(6, () => values.shift()), 2);
  const weights = Array(12).fill(0);
  for (let i = 0; i < WEIGHT_TOTAL; i++) weights[drawBountyIndex((size) => {
    assert.equal(size, 1102);
    return i;
  })]++;
  assert.deepEqual(weights, [100, 2, ...Array(10).fill(100)]);
});

test('0, 3 and 9 seals replace the lowest prizes while the jackpot odds rise', () => {
  const sorted = [...PRIZES].sort((a,b) => a-b);
  for (const tokens of [0, 3, 9]) {
    const slots = prizeSlots(tokens);
    assert.equal(slots.length, 12);
    assert.equal(slots.filter(v => v === null).length, tokens);
    assert.deepEqual(slots.filter(v => v !== null).sort((a,b) => a-b), sorted.slice(tokens));
    assert.equal(slots[JACKPOT_SLOT], 50);
  }
  assert.deepEqual([0,3,9].map(jackpotOdds), [2/1102, 2/802, 2/202]);
});

test('the same seal can trigger repeatedly without credit or cap, until a prize settles once', () => {
  let state = { phase: 'drawing', tokens: 9, jackpot: 50, respins: 0, balance: 9900, bet: 100, payout: null };
  const repeatedSlot = prizeSlots(9).indexOf(null);
  for (let n = 1; n <= 75; n++) {
    state = settleDraw(state, repeatedSlot);
    assert.equal(state.phase, 'drawing');
    assert.equal(state.index, repeatedSlot);
    assert.equal(state.respins, n);
    assert.equal(state.jackpot, 50 + 2*n);
    assert.equal(state.balance, 9900);
    assert.equal(state.payout, null);
  }
  const ordinaryPaid = settleDraw(state, PRIZES.indexOf(2.25));
  assert.equal(ordinaryPaid.payout, 225);
  assert.equal(ordinaryPaid.balance, 10125);
  const won = settleDraw(state, JACKPOT_SLOT);
  assert.equal(won.multiplier, 200);
  assert.equal(won.payout, 20000);
  assert.equal(won.balance, 29900);
  assert.throws(() => settleDraw(won, repeatedSlot));
});
