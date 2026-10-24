// Daily missions, a streak of days and permanent medals. Everything is decided on this
// device from the date and the dives played; nothing is sent anywhere.
import { LEVELS, accuracy } from './engine.js';

const DAY = 86400000;
export function dayKey(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const previousDay = key => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(new Date(y, m - 1, d).getTime() - DAY / 2)); };
function hash(text) {
  let value = 0x811c9dc5;
  for (const char of text) { value ^= char.codePointAt(0); value = Math.imul(value, 0x01000193) >>> 0; }
  return value;
}

// What one dive did, from the engine state at the end.
export function summarizeRun(state) {
  const tries = Object.entries(state.letters || {});
  const right = rows => tries.filter(([letter]) => rows.includes(letter)).reduce((sum, [, seq]) => sum + [...seq].filter(hit => hit === '1').length, 0);
  return {
    world: LEVELS[state.level]?.id, words: state.score, won: Boolean(state.won), relaxed: Boolean(state.relaxed), coop: Boolean(state.coop),
    boss: state.won ? state.boss?.kind || null : null, collisions: state.collisions + (state.partnerCollisions || 0),
    accuracy: accuracy(state.attempts, state.mistakes), bestStreak: state.bestStreak, frenzy: state.frenzy?.caught || 0,
    whales: state.whales || 0, golden: state.golden || 0,
    letters: right('qwertyuiopasdfghjklñzxcvbnm'), top: right('qwertyuiop'), bottom: right('zxcvbnm')
  };
}

// One mission of each tier per day. `add` is how much a dive counts toward `goal`.
const POOL = [
  [
    { id: 'words', text: 'Escribí 30 palabras', goal: 30, reward: 40, add: run => run.words },
    { id: 'dives', text: 'Hacé 2 inmersiones', goal: 2, reward: 30, add: () => 1 },
    { id: 'letters', text: 'Escribí bien 150 letras', goal: 150, reward: 40, add: run => run.letters }
  ],
  [
    { id: 'streak', text: 'Hacé una racha de 10 palabras sin errores', goal: 10, reward: 50, best: true, add: run => run.bestStreak },
    { id: 'precise', text: 'Terminá una partida con 95 % de precisión (10 palabras o más)', goal: 1, reward: 50, add: run => run.words >= 10 && run.accuracy >= 95 ? 1 : 0 },
    { id: 'guardian', text: 'Calmá a un guardián', goal: 1, reward: 60, add: run => run.won ? 1 : 0 },
    { id: 'treasure', text: 'Atrapá 8 tesoros en el frenesí', goal: 8, reward: 50, add: run => run.frenzy },
    { id: 'clean', text: 'Ganá en modo desafío sin que te toque un tiburón', goal: 1, reward: 70, add: run => run.won && !run.relaxed && !run.collisions ? 1 : 0 }
  ],
  [
    { id: 'top', text: 'Escribí bien 40 letras de la fila de arriba', goal: 40, reward: 40, add: run => run.top },
    { id: 'bottom', text: 'Escribí bien 40 letras de la fila de abajo', goal: 40, reward: 40, add: run => run.bottom },
    ...LEVELS.map(level => ({ id: `world-${level.id}`, text: `Jugá una partida en el mundo «${level.tip}»`, goal: 1, reward: 40, add: run => run.world === level.id ? 1 : 0 }))
  ]
];
export const MISSIONS = POOL.flat();
export const DAILY_BONUS = { gems: 2 };
export function dailyMissions(day) {
  return POOL.map((tier, i) => tier[hash(`${day}:${i}`) % tier.length]);
}

// Gems for keeping a streak of days with at least one finished mission.
export function streakPrize(days) { return days === 3 ? 1 : days >= 7 && days % 7 === 0 ? 3 : 0; }

