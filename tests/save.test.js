import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, readBackup, describeBackup, needsBackup, backupAge, DAY } from '../save.js';
import { emptyWallet, buySkin, equipGear } from '../skins.js';

const progress = () => {
  const wallet = emptyWallet(); wallet.coins = 800; wallet.gems = 9;
  buySkin(wallet, 'coral'); buySkin(wallet, 'guitarra'); equipGear(wallet, 'hand', 'guitarra'); wallet.equipped = 'coral';
  return { wallet, stars: { 0: 3, 1: 2 }, records: { '0-challenge': { points: 2590, depth: 240, accuracy: 97 } }, sound: false };
};
test('backup round-trips wallet, stars, records and sound', () => {
  const code = makeBackup(progress(), 1000), data = readBackup(code);
  assert.match(code, /^BUZO1-[A-Za-z0-9_-]+-[0-9a-f]{8}$/);
  assert.equal(data.wallet.coins, 300); assert.equal(data.wallet.gems, 6);
  assert.deepEqual(data.wallet.owned, ['clasico', 'coral', 'guitarra']); assert.equal(data.wallet.equipped, 'coral'); assert.equal(data.wallet.gear.hand, 'guitarra');
  assert.deepEqual(data.stars, { 0: 3, 1: 2 }); assert.equal(data.records['0-challenge'].points, 2590); assert.equal(data.sound, false); assert.equal(data.at, 1000);
});
test('damaged, edited or foreign codes are rejected', () => {
  const code = makeBackup(progress());
  assert.equal(readBackup(code.slice(0, -3)), null); assert.equal(readBackup(code.replace('BUZO1', 'BUZO2')), null);
  const [prefix, payload, hash] = code.split('-'); assert.equal(readBackup(`${prefix}-${payload.slice(0, -2)}AA-${hash}`), null);
  for (const bad of ['', null, undefined, 'hola', 'BUZO1--00000000', 42]) assert.equal(readBackup(bad), null);
});
test('codes tolerate line breaks and spaces from messaging apps', () => {
  const code = makeBackup(progress()); assert.ok(readBackup(`  ${code.slice(0, 20)}\n${code.slice(20)} `));
});
test('imported data is cleaned: no negative coins, unknown items or fake stars', () => {
  const dirty = { wallet: { coins: -5, gems: 1e12, owned: ['dorado', 'hack'], equipped: 'hack', gear: { head: 'dorado' } }, stars: { 0: 99, 7: 3, x: 1 }, records: { '0-challenge': { points: 'x', depth: 5000, accuracy: 500 }, '9-challenge': { points: 1 } } };
  const data = readBackup(makeBackup(dirty));
  assert.equal(data.wallet.coins, 0); assert.deepEqual(data.wallet.owned, ['clasico', 'dorado']); assert.equal(data.wallet.gear.head, null);
  assert.deepEqual(data.stars, { 0: 3 }); assert.deepEqual(data.records, { '0-challenge': { points: 0, depth: 1000, accuracy: 100 } });
});
test('backup reminders appear only when there is progress and the backup is old', () => {
  const now = 100 * DAY, fresh = emptyWallet(), played = progress().wallet;
  assert.equal(needsBackup(fresh, 0, now), false); assert.equal(needsBackup(played, 0, now), true);
  assert.equal(needsBackup(played, now - 2 * DAY, now), false); assert.equal(needsBackup(played, now - 8 * DAY, now), true);
  assert.equal(backupAge(0, now), 'todavía no guardaste un respaldo'); assert.equal(backupAge(now - 3 * DAY, now), 'último respaldo: hace 3 días');
  assert.equal(backupAge(now - DAY, now), 'último respaldo: hace 1 día'); assert.match(describeBackup(readBackup(makeBackup(progress()))), /300 monedas, 6 gemas, 3 objetos y 5 estrellas/);
});
