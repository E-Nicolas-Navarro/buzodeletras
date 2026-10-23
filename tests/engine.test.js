import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelIndex, bossOf, normalize, fingerFor, makeDeck, assessInput, accuracy, createRun, tickRun, typeInRun, activeSharks, targetShark, chooseTarget, spawnShark, capacity, MISSION_WORDS, BOSS_HITS, currentWord } from '../engine.js';
const ready = (level = 0, relaxed = false) => { const state = createRun(level, relaxed, () => .3); tickRun(state, 1.6); return state; };
const complete = state => { const word = currentWord(state); for (let i = 1; i <= word.length; i++) typeInRun(state, word.slice(0, i)); };

test('decks are unique and first adventure starts at F and J', () => {
  for (let level = 0; level < LEVELS.length; level++) { const deck = makeDeck(level); assert.equal(deck.length, 12); assert.equal(new Set(deck).size, 12); }
  assert.deepEqual(makeDeck(0).slice(0, 2), ['fff', 'jjj']);
  for (const word of LEVELS[0].words) assert.match(word, /^[asdfghjklñ]+$/);
  // The top-row world adds only the upper keys; every bottom-row word uses a lower key.
  for (const word of LEVELS[levelIndex('arriba')].words) assert.match(word, /^[qwertyuiopasdfghjklñ]+$/);
  for (const word of LEVELS[levelIndex('abajo')].words) assert.match(word, /[zxcvbnm]/);
  assert.equal(new Set(LEVELS.map(level => level.id)).size, LEVELS.length);
  assert.deepEqual(LEVELS.map(level => bossOf(LEVELS.indexOf(level)).name), ['Otto', 'Don Pinza', 'la Reina Medusa', 'Otto', 'Otto']);
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
  for (let level = 0; level < LEVELS.length; level++) {
    const state = ready(level);
    state.score = 23; state.oxygen = 20; complete(state);
    assert.equal(state.oxygen, 60); assert.equal(state.mode, 'bossIntro');
    assert.equal(state.boss.words.length, 8); assert.equal(state.boss.kind, LEVELS[level].boss);
    assert.ok(state.boss.words.every(phrase => phrase.split(' ').length === 2 && phrase.split(' ').every(word => LEVELS[level].words.includes(word))));
    state.mode = 'paused'; const snapshot = JSON.stringify(state); tickRun(state, 30);
    assert.equal(JSON.stringify(state), snapshot);
    state.mode = 'bossIntro'; tickRun(state, 2); assert.equal(state.mode, 'boss');
  }
});
test('boss attacks consume oxygen without erasing partial input; a correct phrase resets the clock', () => {
  const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
  const word = currentWord(state); typeInRun(state, word[0]);
  state.boss.attackIn = .05; const oxygen = state.oxygen;
  assert.deepEqual(tickRun(state, .1), ['bossAttack']);
  assert.equal(state.oxygen, oxygen - 18); assert.equal(state.input, word[0]);
  typeInRun(state, `${word[0]}@`); assert.equal(state.oxygen, oxygen - 23);
  typeInRun(state, word[0]); assert.equal(state.oxygen, oxygen - 23);
  state.boss.attackIn = 2;
  typeInRun(state, word); assert.equal(state.boss.hp, 7); assert.equal(state.depth, 240);
  assert.equal(state.boss.attackIn, state.boss.attackInterval); assert.equal(state.oxygen, oxygen - 20);
  state.mode = 'paused'; const snapshot = JSON.stringify(state); tickRun(state, 20);
  assert.equal(JSON.stringify(state), snapshot);
});
test('correct letters buy Otto time once; deleting and retyping earns nothing', () => {
  const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
  const phrase = currentWord(state); state.boss.attackIn = 2;
  typeInRun(state, phrase.slice(0, 3)); assert.ok(Math.abs(state.boss.attackIn - 2.9) < 1e-9);
  typeInRun(state, phrase.slice(0, 1)); typeInRun(state, phrase.slice(0, 3));
  assert.ok(Math.abs(state.boss.attackIn - 2.9) < 1e-9);
  typeInRun(state, `${phrase.slice(0, 3)}@`); assert.ok(Math.abs(state.boss.attackIn - 2.9) < 1e-9);
  state.boss.attackIn = state.boss.attackInterval - .1; typeInRun(state, phrase.slice(0, 5));
  assert.equal(state.boss.attackIn, state.boss.attackInterval);
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

test('Otto speeds up halfway and his clock restarts with the faster pace', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    const state = ready(level); state.score = 23; complete(state); tickRun(state, 2);
    const interval = state.boss.attackInterval;
    assert.ok(interval <= 10);
    for (let i = 0; i < 3; i++) complete(state);
    state.boss.attackIn = .4; complete(state);
    assert.equal(state.boss.hp, 4);
    assert.equal(state.boss.attackInterval, interval * .7);
    assert.equal(state.boss.attackIn, interval * .7);
    assert.deepEqual(tickRun(state, interval * .7 + .1), ['bossAttack']);
  }
});
test('an idle boss encounter still loses: Otto keeps attacking while nobody types', () => {
  const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
  tickRun(state, 100);
  assert.equal(state.mode, 'ended'); assert.equal(state.oxygen, 0); assert.equal(state.won, false);
});
test('rare visitors: the whale gives oxygen and never hurts, golden sharks pay a gem', () => {
  const state = ready(1); state.score = 8; state.oxygen = 50; state.sharks = [];
  const rolls = [0, .1, 0]; state.random = () => rolls.shift() ?? .5;
  const whale = spawnShark(state); assert.equal(whale.kind, 'whale');
  state.targetId = whale.id; for (let i = 1; i <= whale.word.length; i++) typeInRun(state, whale.word.slice(0, i));
  assert.equal(state.oxygen, 62); assert.equal(state.whales, 1);
  const passing = ready(1); passing.score = 8; passing.sharks = []; passing.random = () => 0;
  const friend = spawnShark(passing); friend.progress = .999; const air = passing.oxygen;
  tickRun(passing, 1); assert.equal(passing.oxygen, air); assert.equal(passing.collisions, 0);
  const lucky = ready(1); lucky.score = 3; lucky.whaleSeen = true; lucky.sharks = []; lucky.random = () => .05;
  const gold = spawnShark(lucky); assert.equal(gold.kind, 'golden');
  lucky.targetId = gold.id; for (let i = 1; i <= gold.word.length; i++) typeInRun(lucky, gold.word.slice(0, i));
  assert.equal(computeRewards({ ...lucky, won: false }).gems, 1);
});
test('seasonal words join only whole-keyboard worlds and candy is earned per word', () => {
  const words = ['bruja', 'gato'];
  for (const id of ['abajo', 'laguna', 'mar']) assert.ok(createRun(levelIndex(id), false, Math.random, { eventWords: words, event: 'halloween' }).words.includes('bruja'), id);
  for (const id of ['centro', 'arriba']) assert.ok(!createRun(levelIndex(id), false, Math.random, { eventWords: words }).words.includes('bruja'), id);
  const state = { ...createRun(1, false, () => .3, { event: 'halloween' }), score: 10, won: true };
  assert.equal(computeRewards(state).candy, 25);
  assert.equal(computeRewards({ ...createRun(1), score: 10 }).candy, 0);
});
test('a steady typing pace can win Otto, but a slow pace runs out of oxygen', () => {
  for (const secondsPerPhrase of [4, 14]) {
    const state = ready(); state.score = 23; complete(state); tickRun(state, 2);
    for (let phrase = 0; phrase < 8 && state.mode === 'boss'; phrase++) {
      for (let tick = 0; tick < secondsPerPhrase * 10 && state.mode === 'boss'; tick++) tickRun(state, .1);
      if (state.mode === 'boss') complete(state);
    }
    // A win in challenge mode opens the treasure frenzy; a loss ends the dive.
    assert.equal(state.mode, secondsPerPhrase === 4 ? 'frenzy' : 'ended');
    assert.equal(state.won, secondsPerPhrase === 4);
  }
});

