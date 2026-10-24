// /api/progress: keeps a family's progress in Upstash Redis under its family code.
//   POST { data }               → 201 { code, at }       a new code for this progress
//   GET  ?code=…[&meta=1]       → 200 { code, at, data } (meta: without data)
//   PUT  { code, data, base }   → 200 { at }  |  409 { at } when another device saved since `base`
// `at` is the version (server time of the last save); a save must name the version it builds on.
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { makeFamilyCode, normalizeFamilyCode, isBackupCode } from '../familycode.js';

const KEEP_SECONDS = 400 * 86400;
// Atomic save: create only when free, update only when nobody saved in between.
// Returns 0 when saved, -1 when the code is taken, -2 when it does not exist, or the stored version on a conflict.
const SAVE = `
local current = redis.call('HGET', KEYS[1], 'at')
if ARGV[1] == 'create' then
  if current then return -1 end
else
  if not current then return -2 end
  if current ~= ARGV[2] then return tonumber(current) end
end
redis.call('HSET', KEYS[1], 'at', ARGV[3], 'data', ARGV[4])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5]))
return 0`;

const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const visitor = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';

// The handler takes its Redis client and limiter as arguments, so tests can pass fakes.
export function createHandler({ redis, limiter, prefix, now = () => Date.now(), newCode = makeFamilyCode }) {
  const key = code => `${prefix}${code}`;
  return async function handle(request) {
    if (limiter && !(await limiter.limit(visitor(request))).success) return reply(429, { error: 'Demasiados intentos. Esperá un minuto.' });
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams, code = normalizeFamilyCode(params.get('code'));
      if (!code) return reply(400, { error: 'Código inválido.' });
      const saved = await redis.hgetall(key(code));
      if (!saved?.at) return reply(404, { error: 'No encontramos ese código.' });
      return reply(200, params.get('meta') ? { code, at: Number(saved.at) } : { code, at: Number(saved.at), data: String(saved.data) });
    }
    if (!['POST', 'PUT'].includes(request.method)) return reply(405, { error: 'Método no permitido.' });
    let body;
    try { body = await request.json(); } catch { return reply(400, { error: 'Pedido inválido.' }); }
    if (!isBackupCode(body?.data)) return reply(400, { error: 'Progreso inválido.' });
    if (request.method === 'POST') {
      const at = String(now());
      for (let tries = 0; tries < 5; tries++) {
        const code = newCode();
        if (await redis.eval(SAVE, [key(code)], ['create', '', at, body.data, KEEP_SECONDS]) === 0) return reply(201, { code, at: Number(at) });
      }
      return reply(503, { error: 'No pudimos crear un código. Probá de nuevo.' });
    }
    const code = normalizeFamilyCode(body.code);
    if (!code) return reply(400, { error: 'Código inválido.' });
    // A new version is always later than the one it replaces, even within the same millisecond.
    const at = String(Math.max(now(), (Number(body.base) || 0) + 1));
    const result = await redis.eval(SAVE, [key(code)], ['update', String(body.base ?? ''), at, body.data, KEEP_SECONDS]);
    if (result === 0) return reply(200, { at: Number(at) });
    if (result === -2) return reply(404, { error: 'No encontramos ese código.' });
    return reply(409, { at: Number(result) });
  };
}

// Production keeps its own keys; previews and local runs never touch real families.
let live;
function handler() {
  if (!live) {
    const redis = Redis.fromEnv();
    const env = process.env.VERCEL_ENV || 'development';
    live = createHandler({
      redis, prefix: env === 'production' ? 'buzo:familia:' : `buzo:${env}:familia:`,
      limiter: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, '60 s'), prefix: 'buzo:limite' })
    });
  }
  return live;
}
export const GET = request => handler()(request);
export const POST = request => handler()(request);
export const PUT = request => handler()(request);
