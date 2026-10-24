import test from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS, ALBUM_ROWS, RESCUE, ALBUM_PRIZE, letterKey, emptyAlbum, sanitizeAlbum, recordRun, albumRewards, weakLetters, lettersIn, accuracyOf } from '../album.js';

const hits = (n, misses = 0) => '1'.repeat(n) + '0'.repeat(misses);

test('every key of the three rows is one fish; accents ride on their vowel', () => {
  assert.equal(LETTERS.length, 27); assert.equal(new Set(LETTERS).size, 27);
  assert.deepEqual(ALBUM_ROWS.map(row => row.letters.length), [10, 10, 7]);
  assert.equal(letterKey('Á'), 'a'); assert.equal(letterKey('ü'), 'u'); assert.equal(letterKey('Ñ'), 'ñ');
  assert.equal(letterKey(' '), null); assert.equal(letterKey('7'), null); assert.equal(letterKey(''), null);
  assert.equal(lettersIn(['océano', 'piña']), 'oceanpiñ');
});
test('a fish is rescued after enough correct presses with good recent accuracy', () => {
  let { album, fresh } = recordRun(emptyAlbum(), { f: hits(RESCUE.hits - 1) });
  assert.deepEqual(fresh, []); assert.equal(album.letters.f.ok, RESCUE.hits - 1);
  ({ album, fresh } = recordRun(album, { f: '1' }));
  assert.deepEqual(fresh, ['f']); assert.deepEqual(album.caught, ['f']);
  // Already rescued fish are not counted again.
  assert.deepEqual(recordRun(album, { f: hits(5) }).fresh, []);
  // Plenty of presses but sloppy recently: not yet.
  const sloppy = recordRun(emptyAlbum(), { j: hits(RESCUE.hits + 1) + '0000' });
  assert.ok(accuracyOf(sloppy.album.letters.j) < RESCUE.accuracy); assert.deepEqual(sloppy.fresh, []);
  assert.equal(sloppy.album.letters.j.recent.length, RESCUE.recent);
});
test('completing a row and the whole album pays gems; new fish pay coins', () => {
  const tally = Object.fromEntries([...'zxcvbnm'].map(letter => [letter, hits(RESCUE.hits)]));
  const news = recordRun(emptyAlbum(), tally);
  assert.deepEqual(news.rows.map(row => row.id), ['abajo']); assert.equal(news.complete, false);
  const items = albumRewards(news);
  assert.equal(items[0].coins, 7 * ALBUM_PRIZE.fish); assert.match(items[0].label, /Nuevos peces.*Z, X, C, V, B, N, M/);
  assert.equal(items[1].gems, ALBUM_PRIZE.row);
  assert.deepEqual(recordRun(news.album, tally).rows, []);
  const rest = Object.fromEntries([...LETTERS].map(letter => [letter, hits(RESCUE.hits)]));
  const all = recordRun(news.album, rest);
  assert.equal(all.complete, true); assert.equal(all.rows.length, 2);
  assert.equal(albumRewards(all).at(-1).gems, ALBUM_PRIZE.album);
  assert.deepEqual(albumRewards({ fresh: [], rows: [], complete: false }), []);
});
test('weak letters: enough recent tries, lowest accuracy first, only where allowed', () => {
  const { album } = recordRun(emptyAlbum(), { x: '101000', b: '110110', a: hits(10), q: '00' });
  assert.deepEqual(weakLetters(album), ['x', 'b']);
  assert.deepEqual(weakLetters(album, 'abc'), ['b']);
  assert.deepEqual(weakLetters(album, LETTERS, 1), ['x']);
});
test('saved albums are cleaned: unknown letters, bad numbers and fake tries are dropped', () => {
  const album = sanitizeAlbum({ letters: { f: { ok: -3, miss: 'x', recent: '1x1' + '1'.repeat(40) }, '<': { ok: 5 } }, caught: ['j', 'zz', 'f', 'j'] });
  assert.deepEqual(album.letters.f, { ok: 0, miss: 0, recent: '1'.repeat(RESCUE.recent) });
  assert.equal(album.letters['<'], undefined); assert.deepEqual(album.caught, ['f', 'j']);
  assert.deepEqual(sanitizeAlbum('nope'), emptyAlbum());
});