import { computeRewards } from '../engine.js';
import { SKINS, sanitizeWallet, emptyWallet, buySkin, equipSkin } from '../skins.js';
const won = (overrides = {}) => ({ ...createRun(1, false, () => .3), won: true, points: 2000, attempts: 100, mistakes: 10, collisions: 0, score: 32, ...overrides });
test('rewards: clean dive earns the biggest shark bonus', () => {
  const clean = computeRewards(won()), few = computeRewards(won({ collisions: 2 })), many = computeRewards(won({ collisions: 3 }));
  assert.ok(clean.items.some(item => item.label.includes('Ningún tiburón')));
  assert.ok(few.items.some(item => item.label.includes('Pocos tiburones')));
  assert.ok(!many.items.some(item => item.label.includes('tiburón') || item.label.includes('tiburones')));
  assert.ok(clean.coins > few.coins && few.coins > many.coins && clean.gems > few.gems && few.gems > many.gems);
});
test('rewards: precision bonus, defeats and practice', () => {
  assert.ok(computeRewards(won({ mistakes: 2 })).items.some(item => item.label.includes('perfectas')));
  const lost = computeRewards(won({ won: false })); assert.equal(lost.gems, 0); assert.equal(lost.coins, 96);
  const practice = computeRewards(won({ relaxed: true })); assert.equal(practice.gems, 0); assert.equal(practice.coins, 64);
});
test('sharks that reach the diver are counted', () => {
  const state = ready(0); state.sharks[0].progress = 1; tickRun(state, .1);
  assert.equal(state.collisions, 1);
});
test('shop: buying, equipping and sanitising the wallet', () => {
  const wallet = emptyWallet(); wallet.coins = 200;
  assert.equal(buySkin(wallet, 'dorado'), false); assert.equal(buySkin(wallet, 'coral'), true);
  assert.equal(wallet.coins, 0); assert.equal(buySkin(wallet, 'coral'), false);
  assert.equal(equipSkin(wallet, 'coral'), true); assert.equal(equipSkin(wallet, 'pirata'), false);
  assert.deepEqual(sanitizeWallet({ coins: -5, gems: 'x', owned: ['coral', 'nope'], equipped: 'pirata' }), { coins: 0, gems: 0, candy: 0, owned: ['clasico', 'coral'], equipped: 'clasico', gear: { mask: null, fins: null, head: null, hand: null, back: null, pet: null, trail: null } });
  assert.deepEqual(sanitizeWallet(null), emptyWallet()); assert.equal(new Set(SKINS.map(skin => skin.id)).size, SKINS.length);
});

