import assert from 'node:assert/strict';
import rules from './rules.js';

const { slots, rounds, prepRounds, bossRounds, startAmmo, bossMaxAmmo, ammoDraw, specialDraw, finalDraw,
  initialCylinder, countAmmo, loadRound, drawAmmo, drawSpecial, drawFinalMultiplier, chamberIndex } = rules;

assert.equal(slots, 6);
assert.equal(rounds, 8);
assert.equal(prepRounds, 5);
assert.equal(bossRounds, 3);
assert.equal(startAmmo, 6);
assert.equal(bossMaxAmmo, 5);
assert.equal(countAmmo(initialCylinder()), 6);
assert.deepEqual(ammoDraw.map(({ value }) => value), [0, 1, 2]);
assert.deepEqual(ammoDraw.map(({ weight }) => weight), [10, 55, 35]);
assert.deepEqual(specialDraw.map(({ type }) => type), ['crit', 'freeze', 'bounty']);
assert.deepEqual(finalDraw.map(({ multiplier }) => multiplier), [1, 2, 3, 5, 10]);
const chambers = initialCylinder();
chambers[0] = null;
chambers[1] = null;
assert.equal(loadRound(chambers, 'crit', bossMaxAmmo), true);
assert.equal(countAmmo(chambers), 5);
assert.equal(loadRound(chambers, 'freeze', bossMaxAmmo), false);
assert.equal(drawAmmo(() => .01), 0);
assert.equal(drawAmmo(() => .11), 1);
assert.equal(drawAmmo(() => .99), 2);
assert.equal(drawSpecial(() => .01), 'crit');
assert.equal(drawSpecial(() => .35), 'freeze');
assert.equal(drawSpecial(() => .68), 'bounty');
assert.equal(drawFinalMultiplier(() => 0), 1);
assert.equal(drawFinalMultiplier(() => .99), 10);
assert.deepEqual([0, .2, .999].map(value => chamberIndex(() => value)), [0, 1, 5]);

console.log('規則驗證通過');