// Medals: `has` decides with this dive and the lifetime numbers; `count` shows progress toward `goal`.
export const MEDALS = [
  { id: 'first', icon: '🤿', name: 'Primera inmersión', how: 'Terminá tu primera partida.', coins: 20, has: c => c.stats.runs >= 1 },
  { id: 'guardian', icon: '🛡️', name: 'Calmaguardianes', how: 'Calmá a cualquier guardián.', coins: 50, has: c => c.stats.wins >= 1 },
  { id: 'otto', icon: '🐙', name: 'Amigo de Otto', how: 'Calmá a Otto, el pulpo.', coins: 40, gems: 1, has: c => c.stats.beaten.includes('otto') },
  { id: 'pinza', icon: '🦀', name: 'Amigo de Don Pinza', how: 'Calmá a Don Pinza en la fila de arriba.', coins: 40, gems: 1, has: c => c.stats.beaten.includes('pinza') },
  { id: 'medusa', icon: '👑', name: 'Amigo de la Reina Medusa', how: 'Calmá a la Reina Medusa en la fila de abajo.', coins: 40, gems: 1, has: c => c.stats.beaten.includes('medusa') },
  { id: 'clean', icon: '✨', name: 'Sin un rasguño', how: 'Ganá en modo desafío sin que te toque un tiburón.', coins: 60, gems: 1, has: c => c.stats.cleanWins >= 1 },
  { id: 'streak20', icon: '🔥', name: 'Racha de 20', how: 'Escribí 20 palabras seguidas sin errores.', coins: 50, goal: 20, count: c => c.stats.bestStreak },
  { id: 'streak50', icon: '☄️', name: 'Racha de 50', how: 'Escribí 50 palabras seguidas sin errores.', coins: 100, gems: 2, goal: 50, count: c => c.stats.bestStreak },
  { id: 'perfect', icon: '💯', name: 'Dedos perfectos', how: 'Terminá una partida de 20 palabras o más sin ningún error.', coins: 80, gems: 1, has: c => c.stats.perfect >= 1 },
  { id: 'rain', icon: '🌧️', name: 'Lluvia de tesoros', how: 'Atrapá 15 tesoros en un solo frenesí.', coins: 60, goal: 15, count: c => c.stats.bestFrenzy },
  { id: 'whale', icon: '🐋', name: 'Amigo de las ballenas', how: 'Escribí la palabra de una ballena.', coins: 30, has: c => c.stats.whales >= 1 },
  { id: 'golden', icon: '🦈', name: 'Cazador dorado', how: 'Escribí la palabra de un tiburón dorado.', coins: 30, has: c => c.stats.golden >= 1 },
  { id: 'fish5', icon: '🐠', name: 'Coleccionista', how: 'Rescatá 5 peces del álbum.', coins: 40, goal: 5, count: c => c.fish },
  { id: 'fish15', icon: '🐟', name: 'Gran coleccionista', how: 'Rescatá 15 peces del álbum.', coins: 80, gems: 1, goal: 15, count: c => c.fish },
  { id: 'fish27', icon: '🏆', name: 'Álbum completo', how: 'Rescatá los 27 peces del álbum.', coins: 150, gems: 3, goal: 27, count: c => c.fish },
  { id: 'explorer', icon: '🗺️', name: 'Explorador', how: 'Ganá al menos una estrella en los cinco mundos.', coins: 100, gems: 2, goal: LEVELS.length, count: c => LEVELS.filter(level => c.stars[level.id] >= 1).length },
  { id: 'master', icon: '⭐', name: 'Maestro del mar', how: 'Conseguí tres estrellas en los cinco mundos.', coins: 200, gems: 5, goal: LEVELS.length, count: c => LEVELS.filter(level => c.stars[level.id] >= 3).length },
  { id: 'team', icon: '🤝', name: 'Trabajo en equipo', how: 'Ganá una partida de a dos.', coins: 50, gems: 1, has: c => c.stats.coopWins >= 1 },
  { id: 'week', icon: '📅', name: 'Una semana bajo el agua', how: 'Cumplí misiones siete días seguidos.', coins: 100, goal: 7, count: c => c.streak },
  { id: 'style', icon: '👕', name: 'A la moda', how: 'Tené 5 trajes o accesorios de la tienda.', coins: 40, goal: 5, count: c => c.owned }
];
export const medalDone = (medal, context) => medal.has ? medal.has(context) : medal.count(context) >= medal.goal;