import { equipGear, ACCESSORIES } from '../skins.js';
test('shop: accessories are bought per slot, equipped and removed', () => {
  const wallet = emptyWallet(); wallet.coins = 500; wallet.gems = 5;
  assert.equal(buySkin(wallet, 'sombrero-copa'), true); assert.equal(buySkin(wallet, 'sombrero-copa'), false);
  assert.equal(equipGear(wallet, 'head', 'sombrero-copa'), true); assert.equal(equipGear(wallet, 'mask', 'sombrero-copa'), false);
  assert.equal(equipGear(wallet, 'hand', 'guitarra'), false);
  assert.equal(equipSkin(wallet, 'sombrero-copa'), false);
  assert.equal(equipGear(wallet, 'head', null), true); assert.equal(wallet.gear.head, null);
  const clean = sanitizeWallet({ owned: ['guitarra'], gear: { hand: 'guitarra', head: 'guitarra', mask: 'mascara-sol' }, equipped: 'guitarra' });
  assert.deepEqual(clean.gear, { mask: null, fins: null, head: null, hand: 'guitarra', back: null, pet: null, trail: null }); assert.equal(clean.equipped, 'clasico');
  assert.equal(new Set(ACCESSORIES.map(item => item.id)).size, ACCESSORIES.length);
});
test('shop: seasonal items cost candy and are only sold during their season', () => {
  const wallet = emptyWallet(); wallet.candy = 100; wallet.coins = 1000;
  assert.equal(buySkin(wallet, 'esqueleto'), false); assert.equal(wallet.candy, 100);
  assert.equal(buySkin(wallet, 'esqueleto', 'halloween'), true); assert.equal(wallet.candy, 40); assert.equal(wallet.coins, 1000);
  assert.equal(buySkin(wallet, 'fantasmita', 'halloween'), true); assert.equal(buySkin(wallet, 'estela-murcielagos', 'halloween'), false);
  assert.equal(equipSkin(wallet, 'esqueleto'), true);
  assert.equal(sanitizeWallet({ candy: 12.7, owned: ['esqueleto'], equipped: 'esqueleto' }).equipped, 'esqueleto');
});

