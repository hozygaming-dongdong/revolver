import test from 'node:test';
import assert from 'node:assert/strict';
import { BET, BET_OPTIONS, START_BALANCE, maxWinFor, count, newRun, preview, choose, beginShot, settleShot, cashOut, randomChamber } from './a/engine.mjs';

function hit(run, route) {
  const ready = beginShot(choose(run, route));
  return settleShot(ready, ready.chambers.findIndex(Boolean));
}

test('five initial live chambers, with no extra inventory', () => {
  const run = newRun();
  assert.equal(run.chambers.length, 6);
  assert.equal(count(run.chambers), 5);
  assert.throws(() => cashOut(run));
});

test('supply loads one cartridge before firing and spends it normally', () => {
  const run = newRun(), offer = preview(run, 'supply');
  assert.equal(offer.added, 5);
  assert.equal(count(offer.chambers), 6);
  assert.equal(offer.chance, 1);
  assert.equal(offer.payout, 100);
  const ready = choose(run, 'supply');
  assert.deepEqual(ready.chambers, offer.chambers);
  assert.equal(preview(ready, 'supply').added, -1);
  const next = settleShot(beginShot(ready), offer.added);
  assert.equal(count(next.chambers), 5);
  assert.equal(next.chambers[offer.added], false);
  assert.equal(next.bank, offer.payout);
  assert.equal(count(run.chambers), 5);
});

test('after a breach, supply has better odds but a lower payout', () => {
  const next = hit(newRun(), 'breach');
  assert.equal(count(next.chambers), 4);
  assert.equal(next.bank, 115);
  assert.equal(preview(next, 'supply').chance, 5 / 6);
  assert.equal(preview(next, 'breach').chance, 4 / 6);
  assert.equal(preview(next, 'supply').payout, 138);
  assert.equal(preview(next, 'breach').payout, 172);
  assert.equal(count(preview(next, 'supply').chambers), 5);
  assert.equal(count(preview(next, 'breach').chambers), 4);
  assert.equal(count(hit(next, 'supply').chambers), 4);
  assert.equal(count(hit(next, 'breach').chambers), 3);
});

test('empty chamber ends the run and does not consume a live cartridge', () => {
  const spin = beginShot(choose(newRun(), 'breach'));
  const lost = settleShot(spin, 5);
  assert.equal(lost.phase, 'lost');
  assert.equal(lost.payout, 0);
  assert.equal(count(lost.chambers), 5);
  assert.throws(() => cashOut(lost));
  assert.throws(() => choose(lost, 'supply'));
});

test('committed and settled shots cannot be cashed out or resolved twice', () => {
  const ready = choose(hit(newRun(), 'supply'), 'breach');
  assert.throws(() => cashOut(ready));
  assert.throws(() => choose(ready, 'supply'));
  const spin = beginShot(ready);
  assert.throws(() => beginShot(spin));
  const done = settleShot(spin, spin.chambers.findIndex(Boolean));
  assert.throws(() => settleShot(done, 0));
});

test('cash-out pays the shown total once, with no added stake', () => {
  const junction = hit(newRun(), 'breach');
  const paid = cashOut(junction);
  assert.equal(paid.payout, junction.bank);
  assert.equal(paid.payout - BET, 15);
  assert.equal(paid.balance, START_BALANCE + 15);
  assert.throws(() => cashOut(paid));
});

test('wallet deducts one stake per run and credits only terminal payouts', () => {
  const first = newRun();
  assert.equal(first.balance, START_BALANCE - BET);
  const junction = hit(first, 'breach');
  assert.equal(junction.balance, first.balance);
  const paid = cashOut(junction);
  const second = newRun(paid.balance);
  assert.equal(second.balance, START_BALANCE + 15 - BET);
  const spin = beginShot(choose(second, 'breach'));
  assert.equal(settleShot(spin, spin.chambers.findIndex(v => !v)).balance, second.balance);
  assert.throws(() => newRun(BET - 1));
  assert.equal(newRun(BET).balance, 0);
});

