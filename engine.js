export const LEVELS = [
  { name: 'El arrecife de las primeras letras', words: ['fff', 'jjj', 'fjf', 'jfj', 'asa', 'ala', 'sala', 'las', 'da', 'falla', 'falda', 'sal'], seconds: 28 },
  { name: 'La laguna de las palabras', words: ['mar', 'ola', 'pez', 'sol', 'sal', 'azul', 'alga', 'isla', 'roca', 'luna', 'faro', 'remo', 'agua', 'bote', 'pato', 'nado'], seconds: 24 },
  { name: 'La expedición al mar abierto', words: ['buzo', 'coral', 'barco', 'pulpo', 'arena', 'perla', 'delfín', 'océano', 'tiburón', 'estrella', 'caballito', 'cangrejo', 'tesoro', 'ballena', 'esponja', 'pequeño', 'pingüino'], seconds: 30 }
];
export const normalize = value => value.toLocaleLowerCase('es').normalize('NFC');
export function fingerFor(char) {
  if (normalize(char) === 'ñ') return { color: 'pink', name: 'meñique derecho', home: 'Ñ' };
  char = normalize(char).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if ('qaz'.includes(char) && char) return { color: 'pink', name: 'meñique izquierdo', home: 'A' };
  if ('wsx'.includes(char) && char) return { color: 'orange', name: 'anular izquierdo', home: 'S' };
  if ('edc'.includes(char) && char) return { color: 'yellow', name: 'medio izquierdo', home: 'D' };
  if ('rfvtgb'.includes(char) && char) return { color: 'mint', name: 'índice izquierdo', home: 'F' };
  if ('yhnujm'.includes(char) && char) return { color: 'mint', name: 'índice derecho', home: 'J' };
  if ('ik'.includes(char) && char) return { color: 'yellow', name: 'medio derecho', home: 'K' };
  if ('ol'.includes(char) && char) return { color: 'orange', name: 'anular derecho', home: 'L' };
  if (char === 'p') return { color: 'pink', name: 'meñique derecho', home: 'Ñ' };
  if (char === ' ') return { color: 'blue', name: 'pulgar', home: 'Espacio' };
  return { color: 'pink', name: 'meñique derecho', home: 'Ñ' };
}
export function makeDeck(level, random = Math.random, extra = []) {
  const words = [...LEVELS[level].words, ...extra];
  for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
  // Start the first adventure at the index-finger anchors, not at a random word.
  if (level === 0) return ['fff', 'jjj', ...words.filter(word => !['fff', 'jjj'].includes(word))].slice(0, 12);
  return words.slice(0, 12);
}
export function assessInput(previous, raw, target) {
  const value = normalize(raw);
  let shared = 0;
  while (shared < previous.length && shared < value.length && previous[shared] === value[shared]) shared++;
  const added = value.slice(shared);
  let mistakes = 0;
  for (let i = shared; i < value.length; i++) if (value[i] !== target[i]) mistakes++;
  return { value, added: added.length, mistakes, valid: target.startsWith(value), complete: value === target };
}
export function accuracy(attempts, mistakes) { return attempts ? Math.round(100 * (attempts - mistakes) / attempts) : 100; }

