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
export function makeDeck(level, random = Math.random) {
  const words = [...LEVELS[level].words];
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
export const OXYGEN = { mistake: 5, collision: 22, reward: 3 };
export function createRun(level, relaxed = false, random = Math.random) {
  return {
    mode: 'diving', level, relaxed, random, diveTime: 0, elapsed: 0,
    score: 0, points: 0, oxygen: 100, depth: 0, visualDepth: 0,
    attempts: 0, mistakes: 0, streak: 0, bestStreak: 0, wave: 1, sharks: [],
    deck: makeDeck(level, random), cursor: 0, nextId: 1,
    spawnIn: 0, targetId: null, input: '', effects: [], won: false, boss: null
  };
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
  const pool = LEVELS[state.level].words.filter(word => !active.some(shark => shark.word === word));
  let word;
  for (let i = 0; i < state.deck.length; i++) {
    const candidate = state.deck[state.cursor++ % state.deck.length];
    if (pool.includes(candidate) && !active.some(shark => shark.word[0] === candidate[0])) { word = candidate; break; }
  }
  word ||= pool.find(candidate => !active.some(shark => shark.word[0] === candidate[0])) || pool[0];
  const side = state.nextId % 2 ? 'left' : 'right';
  const lanes = [0, 1, 2, 3].filter(lane => !active.some(shark => shark.lane === lane));
  const lane = lanes[Math.floor(state.random() * lanes.length)] ?? 0;
  const shark = {
    id: state.nextId++, word, side, lane, progress: 0, departure: null,
    duration: LEVELS[state.level].seconds / (1 + (state.wave - 1) * .18)
  };
  state.sharks.push(shark); ensureTarget(state); return shark;
}
export function currentWord(state) {
  if (['boss', 'bossIntro'].includes(state.mode)) return state.boss.words[state.boss.wordIndex];
  return targetShark(state)?.word;
}
function enterBoss(state) {
  state.mode = 'bossIntro'; state.sharks = []; state.targetId = null; state.input = '';
  // A supply crate at the wreck gives a fair chance after the descent.
  state.oxygen = Math.max(state.oxygen, 60);
  const words = [...LEVELS[state.level].words].filter(word => word.length >= 2).slice(-BOSS_HITS);
  const interval = LEVELS[state.level].seconds * .7;
  state.boss = {
    hp: BOSS_HITS, maxHp: BOSS_HITS, words, wordIndex: 0, introTime: 0,
    attackIn: interval, attackInterval: interval, hitTime: 0, attackTime: 0, defeated: false
  };
}
function endIfNeeded(state) {
  if (state.oxygen <= 0) {
    state.oxygen = 0; state.won = false; state.mode = 'ended';
  } else if (state.mode === 'playing' && state.score >= MISSION_WORDS) {
    enterBoss(state);
  }
}
function recordInput(state, raw, word) {
  const result = assessInput(state.input, raw, word);
  state.input = result.value; state.attempts += result.added; state.mistakes += result.mistakes;
  if (result.mistakes) {
    state.streak = 0;
    if (!state.relaxed) state.oxygen = Math.max(0, state.oxygen - result.mistakes * OXYGEN.mistake);
  }
  return result;
}
function typeBoss(state, raw) {
  const result = recordInput(state, raw, currentWord(state));
  if (result.complete && state.oxygen > 0) {
    state.score++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.boss.hp--; state.boss.wordIndex++; state.boss.hitTime = .5;
    state.boss.attackIn = state.boss.attackInterval;
    let gained = result.value.length * 10 + 50;
    if (!state.relaxed) state.oxygen = Math.min(100, state.oxygen + OXYGEN.reward);
    state.input = '';
    if (state.boss.hp === 0) {
      state.boss.defeated = true; state.won = true; state.mode = 'ended'; gained += 300;
    }
    state.points += gained; result.gained = gained; result.bossHit = true;
    state.effects.push({ text: `−1 tentáculo · +${gained}`, time: 0, kind: 'win' });
  }
  endIfNeeded(state); return result;
}
export function typeInRun(state, raw) {
  if (state.mode === 'boss') return typeBoss(state, raw);
  if (state.mode !== 'playing') return { ignored: true };
  const normalized = normalize(raw);
  // The first letter selects a shark; subsequent letters stay locked to it.
  if (!state.input && normalized) {
    state.targetId = nearestShark(state, normalized[0])?.id ?? state.targetId;
  }
  const target = targetShark(state);
  if (!target) return { ignored: true };
  const result = recordInput(state, raw, target.word);
  if (result.complete && state.oxygen > 0) {
    state.score++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    const gained = target.word.length * 10 + Math.min(state.streak, 5) * 5;
    state.points += gained; state.depth = state.score * 10;
    state.wave = Math.min(4, 1 + Math.floor(state.score / 6));
    if (!state.relaxed) state.oxygen = Math.min(100, state.oxygen + OXYGEN.reward);
    target.departure = 'saved'; target.exitTime = 0;
    state.effects.push({ text: `+${gained}`, time: 0, kind: 'win' });
    state.targetId = null; state.input = ''; ensureTarget(state);
    state.spawnIn = Math.min(state.spawnIn, .5);
    result.gained = gained;
  } else if (!state.input) {
    state.targetId = nearestShark(state)?.id ?? null;
  }
  endIfNeeded(state); result.bossStarted = state.mode === 'bossIntro'; return result;
}
export function tickRun(state, dt) {
  if (!['playing', 'diving', 'bossIntro', 'boss'].includes(state.mode)) return [];
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
  state.elapsed += dt;
  for (const effect of state.effects) effect.time += dt;
  state.effects = state.effects.filter(effect => effect.time < 1.2);
  if (state.mode === 'boss') {
    state.boss.hitTime = Math.max(0, state.boss.hitTime - dt);
    state.boss.attackTime = Math.max(0, state.boss.attackTime - dt);
    if (!state.relaxed) {
      state.boss.attackIn -= dt;
      while (state.boss.attackIn <= 0 && state.oxygen > 0) {
        state.oxygen = Math.max(0, state.oxygen - BOSS_ATTACK_DAMAGE); state.streak = 0;
        state.boss.attackIn += state.boss.attackInterval; state.boss.attackTime = .6;
        state.effects.push({ text: `−${BOSS_ATTACK_DAMAGE}% O₂`, time: 0, kind: 'miss' });
        events.push('bossAttack');
      }
    }
    endIfNeeded(state); return events;
  }
  for (const shark of state.sharks) {
    if (shark.departure) { shark.exitTime += dt; continue; }
    if (!state.relaxed) shark.progress = Math.min(1, shark.progress + dt / shark.duration);
    if (shark.progress >= 1) {
      shark.departure = 'collision'; shark.exitTime = 0;
      state.oxygen = Math.max(0, state.oxygen - OXYGEN.collision); state.streak = 0;
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
