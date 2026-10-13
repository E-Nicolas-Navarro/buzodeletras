import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, normalize, fingerFor, makeDeck, assessInput, accuracy, createRun, tickRun, typeInRun, activeSharks, targetShark, chooseTarget, spawnShark, capacity, MISSION_WORDS, BOSS_HITS, currentWord } from '../engine.js';
const ready = (level = 0, relaxed = false) => { const state = createRun(level, relaxed, () => .3); tickRun(state, 1.6); return state; };
const complete = state => { const word = currentWord(state); for (let i = 1; i <= word.length; i++) typeInRun(state, word.slice(0, i)); };

test('decks are unique and first adventure starts at F and J', () => {
  for (let level = 0; level < 3; level++) { const deck = makeDeck(level); assert.equal(deck.length, 12); assert.equal(new Set(deck).size, 12); }
  assert.deepEqual(makeDeck(0).slice(0, 2), ['fff', 'jjj']);
  for (const word of LEVELS[0].words) assert.match(word, /^[asdfghjklñ]+$/);
});
test('input counts new mistakes, not backspace or unchanged input', () => {
  assert.deepEqual(assessInput('ma', 'mar', 'mar'), { value: 'mar', added: 1, mistakes: 0, valid: true, complete: true });
  assert.equal(assessInput('m', 'mx', 'mar').mistakes, 1);
  assert.equal(assessInput('mx', 'mx', 'mar').mistakes, 0);
  assert.equal(assessInput('mx', 'm', 'mar').mistakes, 0);
  assert.equal(assessInput('m', 'Mar', 'mar').complete, true);
  assert.equal(assessInput('', 'marz', 'mar').complete, false);
});
test('Spanish accents, Ñ and accuracy remain correct', () => {
  assert.equal(normalize('DELFÍN'), 'delfín'); assert.equal(normalize('oce\u0301ano'), 'océano');
  assert.equal(fingerFor('ñ').name, 'meñique derecho'); assert.equal(fingerFor('í').name, 'medio derecho');
  assert.equal(fingerFor('ü').name, 'índice derecho'); assert.equal(fingerFor(' ').name, 'pulgar');
  assert.equal(accuracy(10, 2), 80); assert.equal(accuracy(0, 0), 100);
});
test('dive introduction has no sharks, no penalties and no counted playing time', () => {
  const state = createRun(0); tickRun(state, 1);
  assert.equal(state.mode, 'diving'); assert.equal(state.sharks.length, 0); assert.equal(state.elapsed, 0);
  assert.equal(typeInRun(state, 'x').ignored, true); assert.equal(state.oxygen, 100);
  assert.deepEqual(tickRun(state, .6), ['ready']); assert.equal(state.mode, 'playing');
});
test('wrong letters consume oxygen, corrections do not, complete words score and descend', () => {
  const state = ready(); typeInRun(state, 'x'); assert.equal(state.oxygen, 95); assert.equal(state.mistakes, 1);
  typeInRun(state, 'x'); assert.equal(state.oxygen, 95);
  typeInRun(state, ''); assert.equal(state.oxygen, 95);
  complete(state); assert.equal(state.score, 1); assert.equal(state.depth, 10);
  assert.equal(state.points, 35); assert.equal(state.oxygen, 98);
  assert.equal(activeSharks(state).length, 0); tickRun(state, .1);
  assert.equal(targetShark(state).word, 'jjj'); assert.equal(targetShark(state).side, 'right');
});
test('difficulty grows to four concurrent sharks with distinct words and lanes', () => {
  const state = ready(1, true);
  for (let i = 0; i < 12; i++) { complete(state); tickRun(state, .1); }
  assert.equal(state.wave, 3); assert.equal(capacity(state), 4);
  for (let i = 0; i < 3; i++) tickRun(state, 6);
  const sharks = activeSharks(state);
  assert.equal(sharks.length, 4);
  assert.equal(new Set(sharks.map(shark => shark.word)).size, 4);
  assert.equal(new Set(sharks.map(shark => shark.lane)).size, 4);
  assert.ok(sharks.some(shark => shark.side === 'left')); assert.ok(sharks.some(shark => shark.side === 'right'));
  assert.ok(sharks.every(shark => shark.duration < LEVELS[1].seconds));
  assert.equal(spawnShark(state), null);
});
test('first letter chooses any visible shark and stays locked until correction', () => {
  const state = ready(1, true); state.score = 4; spawnShark(state);
  const other = activeSharks(state)[1];
  typeInRun(state, other.word[0]); assert.equal(state.targetId, other.id);
  typeInRun(state, `${other.word[0]}@`); assert.equal(state.targetId, other.id);
  typeInRun(state, ''); chooseTarget(state, other.id); assert.equal(state.targetId, other.id);
});
test('collision consumes oxygen only once and clears a destroyed target buffer', () => {
  const state = ready(); typeInRun(state, 'f'); const old = targetShark(state);
  old.progress = .999; tickRun(state, .1);
  assert.equal(state.oxygen, 78); assert.equal(state.input, ''); assert.notEqual(state.targetId, old.id);
  tickRun(state, .1); assert.equal(state.oxygen, 78);
});
test('practice and pause freeze threats; paused dive can resume unchanged', () => {
  const practice = ready(0, true); typeInRun(practice, 'x'); tickRun(practice, 100);
  assert.equal(practice.oxygen, 100); assert.equal(targetShark(practice).progress, 0);
  const state = ready(); state.mode = 'paused'; const snapshot = JSON.stringify(state);
  tickRun(state, 50); assert.equal(JSON.stringify(state), snapshot);
  const diving = createRun(0); tickRun(diving, .5); diving.mode = 'paused'; tickRun(diving, 10); assert.equal(diving.diveTime, .5);
});
test('zero oxygen ends immediately; descent starts the boss instead of declaring victory', () => {
  const lost = ready(); lost.oxygen = 5; typeInRun(lost, '@'); assert.equal(lost.mode, 'ended'); assert.equal(lost.won, false);
  assert.equal(typeInRun(lost, 'fff').ignored, true);
  const state = ready(0, true);
  for (let i = 0; i < MISSION_WORDS; i++) { complete(state); tickRun(state, .1); }
  assert.equal(state.mode, 'bossIntro'); assert.equal(state.won, false); assert.equal(state.depth, 240);
  assert.equal(state.sharks.length, 0); assert.equal(spawnShark(state), null);
  assert.equal(state.wave, 4); assert.equal(state.bestStreak, 24);
  assert.equal(typeInRun(state, 'x').ignored, true);
  assert.deepEqual(tickRun(state, 2), ['bossReady']); assert.equal(state.mode, 'boss');
  for (let i = 0; i < BOSS_HITS; i++) complete(state);
  assert.equal(state.mode, 'ended'); assert.equal(state.won, true); assert.equal(state.boss.hp, 0);
  assert.equal(state.score, 32); assert.equal(state.depth, 240); assert.equal(state.boss.defeated, true);
  const points = state.points; tickRun(state, 50); typeInRun(state, 'fff'); assert.equal(state.points, points);
});
test('boss intro refills oxygen, pauses safely, and keeps words within the chosen skill level', () => {
  for (let level = 0; level < 3; level++) {
    const state = ready(level);
    state.score = 23; state.oxygen = 20; complete(state);
    assert.equal(state.oxygen, 60); assert.equal(state.mode, 'bossIntro');
    assert.equal(state.boss.words.length, 8);
    assert.ok(state.boss.words.every(word => LEVELS[level].words.includes(word)));
    state.mode = 'paused'; const snapshot = JSON.stringify(state); tickRun(state, 30);
    assert.equal(JSON.stringify(state), snapshot);
    state.mode = 'bossIntro'; tickRun(state, 2); assert.equal(state.mode, 'boss');
  }
});
test('boss attacks consume oxygen without erasing partial input, correct words reset attacks', () => {
  const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
  const word = currentWord(state); typeInRun(state, word[0]);
  state.boss.attackIn = .05; const oxygen = state.oxygen;
  assert.deepEqual(tickRun(state, .1), ['bossAttack']);
  assert.equal(state.oxygen, oxygen - 18); assert.equal(state.input, word[0]);
  typeInRun(state, `${word[0]}@`); assert.equal(state.oxygen, oxygen - 23);
  typeInRun(state, word[0]); assert.equal(state.oxygen, oxygen - 23);
  typeInRun(state, word); assert.equal(state.boss.hp, 7); assert.equal(state.depth, 240);
  assert.equal(state.boss.attackIn, state.boss.attackInterval); assert.equal(state.oxygen, oxygen - 20);
  state.mode = 'paused'; const snapshot = JSON.stringify(state); tickRun(state, 20);
  assert.equal(JSON.stringify(state), snapshot);
});
test('boss defeat and oxygen exhaustion are exclusive; practice mode never attacks', () => {
  const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
  state.oxygen = 18; state.boss.attackIn = .01; tickRun(state, .1);
  assert.equal(state.mode, 'ended'); assert.equal(state.won, false); assert.equal(state.boss.hp, 8);
  const practice = ready(0, true); practice.score = 23; complete(practice); tickRun(practice, 2);
  typeInRun(practice, '@'); tickRun(practice, 100);
  assert.equal(practice.oxygen, 100); assert.equal(practice.boss.hp, 8);
  assert.equal(practice.mode, 'boss');
});