export const MISSION_WORDS = 24;
export const BOSS_HITS = 8;
export const BOSS_ATTACK_DAMAGE = 18;
export const OXYGEN = { mistake: 5, collision: 22, reward: 3, whale: 12 };
// Each correct new letter against Otto buys a little time; a finished phrase resets his clock.
export const BOSS_LETTER_BONUS = .3;
// After Otto, the crew's boat drops treasure for a few seconds: catch it by typing, double points, no oxygen at stake.
export const FRENZY = { seconds: 15, intro: 1.5, max: 5, lanes: 5, fall: [5.5, 5, 5.5], gems: 2 };
// Creature drawn for a word: short words are puffers, long ones hammerheads.
export function creatureFor(word) { return word.length <= 3 ? 'puffer' : word.length >= 7 ? 'hammer' : 'shark'; }
export function createRun(level, relaxed = false, random = Math.random, options = {}) {
  // Seasonal words join the deck from the second level on; the first one trains home-row fingers only.
  const extra = level > 0 && Array.isArray(options.eventWords) ? options.eventWords.filter(word => typeof word === 'string' && word) : [];
  return {
    words: [...LEVELS[level].words, ...extra], event: options.event || null, golden: 0, whaleSeen: false, whales: 0,
    mode: 'diving', level, relaxed, random, diveTime: 0, elapsed: 0,
    score: 0, points: 0, oxygen: 100, depth: 0, visualDepth: 0,
    attempts: 0, mistakes: 0, collisions: 0, streak: 0, bestStreak: 0, wave: 1, sharks: [],
    deck: makeDeck(level, random, extra), cursor: 0, nextId: 1,
    spawnIn: 0, targetId: null, input: '', effects: [], won: false, boss: null,
    // Two-player team: oxygen, words and Otto's tentacles are shared between devices.
    coop: Boolean(options.coop), side: options.coop ? 'left' : null, partnerScore: 0, partnerCollisions: 0, pendingHits: 0
  };
}
// Coins and gems earned when a run ends. Bonuses reward a clean dive and only
// apply to a finished level in challenge mode (practice sharks never move).
export function computeRewards(state) {
  const items = [];
  const add = (label, coins, gems = 0, candy = 0) => items.push({ label, coins, gems, candy });
  if (state.relaxed) {
    add('Práctica sin apuro', state.score * 2);
  } else if (!state.won) {
    add('Palabras escritas', state.score * 3);
  } else {
    add('Nivel completado', 60 + state.level * 30 + Math.floor(state.points / 40), 1 + state.level);
    if (state.frenzy?.caught) add('Frenesí del tesoro', state.frenzy.caught * 10, state.frenzy.gems);
    const hits = state.collisions + state.partnerCollisions;
    if (hits === 0) add(state.coop ? '¡Ningún tiburón los tocó!' : '¡Ningún tiburón te tocó!', 120, 3);
    else if (hits <= 2) add(state.coop ? 'Pocos tiburones los alcanzaron' : 'Pocos tiburones te alcanzaron', 50, 1);
    if (state.coop) add('¡Ganaron juntos!', 50, 1);
    if (accuracy(state.attempts, state.mistakes) >= 95) add('Letras casi perfectas', 50, 0);
  }
  // Golden sharks and seasonal candy are kept even when the dive ends early.
  if (state.golden) add(state.golden === 1 ? 'Tiburón dorado' : 'Tiburones dorados', 0, state.golden);
  if (state.event && state.score) add('Caramelos de Halloween', 0, 0, state.score + (state.won ? 15 : 0));
  const sum = key => items.reduce((total, item) => total + item[key], 0);
  return { items, coins: sum('coins'), gems: sum('gems'), candy: sum('candy') };
}
// 0 stars unless a level was finished in challenge mode; fewer sharks, more stars.
export function starsFor(state) {
  if (!state.won || state.relaxed) return 0;
  const hits = state.collisions + state.partnerCollisions;
  return hits === 0 ? 3 : hits <= 2 ? 2 : 1;
}
export function activeSharks(state) { return state.sharks.filter(shark => !shark.departure); }
export function capacity(state) { return Math.min(4, 1 + Math.floor(state.score / 4)); }
export function nearestShark(state, prefix = '') {
  return activeSharks(state).filter(shark => shark.word.startsWith(prefix))
    .sort((a, b) => b.progress - a.progress || a.id - b.id)[0];
}
export function targetShark(state) { return activeSharks(state).find(shark => shark.id === state.targetId); }
export function chooseTarget(state, id) {
  if (state.mode !== 'playing' || !activeSharks(state).some(shark => shark.id === id)) return;
  state.targetId = id; state.input = '';
}
function ensureTarget(state) {
  if (!targetShark(state)) { state.targetId = nearestShark(state)?.id ?? null; state.input = ''; }
}
export function spawnShark(state) {
  if (state.mode !== 'playing') return null;
  const active = activeSharks(state);
  if (active.length >= capacity(state)) return null;
  // No duplicate words on screen; favor different first letters for targeting.
  const pool = state.words.filter(word => !active.some(shark => shark.word === word));
  let word;
  for (let i = 0; i < state.deck.length; i++) {
    const candidate = state.deck[state.cursor++ % state.deck.length];
    if (pool.includes(candidate) && !active.some(shark => shark.word[0] === candidate[0])) { word = candidate; break; }
  }
  word ||= pool.find(candidate => !active.some(shark => shark.word[0] === candidate[0])) || pool[0];
  const side = state.side || (state.nextId % 2 ? 'left' : 'right');
  const lanes = [0, 1, 2, 3].filter(lane => !active.some(shark => shark.lane === lane));
  const lane = lanes[Math.floor(state.random() * lanes.length)] ?? 0;
  const shark = {
    id: state.nextId++, word, side, lane, progress: 0, departure: null, flinch: 0, kind: creatureFor(word),
    duration: LEVELS[state.level].seconds / (1 + (state.wave - 1) * .18)
  };
  // Rare visitors: one friendly whale per dive (it gives oxygen, never hurts) and a few golden sharks.
  if (!state.whaleSeen && state.score >= 8 && state.random() < .3) { state.whaleSeen = true; shark.kind = 'whale'; shark.duration *= 1.4; }
  else if (state.score >= 2 && state.golden + activeSharks(state).filter(other => other.kind === 'golden').length < 2 && state.random() < .07) { shark.kind = 'golden'; shark.duration *= .85; }
  state.sharks.push(shark); ensureTarget(state); return shark;
}
export function currentWord(state) {
  if (['boss', 'bossIntro'].includes(state.mode)) return state.boss.words[state.boss.wordIndex];
  if (state.mode === 'frenzy' && state.frenzy.intro > 0) return null;
  return targetShark(state)?.word;
}
function enterBoss(state) {
  state.mode = 'bossIntro'; state.sharks = []; state.targetId = null; state.input = '';
  // A supply crate at the wreck gives a fair chance after the descent (solo only: team oxygen is shared).
  if (!state.coop) state.oxygen = Math.max(state.oxygen, 60);
  const pool = LEVELS[state.level].words.slice(-BOSS_HITS);
  const words = pool.map((word, i) => `${word} ${pool[(i + 3) % pool.length]}`);
  const interval = [9, 8, 10][state.level];
  state.boss = {
    hp: BOSS_HITS, maxHp: BOSS_HITS, words, wordIndex: 0, introTime: 0,
    attackIn: interval, attackInterval: interval, hitTime: 0, attackTime: 0, defeated: false, reach: 0
  };
  while (state.pendingHits > 0) { state.pendingHits--; partnerBossHit(state); }
}
export function bossAttackDamage(state) { return state.coop ? BOSS_ATTACK_DAMAGE / 2 : BOSS_ATTACK_DAMAGE; }
// Re-check win/lose/boss conditions after a partner message changed shared state.
export function refreshRun(state) { endIfNeeded(state); }
// A tentacle calmed by the partner's device.
export function partnerBossHit(state) {
  if (!state.boss) { state.pendingHits++; return; }
  if (state.boss.hp <= 0 || !['bossIntro', 'boss'].includes(state.mode)) return;
  state.boss.hp--; state.boss.hitTime = .5;
  calmBoss(state.boss);
  if (state.boss.hp === 0) { state.points += 300; defeatBoss(state); }
}
// Otto becomes a friend. In challenge mode the treasure frenzy follows; practice ends right away.
function defeatBoss(state) {
  state.boss.defeated = true; state.won = true; state.input = '';
  if (state.relaxed) { state.mode = 'ended'; return; }
  state.mode = 'frenzy'; state.sharks = []; state.targetId = null;
  state.frenzy = { time: FRENZY.seconds, intro: FRENZY.intro, spawnIn: 0, caught: 0, missed: 0, gems: 0, combo: 0, bestCombo: 0, points: 0 };
}
// Treasure falls from the boat into one of a few columns, never on top of a fresh one.
export function dropLoot(state) {
  if (state.mode !== 'frenzy') return null;
  const f = state.frenzy, active = activeSharks(state);
  if (active.length >= FRENZY.max) return null;
  const pool = state.words.filter(word => !active.some(loot => loot.word[0] === word[0]));
  const lanes = [...Array(FRENZY.lanes).keys()].filter(lane => !active.some(loot => loot.lane === lane && loot.progress < .4));
  if (!pool.length || !lanes.length) return null;
  const word = pool[Math.floor(state.random() * pool.length)];
  const lane = lanes[Math.floor(state.random() * lanes.length)];
  // It speeds up as the clock runs out.
  const hurry = 1 - .35 * (1 - f.time / FRENZY.seconds);
  const gems = f.gems + active.filter(loot => loot.kind === 'gem').length;
  const loot = {
    id: state.nextId++, word, side: 'top', lane, progress: 0, departure: null, flinch: 0, exitTime: 0,
    kind: gems < FRENZY.gems && state.random() < .12 ? 'gem' : 'coin', duration: FRENZY.fall[state.level] * hurry
  };
  state.sharks.push(loot); ensureTarget(state); return loot;
}
// A calmed tentacle resets Otto's clock. Halfway through he gets faster.
function calmBoss(boss) {
  if (boss.hp === BOSS_HITS / 2) boss.attackInterval *= .7;
  boss.attackIn = boss.attackInterval;
}
function endIfNeeded(state) {
  if (state.mode === 'frenzy') return;
  if (state.oxygen <= 0) {
    state.oxygen = 0; state.won = false; state.mode = 'ended';
  } else if (state.mode === 'playing' && state.score + state.partnerScore >= MISSION_WORDS) {
    enterBoss(state);
  }
}
function recordInput(state, raw, word) {
  const result = assessInput(state.input, raw, word);
  state.input = result.value; state.attempts += result.added; state.mistakes += result.mistakes;
  if (result.mistakes) {
    state.streak = 0;
    if (!state.relaxed && state.mode !== 'frenzy') state.oxygen = Math.max(0, state.oxygen - result.mistakes * OXYGEN.mistake);
  }
  return result;
}
// Length of the correctly typed start of the phrase.
function correctPrefix(value, target) {
  let i = 0;
  while (i < value.length && value[i] === target[i]) i++;
  return i;
}
function typeBoss(state, raw) {
  const phrase = currentWord(state);
  const result = recordInput(state, raw, phrase);
  // Only letters beyond the furthest point reached count, so deleting and retyping earns nothing.
  const reached = correctPrefix(state.input, phrase);
  if (reached > state.boss.reach && !state.relaxed) {
    state.boss.attackIn = Math.min(state.boss.attackInterval, state.boss.attackIn + (reached - state.boss.reach) * BOSS_LETTER_BONUS);
    state.boss.reach = reached;
  }
  if (result.complete && state.oxygen > 0) {
    state.score++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.boss.hp--; state.boss.wordIndex++; state.boss.hitTime = .5; state.boss.reach = 0;
    calmBoss(state.boss);
    let gained = result.value.length * 10 + 50;
    if (!state.relaxed) state.oxygen = Math.min(100, state.oxygen + OXYGEN.reward);
    state.input = '';
    if (state.boss.hp === 0) { gained += 300; defeatBoss(state); result.frenzy = state.mode === 'frenzy'; }
    state.points += gained; result.gained = gained; result.bossHit = true;
    state.effects.push({ text: `−1 tentáculo · +${gained}`, time: 0, kind: 'win' });
  }
  endIfNeeded(state); return result;
}
function typeFrenzy(state, raw) {
  const f = state.frenzy;
  if (f.intro > 0) return { ignored: true };
  const normalized = normalize(raw);
  if (!state.input && normalized) state.targetId = nearestShark(state, normalized[0])?.id ?? state.targetId;
  const target = targetShark(state);
  if (!target) return { ignored: true };
  const result = recordInput(state, raw, target.word);
  if (result.mistakes) f.combo = 0;
  if (result.added && !result.mistakes) target.flinch = .25;
  if (result.complete) {
    f.caught++; f.combo++; f.bestCombo = Math.max(f.bestCombo, f.combo);
    state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    // Double points, plus a growing combo while nothing is dropped or mistyped.
    const gained = (target.word.length * 10 + Math.min(f.combo, 10) * 5) * 2;
    state.points += gained; f.points += gained;
    if (target.kind === 'gem') f.gems++;
    target.departure = 'caught'; target.exitTime = 0;
    state.effects.push({ text: target.kind === 'gem' ? '+1 gema' : `+${gained} ×2`, time: 0, kind: 'win' });
    result.kind = target.kind; result.loot = true; result.gained = gained; result.combo = f.combo;
    state.targetId = null; state.input = ''; ensureTarget(state);
    f.spawnIn = Math.min(f.spawnIn, .3);
  } else if (!state.input) {
    state.targetId = nearestShark(state)?.id ?? null;
  }
  return result;
}
function tickFrenzy(state, dt) {
  const f = state.frenzy, events = [];
  if (f.intro > 0) {
    f.intro = Math.max(0, f.intro - dt);
    if (f.intro === 0) { dropLoot(state); f.spawnIn = .8; events.push('frenzyReady'); }
    return events;
  }
  f.time = Math.max(0, f.time - dt);
  for (const loot of state.sharks) {
    loot.flinch = Math.max(0, loot.flinch - dt);
    if (loot.departure) { loot.exitTime += dt; continue; }
    loot.progress = Math.min(1, loot.progress + dt / loot.duration);
    // Missed treasure just sinks into the sand: it only breaks the combo.
    if (loot.progress >= 1) { loot.departure = 'lost'; loot.exitTime = 0; f.missed++; f.combo = 0; events.push('lootLost'); }
  }
  state.sharks = state.sharks.filter(loot => !loot.departure || loot.exitTime < .6);
  ensureTarget(state);
  if (f.time <= 0) {
    state.mode = 'ended'; state.sharks = []; state.targetId = null; state.input = '';
    events.push('frenzyOver'); return events;
  }
  f.spawnIn -= dt;
  if (f.spawnIn <= 0 || !activeSharks(state).length) {
    if (dropLoot(state)) events.push('drop');
    f.spawnIn = .75;
  }
  return events;
}
export function typeInRun(state, raw) {
  if (state.mode === 'boss') return typeBoss(state, raw);
  if (state.mode === 'frenzy') return typeFrenzy(state, raw);
  if (state.mode !== 'playing') return { ignored: true };
  const normalized = normalize(raw);
  // The first letter selects a shark; subsequent letters stay locked to it.
  if (!state.input && normalized) {
    state.targetId = nearestShark(state, normalized[0])?.id ?? state.targetId;
  }
  const target = targetShark(state);
  if (!target) return { ignored: true };
  const result = recordInput(state, raw, target.word);
  if (result.added && !result.mistakes) target.flinch = .25;
  if (result.complete && state.oxygen > 0) {
    state.score++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    const gained = target.word.length * 10 + Math.min(state.streak, 5) * 5;
    state.points += gained; state.depth = state.score * 10;
    state.wave = Math.min(4, 1 + Math.floor(state.score / 6));
    const air = target.kind === 'whale' ? OXYGEN.whale : OXYGEN.reward;
    if (!state.relaxed) state.oxygen = Math.min(100, state.oxygen + air);
    if (target.kind === 'golden') state.golden++;
    if (target.kind === 'whale') state.whales++;
    target.departure = 'saved'; target.exitTime = 0;
    state.effects.push({ text: target.kind === 'whale' && !state.relaxed ? `+${OXYGEN.whale}% O₂` : target.kind === 'golden' ? '+1 gema' : `+${gained}`, time: 0, kind: 'win' });
    result.kind = target.kind;
    state.targetId = null; state.input = ''; ensureTarget(state);
    state.spawnIn = Math.min(state.spawnIn, .5);
    result.gained = gained;
  } else if (!state.input) {
    state.targetId = nearestShark(state)?.id ?? null;
  }
  endIfNeeded(state); result.bossStarted = state.mode === 'bossIntro'; return result;
}
export function tickRun(state, dt) {
  if (!['playing', 'diving', 'bossIntro', 'boss', 'frenzy'].includes(state.mode)) return [];
  const events = [];
  if (state.mode === 'diving') {
    state.diveTime = Math.min(1.6, state.diveTime + dt);
    if (state.diveTime >= 1.6) { state.mode = 'playing'; spawnShark(state); state.spawnIn = 5; events.push('ready'); }
    return events;
  }
  state.visualDepth += (state.depth - state.visualDepth) * Math.min(1, dt * 3);
  if (state.mode === 'bossIntro') {
    state.boss.introTime = Math.min(2, state.boss.introTime + dt);
    if (state.boss.introTime >= 2) { state.mode = 'boss'; events.push('bossReady'); }
    return events;
  }
  for (const effect of state.effects) effect.time += dt;
  state.effects = state.effects.filter(effect => effect.time < 1.2);
  // The frenzy is a bonus: it does not count toward typing speed.
  if (state.mode === 'frenzy') return tickFrenzy(state, dt);
  state.elapsed += dt;
  if (state.mode === 'boss') {
    state.boss.hitTime = Math.max(0, state.boss.hitTime - dt);
    state.boss.attackTime = Math.max(0, state.boss.attackTime - dt);
    if (!state.relaxed) {
      state.boss.attackIn -= dt;
      while (state.boss.attackIn <= 0 && state.oxygen > 0) {
        state.oxygen = Math.max(0, state.oxygen - bossAttackDamage(state)); state.streak = 0;
        state.boss.attackIn += state.boss.attackInterval; state.boss.attackTime = .6;
        state.effects.push({ text: `−${bossAttackDamage(state)}% O₂`, time: 0, kind: 'miss' });
        events.push('bossAttack');
      }
    }
    endIfNeeded(state); return events;
  }
  for (const shark of state.sharks) {
    shark.flinch = Math.max(0, (shark.flinch || 0) - dt);
    if (shark.departure) { shark.exitTime += dt; continue; }
    if (!state.relaxed) shark.progress = Math.min(1, shark.progress + dt / shark.duration);
    if (shark.progress >= 1 && shark.kind === 'whale') {
      // The whale just waves and swims on.
      shark.departure = 'passed'; shark.exitTime = 0; continue;
    }
    if (shark.progress >= 1) {
      shark.departure = 'collision'; shark.exitTime = 0;
      state.oxygen = Math.max(0, state.oxygen - OXYGEN.collision); state.streak = 0; state.collisions++;
      state.effects.push({ text: `−${OXYGEN.collision}% O₂`, time: 0, kind: 'miss' });
      events.push('collision');
    }
  }
  state.sharks = state.sharks.filter(shark => !shark.departure || shark.exitTime < .8);
  ensureTarget(state); endIfNeeded(state);
  if (state.mode !== 'playing') return events;
  state.spawnIn -= dt;
  if (state.spawnIn <= 0 || !activeSharks(state).length) {
    if (spawnShark(state)) events.push('spawn');
    state.spawnIn = Math.max(2.5, 5.5 - state.wave * .7);
  }
  return events;
}