const emptyStats = () => ({ runs: 0, wins: 0, cleanWins: 0, coopWins: 0, perfect: 0, bestStreak: 0, bestFrenzy: 0, whales: 0, golden: 0, beaten: [] });
export const emptyMissions = () => ({ day: '', progress: {}, done: [], bonus: false, streak: { days: 0, last: '' }, medals: [], stats: emptyStats() });
const count = value => Number.isFinite(value) && value > 0 ? Math.min(1e7, Math.floor(value)) : 0;
const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
export function sanitizeMissions(raw) {
  const clean = emptyMissions();
  if (!raw || typeof raw !== 'object') return clean;
  clean.day = isDay(raw.day);
  for (const mission of MISSIONS) if (raw.progress && count(raw.progress[mission.id])) clean.progress[mission.id] = count(raw.progress[mission.id]);
  clean.done = MISSIONS.map(mission => mission.id).filter(id => Array.isArray(raw.done) && raw.done.includes(id));
  clean.bonus = raw.bonus === true;
  clean.streak = { days: count(raw.streak?.days), last: isDay(raw.streak?.last) };
  clean.medals = MEDALS.map(medal => medal.id).filter(id => Array.isArray(raw.medals) && raw.medals.includes(id));
  for (const key of Object.keys(clean.stats)) if (key !== 'beaten') clean.stats[key] = count(raw.stats?.[key]);
  clean.stats.beaten = ['otto', 'pinza', 'medusa'].filter(kind => Array.isArray(raw.stats?.beaten) && raw.stats.beaten.includes(kind));
  return clean;
}
// The streak as it stands today: it is lost once a whole day passes without a mission.
export function liveStreak(store, today = dayKey()) {
  const { days, last } = store.streak;
  return last === today || last === previousDay(today) ? days : 0;
}
// A new day clears the daily progress but keeps everything else.
export function forDay(store, today = dayKey()) {
  const next = sanitizeMissions(store);
  if (next.day !== today) Object.assign(next, { day: today, progress: {}, done: [], bonus: false });
  return next;
}

// Adds one finished dive. `world` holds what lives elsewhere: { fish, stars, owned }.
export function applyRun(store, run, world = {}, today = dayKey()) {
  const next = forDay(store, today), items = [];
  const { stats } = next;
  stats.runs++;
  if (run.won) { stats.wins++; if (run.boss && !stats.beaten.includes(run.boss)) stats.beaten.push(run.boss); }
  if (run.won && !run.relaxed && !run.collisions) stats.cleanWins++;
  if (run.won && run.coop) stats.coopWins++;
  if (run.words >= 20 && run.accuracy === 100) stats.perfect++;
  stats.bestStreak = Math.max(stats.bestStreak, run.bestStreak); stats.bestFrenzy = Math.max(stats.bestFrenzy, run.frenzy);
  stats.whales += run.whales; stats.golden += run.golden;
  const finished = [];
  for (const mission of dailyMissions(today)) {
    if (next.done.includes(mission.id)) continue;
    const value = mission.add(run);
    next.progress[mission.id] = mission.best ? Math.max(next.progress[mission.id] || 0, value) : (next.progress[mission.id] || 0) + value;
    if (next.progress[mission.id] >= mission.goal) { next.done.push(mission.id); finished.push(mission); items.push({ label: `Misión cumplida: ${mission.text}`, coins: mission.reward, gems: 0, candy: 0 }); }
  }
  if (!next.bonus && next.done.length === dailyMissions(today).length) { next.bonus = true; items.push({ label: '¡Las tres misiones del día!', coins: 0, gems: DAILY_BONUS.gems, candy: 0 }); }
  if (finished.length && next.streak.last !== today) {
    next.streak = { days: liveStreak(next, today) + 1, last: today };
    const gems = streakPrize(next.streak.days);
    if (gems) items.push({ label: `Racha de ${next.streak.days} días seguidos`, coins: 0, gems, candy: 0 });
  }
  const context = { stats, fish: world.fish || 0, stars: world.stars || {}, owned: world.owned || 0, streak: liveStreak(next, today) };
  const medals = MEDALS.filter(medal => !next.medals.includes(medal.id) && medalDone(medal, context));
  for (const medal of medals) { next.medals.push(medal.id); items.push({ label: `Medalla nueva: ${medal.icon} ${medal.name}`, coins: medal.coins, gems: medal.gems || 0, candy: 0 }); }
  return { store: next, items, finished, medals };
}
