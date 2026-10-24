import test from 'node:test';
import assert from 'node:assert/strict';
import { runEntry, sanitizeHistory, addRun, speedOf, precisionOf, weekStats, trend, keyStats, fingerStats, tips, HISTORY_MAX } from '../report.js';
import { createRun } from '../engine.js';
import { emptyAlbum, recordRun } from '../album.js';

const DAY = 86400000, now = Date.UTC(2026, 9, 24, 12);
const dive = (daysAgo, overrides = {}) => ({ at: now - daysAgo * DAY, world: 'centro', relaxed: false, won: false, words: 20, letters: 120, attempts: 130, mistakes: 10, seconds: 120, ...overrides });

test('a dive becomes one history entry with its typing time and correct letters', () => {
  const state = { ...createRun(3), score: 18, attempts: 100, mistakes: 7, elapsed: 90.4, letters: { a: '1101', s: '11' } };
  assert.deepEqual(runEntry(state, now), { at: now, world: 'laguna', relaxed: false, won: false, words: 18, letters: 5, attempts: 100, mistakes: 7, seconds: 90 });
  assert.equal(speedOf(dive(0)), 60); assert.equal(precisionOf(dive(0)), 92);
  assert.equal(speedOf(dive(0, { seconds: 10 })), null); assert.equal(precisionOf(dive(0, { attempts: 5, mistakes: 0 })), null);
});
test('history is cleaned, sorted and capped', () => {
  const dirty = [dive(1), dive(3), { at: 'x' }, null, dive(2, { world: 'atlantis', mistakes: 999 }), dive(0, { words: -4 })];
  const clean = sanitizeHistory(dirty);
  assert.equal(clean.length, 3); assert.deepEqual(clean.map(entry => entry.at), [now - 3 * DAY, now - DAY, now]);
  assert.equal(clean[2].words, 0);
  let long = []; for (let i = 0; i < HISTORY_MAX + 5; i++) long = addRun(long, dive(0, { at: now + i }));
  assert.equal(long.length, HISTORY_MAX); assert.equal(long[0].at, now + 5);
});
test('this week against last week, and the trend of the latest timed dives', () => {
  const history = sanitizeHistory([dive(1), dive(1.05, { letters: 180 }), dive(3), dive(9, { letters: 60, mistakes: 40 }), dive(0.05, { seconds: 5 })]);
  const week = weekStats(history, now);
  assert.equal(week.now.dives, 4); assert.equal(week.now.days, 3); assert.equal(week.now.minutes, 6);
  assert.equal(week.now.speed, 70); assert.equal(week.before.dives, 1); assert.equal(week.before.speed, 30);
  assert.equal(trend(history).length, 4); assert.equal(trend(history, 2).length, 2);
});
test('keys and fingers read the album; tips follow the numbers', () => {
  const { album } = recordRun(emptyAlbum(), { f: '1111111111', j: '1110', x: '1010101010', a: '1111111110' });
  const keys = keyStats(album);
  assert.deepEqual(keys.f, { tries: 10, precision: 100, bin: 0 }); assert.equal(keys.x.bin, 4); assert.equal(keys.a.bin, 2);
  assert.equal(keys.j.bin, null); assert.equal(keys.q.tries, 0);
  const fingers = fingerStats(album);
  assert.equal(fingers.length, 8); assert.equal(fingers[3].name, 'índice izquierdo'); assert.equal(fingers[3].precision, 100);
  assert.equal(fingers[1].precision, 50);
  const quiet = tips({ week: weekStats([], now), weak: [], fingers: [] });
  assert.match(quiet[0], /todavía no jugó/);
  const advice = tips({ week: weekStats(sanitizeHistory([dive(1, { mistakes: 40 })]), now), weak: ['x'], fingers });
  assert.ok(advice.some(text => /Practicar sin apuro/.test(text))); assert.ok(advice.some(text => /X/.test(text)));
  assert.ok(advice.some(text => /anular izquierdo/.test(text)));
});
