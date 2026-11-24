import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JACKPOT, ROUTES, VALUES, drawCrate, openCrates, planShot, resolveShot, settle, startRun,
} from './rules.mjs';

const first = () => startRun(10000, 100);
const expected = seals => openCrates(seals).reduce((sum, crate) => sum + crate.value * crate.chance, 0);

function audit(run, probability = 1, path = []) {
  if (run.stage === ROUTES.length) {
    const survival = probability * planShot(run, 'warden').rounds / 6;
    return [{ path: path.join(' → '), survival, seals: run.seals, rtp: survival * expected(run.seals) }];
  }
  return ['cover', 'rush'].flatMap(route => {
    const shot = planShot(run, route);
    return audit(resolveShot(run, shot, 0).next, probability * shot.rounds / 6, [...path, route]);
  });
}

test('route preview, uniform chamber outcomes and later ammo agree', () => {
  const run = first();
  assert.equal(run.balance, 9900);
  assert.deepEqual(planShot(run, 'cover'), { route: 'cover', rounds: 6, carry: 5, seals: 1 });
  const rush = planShot(run, 'rush');
  assert.deepEqual(rush, { route: 'rush', rounds: 5, carry: 4, seals: 3 });
  assert.equal(Array.from({ length: 6 }, (_, slot) => resolveShot(run, rush, slot).hit).filter(Boolean).length, 5);
  assert.equal(resolveShot(run, rush, 5).next, run);
  assert.equal(resolveShot(run, rush, 0).next.rounds, rush.carry);
});

test('crate weights sum to one, sealed crates cannot be drawn, and payout matches', () => {
  for (let seals = 0; seals <= 9; seals++) {
    const choices = openCrates(seals);
    assert.equal(choices.length, VALUES.length - seals);
    assert.ok(Math.abs(choices.reduce((sum, crate) => sum + crate.chance, 0) - 1) < 1e-12);
    assert.equal(drawCrate(seals, () => 0).index, seals);
    assert.equal(drawCrate(seals, size => size - 1).index, JACKPOT);
    assert.equal(settle(100, drawCrate(seals, size => size - 1)), 5000);
  }
});

test('all eight route strategies are below the 200% RTP ceiling', () => {
  const routes = audit(first());
  assert.equal(routes.length, 8);
  assert.ok(routes.every(route => route.rtp <= 2));
  assert.ok(routes[0].survival > routes.at(-1).survival);
  assert.ok(routes[0].seals < routes.at(-1).seals);
  for (const route of routes) {
    console.log(`${route.path} | Survival ${(route.survival*100).toFixed(2)}% | Seals ${route.seals} | RTP ${(route.rtp*100).toFixed(2)}%`);
  }
});
