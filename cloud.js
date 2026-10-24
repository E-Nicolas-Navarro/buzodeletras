// The page side of the family code: talks to /api/progress and remembers which code this
// device uses (`at` is the version it last saved or loaded; `dirty` means changes not saved yet).
import { normalizeFamilyCode } from './familycode.js';

export const emptyCloud = () => ({ code: null, at: 0, dirty: false });
export function sanitizeCloud(raw) {
  const code = normalizeFamilyCode(raw?.code);
  if (!code) return emptyCloud();
  return { code, at: Number.isFinite(raw.at) && raw.at > 0 ? Math.floor(raw.at) : 0, dirty: raw.dirty === true };
}
// Every call resolves to { status, ...body }; a network failure rejects, so callers can tell "offline" apart.
async function call(fetchFn, method, body, query = '') {
  const response = await fetchFn(`/api/progress${query}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined
  });
  let json = {};
  try { json = await response.json(); } catch { /* An empty or broken body still has a status. */ }
  return { ...json, status: response.status };
}
export const createFamily = (fetchFn, data) => call(fetchFn, 'POST', { data });
export const readFamily = (fetchFn, code, meta = false) => call(fetchFn, 'GET', null, `?code=${encodeURIComponent(code)}${meta ? '&meta=1' : ''}`);
export const saveFamily = (fetchFn, code, data, base) => call(fetchFn, 'PUT', { code, data, base });
// "hace un rato", "hace 5 minutos", "hace 2 horas", "el 3 de nov".
export function savedAgo(at, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return `el ${new Date(at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
}