import { starsFor } from '../engine.js';
test('stars: fewer shark hits earn more stars, only for won challenge runs', () => {
  assert.equal(starsFor(won()), 3); assert.equal(starsFor(won({ collisions: 2 })), 2); assert.equal(starsFor(won({ collisions: 3 })), 1);
  assert.equal(starsFor(won({ won: false })), 0); assert.equal(starsFor(won({ relaxed: true })), 0);
});

import { FRENZY, dropLoot } from '../engine.js';
const toFrenzy = () => {
  const state = ready(1); state.score = MISSION_WORDS - 1; complete(state); tickRun(state, 2);
  for (let i = 0; i < BOSS_HITS; i++) complete(state);
  return state;
};
test('beating Otto in challenge mode starts a treasure frenzy with double points and no oxygen at stake', () => {
  const state = toFrenzy();
  assert.equal(state.mode, 'frenzy'); assert.equal(state.won, true); assert.equal(state.boss.defeated, true);
  assert.equal(currentWord(state), null); assert.equal(typeInRun(state, 'x').ignored, true);
  assert.deepEqual(tickRun(state, FRENZY.intro), ['frenzyReady']);
  assert.equal(activeSharks(state).length, 1); assert.equal(targetShark(state).side, 'top');
  const oxygen = state.oxygen, points = state.points;
  typeInRun(state, '@'); assert.equal(state.oxygen, oxygen); assert.equal(state.frenzy.combo, 0); typeInRun(state, '');
  const word = currentWord(state); complete(state);
  assert.equal(state.frenzy.caught, 1); assert.equal(state.points - points, (word.length * 10 + 5) * 2);
  // Treasure that reaches the sand only breaks the combo.
  for (let i = 0; i < 20; i++) tickRun(state, .1);
  const loot = activeSharks(state)[0]; loot.progress = .999;
  assert.ok(tickRun(state, .1).includes('lootLost')); assert.equal(state.oxygen, oxygen); assert.equal(state.frenzy.combo, 0);
  assert.ok(activeSharks(state).length <= FRENZY.max);
  assert.ok(new Set(activeSharks(state).map(item => item.word[0])).size === activeSharks(state).length);
  for (let i = 0; i < FRENZY.seconds * 10 && state.mode === 'frenzy'; i++) tickRun(state, .1);
  assert.equal(state.mode, 'ended'); assert.equal(state.won, true); assert.equal(state.sharks.length, 0);
  assert.equal(dropLoot(state), null);
});
test('the frenzy pays coins per treasure and at most a couple of gems; practice skips it', () => {
  const state = toFrenzy(); tickRun(state, FRENZY.intro);
  for (let i = 0; i < 40 && state.mode === 'frenzy'; i++) { if (currentWord(state)) complete(state); tickRun(state, .35); }
  assert.ok(state.frenzy.caught >= 10); assert.ok(state.frenzy.gems <= FRENZY.gems);
  const bonus = computeRewards(state).items.find(item => item.label === 'Frenesí del tesoro');
  assert.equal(bonus.coins, state.frenzy.caught * 10); assert.equal(bonus.gems, state.frenzy.gems);
  const practice = ready(0, true); practice.score = MISSION_WORDS - 1; complete(practice); tickRun(practice, 2);
  for (let i = 0; i < BOSS_HITS; i++) complete(practice);
  assert.equal(practice.mode, 'ended'); assert.equal(practice.frenzy, undefined);
});