test('all-supply streets return the stake until the single risky boss shot', () => {
  let run = newRun();
  for (let i = 0; i < 4; i++) {
    assert.equal(preview(run, 'supply').chance, 1);
    run = hit(run, 'supply');
    assert.equal(count(run.chambers), 5);
    assert.equal(run.bank, BET);
    assert.equal(run.balance, START_BALANCE - BET);
  }
  const won = hit(run, 'boss');
  assert.equal(won.payout, 115);
  assert.equal(won.balance, START_BALANCE - BET + won.payout);
  assert.throws(() => cashOut(won));
  assert.throws(() => settleShot(won, 0));
});

test('all sixteen paths reach one fixed boss without an ammo grant', () => {
  const wins = [];
  for (let bits = 0; bits < 16; bits++) {
    let run = newRun();
    for (let street = 0; street < 4; street++) run = hit(run, bits & (1 << street) ? 'breach' : 'supply');
    assert.equal(run.stage, 4);
    const carried = count(run.chambers);
    assert.ok(carried >= 1 && carried <= 5);
    assert.equal(count(choose(run, 'boss').chambers), carried);
    assert.throws(() => choose(run, 'supply'));
    assert.equal(cashOut(run).payout, run.bank);
    const won = hit(run, 'boss');
    assert.equal(won.phase, 'won');
    assert.equal(won.history.length, 5);
    wins.push(won.payout);
  }
  assert.equal(Math.max(...wins), maxWinFor(BET));
  assert.equal(maxWinFor(BET), 6220);
});

test('each selectable bet is deducted once and drives quotes, settlement and maximum', () => {
  assert.equal(START_BALANCE, 10000);
  for (const bet of BET_OPTIONS) {
    let run = newRun(START_BALANCE, bet);
    assert.equal(run.balance, START_BALANCE - bet);
    assert.equal(preview(run, 'supply').payout, bet);
    const offer = preview(run, 'breach');
    run = hit(run, 'breach');
    assert.equal(run.bank, Math.floor(bet * 0.96 / (5 / 6)));
    assert.equal(run.bank, offer.payout);
    assert.equal(cashOut(run).balance, START_BALANCE - bet + offer.payout);
    for (let i = 1; i < 4; i++) run = hit(run, 'breach');
    assert.equal(hit(run, 'boss').payout, maxWinFor(bet));
  }
  assert.throws(() => newRun(49, 50));
  assert.throws(() => newRun(10000, 125));
});

test('all-breach jackpot is genuinely reachable with the last cartridge', () => {
  let run = newRun();
  for (let i = 0; i < 4; i++) run = hit(run, 'breach');
  assert.equal(count(run.chambers), 1);
  assert.equal(run.bank, 1036);
  const won = hit(run, 'boss');
  assert.equal(count(won.chambers), 0);
  assert.equal(won.payout, 6220);
  assert.ok(Math.abs(won.survival - 5 * 4 * 3 * 2 / 6 ** 5) < 1e-12);
});

test('optimal stopping has no guaranteed positive return loop', () => {
  function value(run) {
    if (run.phase === 'won') return run.payout;
    const routes = run.stage === 4 ? ['boss'] : ['supply', 'breach'];
    const choices = routes.map(route => preview(run, route).chance * value(hit(run, route)));
    if (run.stage > 0) choices.push(run.bank);
    return Math.max(...choices);
  }
  assert.ok(value(newRun()) <= BET + 1e-8);
});

test('uniform chamber mapping rejects modulo bias and aligns every stop', () => {
  const calls = [4294967295, 4294967292, 8];
  assert.equal(randomChamber(() => calls.shift()), 2);
  assert.equal(calls.length, 0);
  for (let i = 0; i < 6; i++) {
    assert.equal(randomChamber(() => i), i);
    const rotation = 1800 + (360 - i * 60) % 360;
    assert.equal((rotation + i * 60) % 360, 0);
  }
});
