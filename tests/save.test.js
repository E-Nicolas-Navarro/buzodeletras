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
  // Old saves used level numbers (0, 1, 2); they come back keyed by world.
  assert.deepEqual(data.stars, { centro: 3, laguna: 2 }); assert.equal(data.records['centro-challenge'].points, 2590); assert.equal(data.sound, false); assert.equal(data.at, 1000);
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
  assert.deepEqual(data.stars, { centro: 3 }); assert.deepEqual(data.records, { 'centro-challenge': { points: 0, depth: 1000, accuracy: 100 } });
});
test('world ids round-trip and the new worlds are kept', () => {
  const data = readBackup(makeBackup({ ...progress(), stars: { arriba: 2, abajo: 1, mar: 3, nope: 3 }, records: { 'abajo-practice': { points: 40, depth: 50, accuracy: 90 } } }));
  assert.deepEqual(data.stars, { arriba: 2, abajo: 1, mar: 3 }); assert.equal(data.records['abajo-practice'].points, 40);
});
test('backup reminders appear only when there is progress and the backup is old', () => {
  const now = 100 * DAY, fresh = emptyWallet(), played = progress().wallet;
  assert.equal(needsBackup(fresh, 0, now), false); assert.equal(needsBackup(played, 0, now), true);
  assert.equal(needsBackup(played, now - 2 * DAY, now), false); assert.equal(needsBackup(played, now - 8 * DAY, now), true);
  assert.equal(backupAge(0, now), 'todavía no guardaste un respaldo'); assert.equal(backupAge(now - 3 * DAY, now), 'último respaldo: hace 3 días');
  assert.equal(backupAge(now - DAY, now), 'último respaldo: hace 1 día'); assert.match(describeBackup(readBackup(makeBackup(progress()))), /300 monedas, 6 gemas, 3 objetos y 5 estrellas/);
});

import { recordRun, emptyAlbum } from '../album.js';
test('the album travels in backups; older codes without one restore an empty album', () => {
  const { album } = recordRun(emptyAlbum(), { f: '1'.repeat(15), j: '1'.repeat(15), x: '10' });
  const data = readBackup(makeBackup({ ...progress(), album }));
  assert.deepEqual(data.album.caught, ['f', 'j']); assert.equal(data.album.letters.x.recent, '10');
  assert.match(describeBackup(data), /5 estrellas y 2 peces/);
  assert.deepEqual(readBackup(makeBackup(progress())).album, emptyAlbum());
});

import { applyRun, emptyMissions } from '../missions.js';
test('missions, streak and medals travel in backups', () => {
  const { store } = applyRun(emptyMissions(), { world: 'centro', words: 3, won: false, collisions: 0, accuracy: 90, bestStreak: 3, frenzy: 0, whales: 0, golden: 0, letters: 9, top: 0, bottom: 0 }, {}, '2026-10-20');
  const data = readBackup(makeBackup({ ...progress(), missions: store }));
  assert.deepEqual(data.missions.medals, ['first']); assert.equal(data.missions.stats.runs, 1); assert.equal(data.missions.day, '2026-10-20');
  assert.deepEqual(readBackup(makeBackup(progress())).missions, emptyMissions());
});

test('the aquarium and own words travel in backups', () => {
  const data = readBackup(makeBackup({ ...progress(), aquarium: { owned: ['algas', 'castillo'], hidden: ['algas'] }, ownWords: { words: ['tomás', 'firulais'], on: false } }));
  assert.deepEqual(data.aquarium, { owned: ['algas', 'castillo'], hidden: ['algas'] });
  assert.deepEqual(data.ownWords, { words: ['tomás', 'firulais'], on: false });
  assert.deepEqual(readBackup(makeBackup(progress())).ownWords, { words: [], on: true });
});
