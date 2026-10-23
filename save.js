// Progress backup: everything lives in the browser, so players can export it as a
// text code (or file) and restore it later or on another device. The checksum only
// catches typos and accidental damage; it is not protection against editing.
import { sanitizeWallet } from './skins.js';
import { LEVELS } from './engine.js';
const PREFIX = 'BUZO1';
const SALT = 'buzo-de-letras';
export const BACKUP_VERSION = 1;

function checksum(text) {
  let hash = 0x811c9dc5;
  for (const char of text + SALT) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, '0');
}
const toBase64Url = text => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = value => new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)));

const count = (value, max = 1e9) => Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : 0;
// Progress used to be keyed by level number (three levels); it is now keyed by world id.
const LEGACY = ['centro', 'laguna', 'mar'];
const worldOf = key => LEGACY[key] || (LEVELS.some(level => level.id === key) ? key : null);
export function sanitizeStars(raw) {
  const stars = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return stars;
  for (const [key, value] of Object.entries(raw)) {
    const id = worldOf(key);
    if (id && count(value, 3)) stars[id] = Math.max(stars[id] || 0, count(value, 3));
  }
  return stars;
}
export function sanitizeRecords(raw) {
  const records = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return records;
  for (const [key, entry] of Object.entries(raw)) {
    const [, world, mode] = /^([a-z0-9]+)-(practice|challenge)$/.exec(key) || [];
    const id = worldOf(world);
    if (!id || !entry || typeof entry !== 'object') continue;
    const clean = { points: count(entry.points), depth: count(entry.depth, 1000), accuracy: count(entry.accuracy, 100) };
    if (!records[`${id}-${mode}`] || clean.points > records[`${id}-${mode}`].points) records[`${id}-${mode}`] = clean;
  }
  return records;
}
export function makeBackup({ wallet, stars, records, sound }, now = Date.now()) {
  const data = { v: BACKUP_VERSION, at: now, wallet: sanitizeWallet(wallet), stars: sanitizeStars(stars), records: sanitizeRecords(records), sound: sound !== false };
  const payload = toBase64Url(JSON.stringify(data));
  return `${PREFIX}-${payload}-${checksum(payload)}`;
}
// Returns the cleaned data, or null when the text is not a valid backup.
export function readBackup(text) {
  try {
    const match = /^BUZO1-([A-Za-z0-9_-]+)-([0-9a-f]{8})$/.exec(String(text ?? '').replace(/\s+/g, ''));
    if (!match || checksum(match[1]) !== match[2]) return null;
    const data = JSON.parse(fromBase64Url(match[1]));
    if (!data || data.v !== BACKUP_VERSION) return null;
    return { at: count(data.at, 8.64e15), wallet: sanitizeWallet(data.wallet), stars: sanitizeStars(data.stars), records: sanitizeRecords(data.records), sound: data.sound !== false };
  } catch { return null; }
}
export function describeBackup(data) {
  const stars = Object.values(data.stars).reduce((sum, value) => sum + value, 0);
  const candy = data.wallet.candy ? `${data.wallet.candy} caramelos, ` : '';
  return `${data.wallet.coins} monedas, ${data.wallet.gems} gemas, ${candy}${data.wallet.owned.length} ${data.wallet.owned.length === 1 ? 'objeto' : 'objetos'} y ${stars} ${stars === 1 ? 'estrella' : 'estrellas'}`;
}
export const DAY = 86400000;
// A backup is worth suggesting once there is something to lose and it is not recent.
export function needsBackup(wallet, lastBackup, now = Date.now()) {
  const progress = wallet.coins + wallet.gems > 0 || wallet.owned.length > 1;
  return progress && (!lastBackup || now - lastBackup > 7 * DAY);
}
export function backupAge(lastBackup, now = Date.now()) {
  if (!lastBackup) return 'todavía no guardaste un respaldo';
  const days = Math.floor((now - lastBackup) / DAY);
  return days < 1 ? 'último respaldo: hoy' : `último respaldo: hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
