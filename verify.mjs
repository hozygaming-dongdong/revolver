import assert from 'node:assert/strict';
import rules from './rules.js';

const { slots, rounds, prepRounds, startAmmo, ammoDraw, finalDraw, shoot, drawAmmo, drawFinalMultiplier } = rules;

assert.equal(slots, 6);
assert.equal(rounds, 8);
assert.equal(prepRounds, 5);
assert.equal(startAmmo, 6);
assert.deepEqual(ammoDraw.map(({ value }) => value), [0, 1, 2]);
assert.deepEqual(ammoDraw.map(({ weight }) => weight), [5, 55, 40]);
assert.deepEqual(finalDraw.map(({ multiplier }) => multiplier), [1.2, 1.5, 2, 3, 10]);
assert.deepEqual(finalDraw.map(({ weight }) => weight), [40, 30, 16, 10, 4]);
assert.deepEqual(shoot(6, () => 0), { hit: true, ammo: 5 });
assert.deepEqual(shoot(1, () => .2), { hit: false, ammo: 1 });
assert.equal(drawAmmo(() => .01), 0);
assert.equal(drawAmmo(() => .06), 1);
assert.equal(drawAmmo(() => .99), 2);
assert.equal(drawFinalMultiplier(0, () => 0).multiplier, 1.2);
assert.equal(drawFinalMultiplier(1, () => 0).multiplier, 1.5);
assert.equal(drawFinalMultiplier(10, () => 0).multiplier, 10);

console.log('初版規則驗證通過');
