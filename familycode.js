// Family codes: a short, readable key for the progress kept online (no account, no personal data).
// Shared by the page and the /api/progress function.
export const CODE_WORDS = ['ORCA', 'PULPO', 'FOCA', 'ALGA', 'CORAL', 'PERLA', 'BALLENA', 'DELFIN', 'MEDUSA', 'TORTUGA', 'CANGREJO', 'ESTRELLA',
  'ANCLA', 'BARCO', 'OLA', 'ISLA', 'FARO', 'TESORO', 'BURBUJA', 'CONCHA', 'NUTRIA', 'PINGUINO', 'CALAMAR', 'MORSA', 'SIRENA', 'ARENA',
  'MAREA', 'VELA', 'BOYA', 'REMO', 'TIBURON', 'NAUTILO'];
// WORD-NNNN-WORD: 32 × 10,000 × 31 combinations.
export function makeFamilyCode(randomInt = max => crypto.getRandomValues(new Uint32Array(1))[0] % max) {
  const first = CODE_WORDS[randomInt(CODE_WORDS.length)], number = String(randomInt(10000)).padStart(4, '0');
  // Two different words read better than VELA-…-VELA.
  const rest = CODE_WORDS.filter(word => word !== first);
  return `${first}-${number}-${rest[randomInt(rest.length)]}`;
}
// Accepts what people actually type: lowercase, spaces or no separators, accents.
export function normalizeFamilyCode(raw) {
  const plain = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const match = /^([A-Z]+)\s*(\d{4})\s*([A-Z]+)$/.exec(plain);
  if (!match || !CODE_WORDS.includes(match[1]) || !CODE_WORDS.includes(match[3])) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
// What may be stored: a progress backup code (see save.js), never anything else.
export const BACKUP_SHAPE = /^BUZO1-[A-Za-z0-9_-]+-[0-9a-f]{8}$/;
export const BACKUP_MAX = 200000;
export const isBackupCode = value => typeof value === 'string' && value.length <= BACKUP_MAX && BACKUP_SHAPE.test(value);
