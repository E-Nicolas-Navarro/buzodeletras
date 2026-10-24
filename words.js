// The player's own words (names, pets, favorite things). They join the dives of the
// worlds whose letters they use, so row-only worlds keep practicing their rows.
export const OWN_WORDS = { max: 20, min: 2, length: 14 };
export const cleanWord = raw => String(raw ?? '').trim().toLocaleLowerCase('es').normalize('NFC');
const LETTERS_ONLY = /^[a-zñáéíóúü]+$/;
// Returns the cleaned word, or an error a child can read.
export function checkWord(list, raw) {
  const word = cleanWord(raw);
  if (!word) return { error: 'Escribí una palabra primero.' };
  if (!LETTERS_ONLY.test(word)) return { error: 'Usá solo letras: sin espacios, números ni signos.' };
  if (word.length < OWN_WORDS.min || word.length > OWN_WORDS.length) return { error: `Tiene que tener entre ${OWN_WORDS.min} y ${OWN_WORDS.length} letras.` };
  if (list.includes(word)) return { error: 'Esa palabra ya está en tu lista.' };
  if (list.length >= OWN_WORDS.max) return { error: `Ya tenés ${OWN_WORDS.max} palabras. Borrá alguna para agregar otra.` };
  return { word };
}
export const emptyOwnWords = () => ({ words: [], on: true });
export function sanitizeOwnWords(raw) {
  const clean = emptyOwnWords();
  if (!raw || typeof raw !== 'object') return clean;
  for (const entry of Array.isArray(raw.words) ? raw.words : []) {
    const { word } = checkWord(clean.words, entry);
    if (word) clean.words.push(word);
  }
  clean.on = raw.on !== false;
  return clean;
}
