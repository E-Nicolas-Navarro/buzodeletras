import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, dailyMissions, MISSIONS, MEDALS, DAILY_BONUS, emptyMissions, sanitizeMissions, applyRun, liveStreak, forDay, streakPrize, summarizeRun } from '../missions.js';
import { createRun, LEVELS } from '../engine.js';

const run = (overrides = {}) => ({ world: 'centro', words: 5, won: false, relaxed: false, coop: false, boss: null, collisions: 2, accuracy: 80, bestStreak: 2, frenzy: 0, whales: 0, golden: 0, letters: 20, top: 0, bottom: 0, ...overrides });
const day = n => dayKey(new Date(2026, 9, n, 12));

test('three missions a day, one of each kind, the same all day and different across days', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  const today = dailyMissions(day(20));
  assert.equal(today.length, 3); assert.deepEqual(dailyMissions(day(20)), today);
  const week = new Set(); for (let n = 1; n <= 14; n++) week.add(dailyMissions(day(n)).map(mission => mission.id).join());
  assert.ok(week.size > 5);
  assert.equal(new Set(MISSIONS.map(mission => mission.id)).size, MISSIONS.length);
  assert.ok(MISSIONS.some(mission => mission.id === `world-${LEVELS[1].id}`));
});
test('progress adds up across dives, pays each mission once and a bonus for all three', () => {
  const today = day(20), list = dailyMissions(today);
  // A dive that maxes everything finishes every mission of any day.
  const huge = run({ words: 99, won: true, collisions: 0, accuracy: 100, bestStreak: 50, frenzy: 20, letters: 500, top: 99, bottom: 99, world: list[2].id.replace('world-', '') });
  const first = applyRun(emptyMissions(), huge, {}, today);
  assert.equal(first.finished.length, 3);
  const missionCoins = first.items.filter(item => item.label.startsWith('Misión')).reduce((sum, item) => sum + item.coins, 0);
  assert.equal(missionCoins, list.reduce((sum, mission) => sum + mission.reward, 0));
  assert.ok(first.items.some(item => item.gems === DAILY_BONUS.gems && /tres misiones/.test(item.label)));
  const again = applyRun(first.store, huge, {}, today);
  assert.equal(again.finished.length, 0); assert.ok(!again.items.some(item => /Misión|tres misiones/.test(item.label)));
  // Counting missions add up: two dives of 15 words make 30.
  const words = { id: 'words', goal: 30 };
  let store = { ...emptyMissions(), day: today };
  for (let i = 0; i < 2; i++) store = applyRun(store, run({ words: 15 }), {}, today).store;
  if (list.some(mission => mission.id === words.id)) assert.ok(store.done.includes('words'));
  // A new day starts fresh but keeps medals.
  const tomorrow = forDay(first.store, day(21));
  assert.deepEqual(tomorrow.done, []); assert.deepEqual(tomorrow.medals, first.store.medals);
});
test('the streak grows one per day with a finished mission and is lost after a skipped day', () => {
  const huge = run({ words: 99, won: true, collisions: 0, accuracy: 100, bestStreak: 50, frenzy: 20, letters: 500, top: 99, bottom: 99 });
  let store = emptyMissions(); const prizes = [];
  for (let n = 1; n <= 7; n++) { const out = applyRun(store, { ...huge, world: dailyMissions(day(n))[2].id.replace('world-', '') }, {}, day(n)); store = out.store; prizes.push(out.items.find(item => /Racha/.test(item.label))?.gems || 0); }
  assert.equal(store.streak.days, 7); assert.deepEqual(prizes, [0, 0, 1, 0, 0, 0, 3]);
  assert.equal(liveStreak(store, day(8)), 7); assert.equal(liveStreak(store, day(9)), 0);
  assert.equal(streakPrize(14), 3); assert.equal(streakPrize(4), 0);
  assert.ok(store.medals.includes('week'));
});
test('medals: earned once from the dive, the album, the stars and the shop', () => {
  const today = day(20);
  const out = applyRun(emptyMissions(), run({ won: true, boss: 'pinza', collisions: 0, words: 32, accuracy: 100, bestStreak: 25, whales: 1 }), { fish: 6, stars: Object.fromEntries(LEVELS.map(level => [level.id, 1])), owned: 5 }, today);
  for (const id of ['first', 'guardian', 'pinza', 'clean', 'streak20', 'perfect', 'whale', 'fish5', 'explorer', 'style']) assert.ok(out.store.medals.includes(id), id);
  for (const id of ['otto', 'medusa', 'streak50', 'fish15', 'master', 'team', 'golden']) assert.ok(!out.store.medals.includes(id), id);
  assert.ok(out.items.some(item => item.label === 'Medalla nueva: 🦀 Amigo de Don Pinza' && item.gems === 1));
  assert.equal(applyRun(out.store, run(), {}, today).medals.length, 0);
  assert.equal(new Set(MEDALS.map(medal => medal.id)).size, MEDALS.length);
});
test('saved missions are cleaned and a run summary comes from the engine state', () => {
  const clean = sanitizeMissions({ day: 'mañana', progress: { words: -4, nope: 3, dives: 1 }, done: ['words', 'hack'], streak: { days: 'x', last: '2026-10-20' }, medals: ['first', 'fake'], stats: { runs: 3, beaten: ['otto', 'kraken'] } });
  assert.equal(clean.day, ''); assert.deepEqual(clean.progress, { dives: 1 }); assert.deepEqual(clean.done, ['words']);
  assert.deepEqual(clean.streak, { days: 0, last: '2026-10-20' }); assert.deepEqual(clean.medals, ['first']);
  assert.equal(clean.stats.runs, 3); assert.deepEqual(clean.stats.beaten, ['otto']);
  const state = { ...createRun(1), score: 12, won: true, boss: { kind: 'pinza' }, attempts: 50, mistakes: 5, letters: { q: '110', z: '1', a: '11' } };
  const summary = summarizeRun(state);
  assert.equal(summary.world, 'arriba'); assert.equal(summary.boss, 'pinza'); assert.equal(summary.accuracy, 90);
  assert.equal(summary.letters, 5); assert.equal(summary.top, 2); assert.equal(summary.bottom, 1);
});
