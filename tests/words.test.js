import test from 'node:test';
import assert from 'node:assert/strict';
import { OWN_WORDS, checkWord, sanitizeOwnWords, emptyOwnWords } from '../words.js';
import { DECOR, emptyAquarium, sanitizeAquarium, buyDecor, toggleDecor, shownDecor, canBuyDecor } from '../aquarium.js';
import { createRun, makeDeck, levelIndex, LEVELS } from '../engine.js';

test('own words: letters only, a sensible length, no repeats and at most twenty', () => {
  assert.deepEqual(checkWord([], '  Tomás '), { word: 'tomás' });
  for (const bad of ['', 'a', 'luna llena', 'r2d2', 'hola!', 'x'.repeat(OWN_WORDS.length + 1)]) assert.ok(checkWord([], bad).error, bad);
  assert.match(checkWord(['luna'], 'LUNA').error, /ya está/);
  const full = Array.from({ length: OWN_WORDS.max }, (_, i) => 'ab'.repeat(1 + i % 6) + 'c'.repeat(1 + Math.floor(i / 6)));
  assert.match(checkWord(full, 'pato').error, /Ya tenés 20/);
  assert.deepEqual(sanitizeOwnWords({ words: ['Ñandú', 'ñandú', '<b>', 'sol'], on: false }), { words: ['ñandú', 'sol'], on: false });
  assert.deepEqual(sanitizeOwnWords(null), emptyOwnWords());
});
test('own words join the worlds whose letters they use and lead the deck', () => {
  const ownWords = ['camila', 'lola', 'pato'];
  const centro = createRun(levelIndex('centro'), false, () => .3, { ownWords });
  assert.deepEqual(centro.own, []);
  const arriba = createRun(levelIndex('arriba'), false, () => .3, { ownWords });
  assert.deepEqual(arriba.own, ['lola', 'pato']); assert.ok(!arriba.words.includes('camila'));
  // A name made of top and home row letters fits the top-row world.
  assert.deepEqual(createRun(levelIndex('arriba'), false, () => .3, { ownWords: ['sofía'] }).own, ['sofía']);
  const mar = createRun(levelIndex('mar'), false, () => .3, { ownWords });
  assert.deepEqual(mar.own, ownWords);
  assert.deepEqual(mar.deck.slice(0, 3).sort(), [...ownWords].sort());
  assert.equal(new Set(makeDeck(levelIndex('arriba'), () => .5, [], [], ['pato'])).size, 12);
  assert.ok(LEVELS[levelIndex('arriba')].words.includes('pato'));
});
test('aquarium: decorations cost coins or gems, are placed when bought and can be put away', () => {
  const wallet = { coins: 100, gems: 3 }, tank = emptyAquarium();
  assert.equal(buyDecor(tank, wallet, 'castillo'), false); assert.equal(wallet.coins, 100);
  assert.equal(buyDecor(tank, wallet, 'algas'), true); assert.equal(wallet.coins, 60);
  assert.equal(buyDecor(tank, wallet, 'algas'), false);
  assert.equal(buyDecor(tank, wallet, 'mini-otto'), true); assert.equal(wallet.gems, 0); assert.equal(wallet.coins, 60);
  assert.deepEqual(shownDecor(tank), ['algas', 'mini-otto']);
  assert.equal(toggleDecor(tank, 'algas'), true); assert.deepEqual(shownDecor(tank), ['mini-otto']);
  toggleDecor(tank, 'algas'); assert.deepEqual(shownDecor(tank), ['algas', 'mini-otto']);
  assert.equal(toggleDecor(tank, 'castillo'), false);
  assert.equal(canBuyDecor({ coins: 0, gems: 9 }, DECOR.find(item => item.id === 'mini-otto')), true);
  assert.deepEqual(sanitizeAquarium({ owned: ['coral', 'hack', 'coral'], hidden: ['coral', 'algas'] }), { owned: ['coral'], hidden: ['coral'] });
  assert.equal(new Set(DECOR.map(item => item.id)).size, DECOR.length);
});
