import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE_WORDS, makeFamilyCode, normalizeFamilyCode, isBackupCode } from '../familycode.js';
import { createHandler } from '../api/progress.js';
import { emptyCloud, sanitizeCloud, createFamily, readFamily, saveFamily, savedAgo } from '../cloud.js';
import { makeBackup } from '../save.js';
import { emptyWallet } from '../skins.js';

const backup = coins => makeBackup({ wallet: { ...emptyWallet(), coins }, stars: {}, records: {}, sound: true }, 1000);
// A Redis stand-in that follows the same rules as the Lua save script.
function fakeRedis() {
  const store = new Map();
  return {
    store,
    async hgetall(key) { return store.has(key) ? { ...store.get(key) } : null; },
    async eval(_script, [key], [mode, base, at, data]) {
      const current = store.get(key)?.at;
      if (mode === 'create') { if (current) return -1; }
      else { if (!current) return -2; if (String(current) !== base) return Number(current); }
      store.set(key, { at: Number(at), data }); return 0;
    }
  };
}
const request = (method, body, query = '') => new Request(`http://local/api/progress${query}`, { method, body: body && JSON.stringify(body) });

test('family codes: readable, typed loosely, only real words', () => {
  let i = 0; const code = makeFamilyCode(max => [2, 4821, 30][i++] % max);
  assert.equal(code, 'FOCA-4821-NAUTILO');
  // The two words are never the same.
  assert.ok(Array.from({ length: 200 }, () => makeFamilyCode().split('-')).every(([a, , b]) => a !== b));
  assert.equal(normalizeFamilyCode(' foca 4821 tiburón '), 'FOCA-4821-TIBURON');
  assert.equal(normalizeFamilyCode('foca4821tiburon'), 'FOCA-4821-TIBURON');
  for (const bad of ['', 'FOCA-482-TIBURON', 'GATO-1234-FOCA', 'FOCA-1234', null]) assert.equal(normalizeFamilyCode(bad), null, String(bad));
  assert.equal(new Set(CODE_WORDS).size, 32);
  assert.ok(isBackupCode(backup(5))); assert.ok(!isBackupCode('hola')); assert.ok(!isBackupCode(`${backup(5)}x`));
});
test('the function creates, reads and saves progress, and refuses a stale save', async () => {
  const redis = fakeRedis(); let clock = 1000; const codes = ['ORCA-0001-FOCA', 'ORCA-0001-FOCA', 'ISLA-0002-OLA'];
  const handle = createHandler({ redis, prefix: 't:', now: () => clock++, newCode: () => codes.shift() });
  const first = await (await handle(request('POST', { data: backup(1) }))).json();
  assert.deepEqual(first, { code: 'ORCA-0001-FOCA', at: 1000 });
  // A taken code is never overwritten: the next one is used.
  const second = await handle(request('POST', { data: backup(2) }));
  assert.equal(second.status, 201); assert.equal((await second.json()).code, 'ISLA-0002-OLA');
  const read = await handle(request('GET', null, '?code=orca 0001 foca'));
  assert.equal(read.status, 200); assert.equal((await read.json()).data, backup(1));
  const meta = await (await handle(request('GET', null, '?code=ORCA-0001-FOCA&meta=1'))).json();
  assert.deepEqual(meta, { code: 'ORCA-0001-FOCA', at: 1000 });
  const saved = await handle(request('PUT', { code: 'ORCA-0001-FOCA', data: backup(3), base: 1000 }));
  assert.equal(saved.status, 200); const { at } = await saved.json();
  const stale = await handle(request('PUT', { code: 'ORCA-0001-FOCA', data: backup(4), base: 1000 }));
  assert.equal(stale.status, 409); assert.deepEqual(await stale.json(), { at });
  assert.equal(redis.store.get('t:ORCA-0001-FOCA').data, backup(3));
  assert.equal((await handle(request('PUT', { code: 'PERLA-9999-FOCA', data: backup(4), base: 1 }))).status, 404);
  assert.equal((await handle(request('GET', null, '?code=nada'))).status, 400);
  assert.equal((await handle(request('POST', { data: 'no es progreso' }))).status, 400);
  assert.equal((await handle(new Request('http://local/api/progress', { method: 'POST', body: '{roto' }))).status, 400);
  assert.equal((await handle(request('DELETE'))).status, 405);
});
test('the function answers 429 when the limiter says so', async () => {
  const handle = createHandler({ redis: fakeRedis(), prefix: 't:', limiter: { limit: async () => ({ success: false }) } });
  assert.equal((await handle(request('GET', null, '?code=ORCA-0001-FOCA'))).status, 429);
});
test('the page side talks to the function and remembers its code', async () => {
  const handle = createHandler({ redis: fakeRedis(), prefix: 't:', newCode: () => 'MAREA-1234-VELA' });
  const fetchFn = (url, init) => handle(new Request(`http://local${url}`, init));
  const made = await createFamily(fetchFn, backup(7));
  assert.equal(made.status, 201); assert.equal(made.code, 'MAREA-1234-VELA');
  assert.equal((await readFamily(fetchFn, 'marea 1234 vela')).data, backup(7));
  assert.equal((await saveFamily(fetchFn, made.code, backup(8), made.at)).status, 200);
  assert.equal((await saveFamily(fetchFn, made.code, backup(9), made.at)).status, 409);
  assert.deepEqual(sanitizeCloud({ code: 'marea 1234 vela', at: 55.5, dirty: true }), { code: 'MAREA-1234-VELA', at: 55, dirty: true });
  assert.deepEqual(sanitizeCloud({ code: 'x' }), emptyCloud());
  assert.equal(savedAgo(1000, 1000 + 30000), 'recién'); assert.equal(savedAgo(0, 5 * 60000), 'hace 5 minutos'); assert.equal(savedAgo(0, 2 * 3600000), 'hace 2 horas');
});
test('two saves in the same millisecond still get different versions', async () => {
  const handle = createHandler({ redis: fakeRedis(), prefix: 't:', now: () => 5000, newCode: () => 'OLA-0001-ISLA' });
  const made = await (await handle(request('POST', { data: backup(1) }))).json();
  const saved = await (await handle(request('PUT', { code: made.code, data: backup(2), base: made.at }))).json();
  assert.ok(saved.at > made.at);
  assert.equal((await handle(request('PUT', { code: made.code, data: backup(3), base: made.at }))).status, 409);
});
