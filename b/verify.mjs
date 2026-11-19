import test from 'node:test';
import assert from 'node:assert/strict';
import { START_BALANCE, CAPS, PRIZES, loaded, remaining, randomIndex, newRun, takeRoute, beginShot, resolveShot, startDraw, settleDraw } from './engine.mjs';

const noEvent = n => n === 10 ? 9 : 0;
const firstEvent = () => 0;
const hit = (run, kind, pick = noEvent) => {
  const firing = beginShot(kind === 'boss' ? run : takeRoute(run, kind));
  return resolveShot(firing, firing.route.aim.findIndex(Boolean), pick);
};

test('the first junction has two fixed routes and exactly three of ten event rolls add a third', () => {
  for (let roll = 0; roll < 10; roll++) {
    const run = newRun(START_BALANCE, 100, n => n === 10 ? roll : 0);
    assert.deepEqual(run.offers.slice(0, 2).map(r => r.kind), ['conserve', 'charge']);
    assert.equal(run.offers.length, roll < 3 ? 3 : 2);
    assert.equal(run.balance, 9900);
  }
});

test('five chambers from Armory persist on conserve and are spent on charge', () => {
  const armory = hit(newRun(START_BALANCE, 100, firstEvent), 'armory');
  assert.equal(loaded(armory.chambers), 5);
  assert.equal(armory.tokens, 0);
  assert.equal(loaded(takeRoute(armory, 'charge').route.aim), 5);
  assert.equal(loaded(takeRoute(armory, 'conserve').route.aim), 5);
  assert.equal(loaded(hit(armory, 'conserve').chambers), 5);
  assert.equal(loaded(hit(armory, 'charge').chambers), 4);
});

test('empty stops the run, and only the final draw pays', () => {
  const run = newRun(START_BALANCE, 200, noEvent);
  const firing = beginShot(takeRoute(run, 'charge'));
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
  const paid = settleDraw(startDraw(cleared), remaining(cleared.tokens).length - 1);
  assert.equal(paid.multiplier, 8);
  assert.equal(paid.balance, 11400);
  assert.throws(() => settleDraw(paid, 0));
});

test('seeded journeys exercise every route and preserve all caps and rewards', () => {
  const kinds = new Set(), tiers = new Set();
  for (let seed = 1; seed <= 800; seed++) {
    let value = seed;
    const pick = n => ((value = (Math.imul(1664525, value) + 1013904223) >>> 0) >>> 8) % n;
    let run = newRun(START_BALANCE, 100, pick);
    const scarce = new Set();
    for (let stage = 0; stage < 4; stage++) {
      const before = run.tokens;
      assert.deepEqual(run.offers.slice(0, 2).map(r => r.kind), ['conserve', 'charge']);
      const safe = run.offers[0];
      if (safe.tier) { assert.ok(!scarce.has(safe.tier)); scarce.add(safe.tier); }
      for (const route of run.offers) {
        kinds.add(route.kind); tiers.add(`${route.kind}-${route.tier}`);
        assert.ok(before + route.max <= CAPS[stage]);
        if (route.kind === 'security') assert.equal(route.rewards.filter(v => v === 4).length, 2);
      }
      const route = run.offers[pick(run.offers.length)];
      const firing = beginShot(takeRoute(run, route.kind));
      const live = firing.route.aim.flatMap((v, i) => v ? [i] : []);
      const index = live[pick(live.length)];
      run = resolveShot(firing, index, pick);
      assert.equal(run.tokens, before + route.rewards[index]);
      assert.equal(loaded(run.chambers), route.resultCount);
      if (route.reserve) assert.equal(run.offers.find(offer => offer.kind === route.reserve).tier, 2);
      assert.deepEqual(remaining(run.tokens), PRIZES.slice(before + route.rewards[index]));
    }
    assert.ok(remaining(run.tokens).length >= 3);
  }
  assert.equal(kinds.size, 5);
  assert.equal(tiers.size, 9);
});

test('the six chambers and every remaining prize count use unbiased random indices', () => {
  for (let n = 3; n <= 12; n++) {
    for (let i = 0; i < n; i++) assert.equal(randomIndex(n, () => i), i);
  }
  const values = [4294967295, 8];
  assert.equal(randomIndex(6, () => values.shift()), 2);
});
