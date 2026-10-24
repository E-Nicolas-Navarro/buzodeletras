// Numbers for the grown-ups' panel: a short history of dives, this week against the
// last one, and how each key and finger is doing (from the album's recent tries).
import { LEVELS, accuracy, fingerFor } from './engine.js';
import { LETTERS } from './album.js';

export const HISTORY_MAX = 200;
const WEEK = 7 * 86400000;
const count = (value, max = 1e9) => Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : 0;

// One finished dive, as the panel remembers it.
export function runEntry(state, at = Date.now()) {
  const letters = Object.values(state.letters || {}).reduce((sum, tries) => sum + [...tries].filter(hit => hit === '1').length, 0);
  return {
    at, world: LEVELS[state.level]?.id || LEVELS[0].id, relaxed: Boolean(state.relaxed), won: Boolean(state.won),
    words: state.score, letters, attempts: state.attempts, mistakes: state.mistakes, seconds: Math.round(state.elapsed)
  };
}
export function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(entry => entry && typeof entry === 'object').map(entry => ({
    at: count(entry.at, 8.64e15), world: LEVELS.some(level => level.id === entry.world) ? entry.world : LEVELS[0].id,
    relaxed: entry.relaxed === true, won: entry.won === true, words: count(entry.words, 1e4), letters: count(entry.letters, 1e6),
    attempts: count(entry.attempts, 1e6), mistakes: count(entry.mistakes, 1e6), seconds: count(entry.seconds, 86400)
  })).filter(entry => entry.at && entry.mistakes <= entry.attempts).sort((a, b) => a.at - b.at).slice(-HISTORY_MAX);
}
export const addRun = (history, entry) => sanitizeHistory([...history, entry]);
// Correct letters per minute of typing time; very short dives say nothing about speed.
export const speedOf = entry => entry.seconds >= 20 ? Math.round(entry.letters / (entry.seconds / 60)) : null;
export const precisionOf = entry => entry.attempts >= 10 ? accuracy(entry.attempts, entry.mistakes) : null;

const average = values => { const real = values.filter(value => value !== null); return real.length ? Math.round(real.reduce((a, b) => a + b, 0) / real.length) : null; };
function window(history, from, to) {
  const runs = history.filter(entry => entry.at > from && entry.at <= to);
  const days = new Set(runs.map(entry => new Date(entry.at).toDateString())).size;
  return {
    dives: runs.length, days, minutes: Math.round(runs.reduce((sum, entry) => sum + entry.seconds, 0) / 60),
    speed: average(runs.map(speedOf)), precision: average(runs.map(precisionOf))
  };
}
// The last seven days against the seven before.
export function weekStats(history, now = Date.now()) {
  return { now: window(history, now - WEEK, now), before: window(history, now - 2 * WEEK, now - WEEK) };
}
// The latest dives that say something about speed, oldest first.
export const trend = (history, size = 20) => history.filter(entry => speedOf(entry) !== null).slice(-size);

// How each key is doing, from the album's last tries. `bin` 0..4 grows with mistakes; null means no data yet.
export const ERROR_BINS = [5, 10, 20, 35];
export function keyStats(album) {
  return Object.fromEntries([...LETTERS].map(letter => {
    const recent = album.letters[letter]?.recent || '';
    if (recent.length < 5) return [letter, { tries: recent.length, precision: null, bin: null }];
    const precision = Math.round(100 * [...recent].filter(hit => hit === '1').length / recent.length);
    const errors = 100 - precision;
    return [letter, { tries: recent.length, precision, bin: ERROR_BINS.filter(limit => errors >= limit).length }];
  }));
}
export const FINGER_ORDER = ['meñique izquierdo', 'anular izquierdo', 'medio izquierdo', 'índice izquierdo', 'índice derecho', 'medio derecho', 'anular derecho', 'meñique derecho'];
export function fingerStats(album) {
  return FINGER_ORDER.map(name => {
    const letters = [...LETTERS].filter(letter => fingerFor(letter).name === name);
    const tries = letters.map(letter => album.letters[letter]?.recent || '').join('');
    return { name, letters, tries: tries.length, precision: tries.length >= 10 ? Math.round(100 * [...tries].filter(hit => hit === '1').length / tries.length) : null };
  });
}
// Plain advice from the numbers, most useful first.
export function tips({ week, weak = [], fingers = [] }) {
  const out = [];
  if (!week.now.dives) out.push('Esta semana todavía no jugó. Cinco o diez minutos por día rinden más que una sesión larga de vez en cuando.');
  else if (week.now.days < 3) out.push(`Practicó ${week.now.days === 1 ? 'un día' : `${week.now.days} días`} esta semana. Mejor poquito y seguido: la meta ideal son 4 o 5 días con 5 a 10 minutos.`);
  if (week.now.precision !== null && week.now.precision < 85) out.push(`La precisión está en ${week.now.precision} %. Conviene bajar la velocidad: activen «Practicar sin apuro» y que mire la pantalla, no el teclado.`);
  else if (week.now.precision !== null && week.now.precision >= 95) out.push(`Precisión de ${week.now.precision} %: muy bien. Ya puede probar el modo desafío o un mundo más difícil para ganar velocidad.`);
  if (weak.length) out.push(`Las letras que más le cuestan: ${weak.map(letter => letter.toUpperCase()).join(', ')}. El juego ya le da más palabras con ellas; también sirve agregar en «Mis palabras» algunas que las tengan.`);
  const slow = fingers.filter(finger => finger.precision !== null).sort((a, b) => a.precision - b.precision)[0];
  if (slow && slow.precision < 85) out.push(`El dedo que más se equivoca es el ${slow.name} (${slow.precision} % bien, teclas ${slow.letters.map(letter => letter.toUpperCase()).join(' ')}). Las manos guía muestran qué dedo usar en cada letra.`);
  if (!out.length) out.push('Viene muy bien. Celebren las medallas y los peces nuevos: el progreso visible es lo que más motiva.');
  return out;
}
export const worldName = id => LEVELS.find(level => level.id === id)?.tip || id;
