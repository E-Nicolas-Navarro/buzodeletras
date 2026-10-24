// Letter album: every key is a fish rescued by typing it well. It also picks the letters
// that need practice, so the next dives bring more words with them.
export const ALBUM_ROWS = [
  { id: 'arriba', title: 'Fila de arriba', letters: 'qwertyuiop' },
  { id: 'centro', title: 'Fila central', letters: 'asdfghjklñ' },
  { id: 'abajo', title: 'Fila de abajo', letters: 'zxcvbnm' }
];
export const LETTERS = ALBUM_ROWS.map(row => row.letters).join('');
// A fish is rescued after `hits` correct presses while the last `recent` tries are at least `accuracy`% right.
export const RESCUE = { hits: 15, accuracy: 85, recent: 20 };
export const ALBUM_PRIZE = { fish: 20, row: 3, album: 10 };

// The album key of a typed character: accents ride on their vowel, Ñ is its own fish.
export function letterKey(char) {
  if (!char) return null;
  const key = /ñ/i.test(char) ? 'ñ' : char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return key.length === 1 && LETTERS.includes(key) ? key : null;
}
export const emptyAlbum = () => ({ letters: {}, caught: [] });
const count = value => Number.isFinite(value) && value > 0 ? Math.min(1e7, Math.floor(value)) : 0;
export function sanitizeAlbum(raw) {
  const album = emptyAlbum();
  if (!raw || typeof raw !== 'object') return album;
  for (const letter of LETTERS) {
    const entry = raw.letters?.[letter];
    if (!entry || typeof entry !== 'object') continue;
    const recent = typeof entry.recent === 'string' ? entry.recent.replace(/[^01]/g, '').slice(-RESCUE.recent) : '';
    album.letters[letter] = { ok: count(entry.ok), miss: count(entry.miss), recent };
  }
  const caught = Array.isArray(raw.caught) ? raw.caught : [];
  album.caught = [...LETTERS].filter(letter => caught.includes(letter));
  return album;
}
export function accuracyOf(entry) {
  if (!entry?.recent) return 0;
  return Math.round(100 * [...entry.recent].filter(hit => hit === '1').length / entry.recent.length);
}
export const progressOf = entry => Math.min(1, (entry?.ok || 0) / RESCUE.hits);
export const isReady = entry => Boolean(entry) && entry.ok >= RESCUE.hits && accuracyOf(entry) >= RESCUE.accuracy;

// `tally` comes from a run: for each letter, its tries in order ('1' right, '0' wrong).
export function recordRun(album, tally = {}) {
  const next = sanitizeAlbum(album), fresh = [];
  for (const letter of LETTERS) {
    const tries = String(tally[letter] || '').replace(/[^01]/g, '');
    if (!tries) continue;
    const entry = next.letters[letter] ||= { ok: 0, miss: 0, recent: '' };
    const hits = [...tries].filter(hit => hit === '1').length;
    entry.ok += hits; entry.miss += tries.length - hits;
    entry.recent = (entry.recent + tries).slice(-RESCUE.recent);
    if (!next.caught.includes(letter) && isReady(entry)) fresh.push(letter);
  }
  const had = new Set(next.caught);
  next.caught = [...LETTERS].filter(letter => had.has(letter) || fresh.includes(letter));
  const done = row => [...row.letters].every(letter => next.caught.includes(letter));
  const rows = ALBUM_ROWS.filter(row => done(row) && ![...row.letters].every(letter => had.has(letter)));
  const complete = next.caught.length === LETTERS.length && had.size < LETTERS.length;
  return { album: next, fresh, rows, complete };
}
export function albumRewards({ fresh = [], rows = [], complete = false }) {
  const items = [];
  if (fresh.length) items.push({ label: `${fresh.length === 1 ? 'Nuevo pez' : 'Nuevos peces'} en tu álbum: ${fresh.map(letter => letter.toUpperCase()).join(', ')}`, coins: fresh.length * ALBUM_PRIZE.fish, gems: 0, candy: 0 });
  for (const row of rows) items.push({ label: `¡Completaste la ${row.title.toLowerCase()} del álbum!`, coins: 0, gems: ALBUM_PRIZE.row, candy: 0 });
  if (complete) items.push({ label: '¡Álbum completo!', coins: 0, gems: ALBUM_PRIZE.album, candy: 0 });
  return items;
}
// Letters that need practice: enough recent tries and the lowest accuracy first.
export function weakLetters(album, allowed = LETTERS, limit = 3) {
  return [...LETTERS].filter(letter => allowed.includes(letter))
    .map(letter => ({ letter, entry: album.letters[letter] }))
    .filter(({ entry }) => entry && entry.recent.length >= 6 && accuracyOf(entry) < 90)
    .sort((a, b) => accuracyOf(a.entry) - accuracyOf(b.entry) || b.entry.miss - a.entry.miss)
    .slice(0, limit).map(({ letter }) => letter);
}
// Every album letter that appears in a list of words.
export function lettersIn(words) {
  return [...new Set(words.flatMap(word => [...word].map(letterKey).filter(Boolean)))].join('');
}
