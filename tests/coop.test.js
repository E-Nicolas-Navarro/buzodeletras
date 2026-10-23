import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tickRun, typeInRun, currentWord, partnerBossHit, refreshRun, bossAttackDamage, computeRewards, starsFor, MISSION_WORDS, BOSS_HITS } from '../engine.js';
import { parseMessage, makeCode, normalizeCode, hostRoom, joinRoom, peerId, inviteLink, codeFromLink, EMOTES } from '../net.js';

const coopRun = () => { const state = createRun(0, false, () => .3, { coop: true }); tickRun(state, 1.6); return state; };
const complete = state => { const word = currentWord(state); for (let i = 1; i <= word.length; i++) typeInRun(state, word.slice(0, i)); };

test('co-op: sharks come from one side and the team goal counts both players', () => {
  const state = coopRun();
  assert.equal(state.coop, true); assert.ok(state.sharks.every(shark => shark.side === 'left'));
  state.partnerScore = MISSION_WORDS - 1; assert.equal(state.mode, 'playing');
  complete(state); assert.equal(state.mode, 'bossIntro');
  const alone = coopRun(); alone.partnerScore = MISSION_WORDS; refreshRun(alone); assert.equal(alone.mode, 'bossIntro');
});
test('co-op: boss hits are shared, queued before the boss appears, and win at zero', () => {
  const state = coopRun();
  partnerBossHit(state); partnerBossHit(state); assert.equal(state.pendingHits, 2);
  state.partnerScore = MISSION_WORDS; refreshRun(state);
  assert.equal(state.boss.hp, BOSS_HITS - 2); assert.equal(state.pendingHits, 0);
  for (let i = 0; i < BOSS_HITS - 2; i++) partnerBossHit(state);
  assert.equal(state.boss.hp, 0); assert.equal(state.won, true); assert.equal(state.mode, 'frenzy');
  partnerBossHit(state); assert.equal(state.boss.hp, 0);
});
test('co-op: boss damage is halved per device and no solo oxygen crate is given', () => {
  const state = coopRun(); assert.equal(bossAttackDamage(state), 9); assert.equal(bossAttackDamage(createRun(0)), 18);
  state.oxygen = 30; state.partnerScore = MISSION_WORDS; refreshRun(state); assert.equal(state.oxygen, 30);
});
test('co-op: team shark hits decide the bonus and winning together pays extra', () => {
  const won = (extra = {}) => ({ ...coopRun(), won: true, points: 1000, attempts: 100, mistakes: 10, score: 12, ...extra });
  assert.ok(computeRewards(won()).items.some(item => item.label.includes('Ningún tiburón los tocó')));
  assert.ok(computeRewards(won({ collisions: 1, partnerCollisions: 1 })).items.some(item => item.label.includes('Pocos tiburones los alcanzaron')));
  assert.equal(starsFor(won({ collisions: 1, partnerCollisions: 2 })), 1);
  assert.ok(computeRewards(won()).items.some(item => item.label.includes('juntos')));
});

test('messages from the other device are validated and clamped', () => {
  assert.equal(parseMessage(null), null); assert.equal(parseMessage({ t: 'hack' }), null); assert.equal(parseMessage('x'), null);
  assert.deepEqual(parseMessage({ t: 'o2', d: -500 }), { t: 'o2', d: -100, seq: 0 }); assert.equal(parseMessage({ t: 'o2', d: 'x' }), null);
  assert.deepEqual(parseMessage({ t: 'start', level: 99, relaxed: 'yes' }), { t: 'start', level: 4, relaxed: false });
  assert.deepEqual(parseMessage({ t: 'hello', skin: '<img>', gear: { head: 'guitarra', hand: 'guitarra' } }), { t: 'hello', skin: 'clasico', level: 0, gear: { mask: null, fins: null, head: null, hand: 'guitarra', back: null, pet: null, trail: null } });
  assert.equal(parseMessage({ t: 'emote', e: '💣' }), null); assert.equal(parseMessage({ t: 'emote', e: EMOTES[0] }).e, EMOTES[0]);
  assert.equal(parseMessage({ t: 'sync', o: 999 }).o, 100); assert.equal(parseMessage({ t: 'score', v: -4 }).v, 0);
});
test('room codes are 4 safe letters and user input is normalised', () => {
  for (let i = 0; i < 50; i++) assert.match(makeCode(), /^[A-HJ-KM-NP-Z]{4}$/);
  assert.equal(normalizeCode(' ab-c1dEF '), 'ABCD'); assert.equal(normalizeCode(undefined), '');
});

// A tiny in-memory PeerJS stand-in: peers register by id and connect to each other.
function fakeNetwork() {
  const peers = new Map();
  class Conn { constructor() { this.handlers = {}; this.open = false; this.sent = []; } on(type, fn) { this.handlers[type] = fn; } send(msg) { this.sent.push(msg); this.other?.handlers.data?.(msg); } close() { this.open = false; this.handlers.close?.(); this.other?.handlers.close?.(); } }
  class Peer {
    constructor(id) { this.id = id || `guest-${peers.size}`; this.handlers = {}; this.destroyed = false;
      queueMicrotask(() => { if (peers.has(this.id)) this.handlers.error?.({ type: 'unavailable-id' }); else { peers.set(this.id, this); this.handlers.open?.(this.id); } }); }
    on(type, fn) { this.handlers[type] = fn; }
    connect(id) {
      const mine = new Conn(), target = peers.get(id);
      if (!target) { queueMicrotask(() => this.handlers.error?.({ type: 'peer-unavailable' })); return mine; }
      const theirs = new Conn(); mine.other = theirs; theirs.other = mine;
      queueMicrotask(() => { target.handlers.connection?.(theirs); mine.open = theirs.open = true; theirs.handlers.open?.(); mine.handlers.open?.(); });
      return mine;
    }
    destroy() { this.destroyed = true; if (peers.get(this.id) === this) peers.delete(this.id); }
  }
  return { Peer, peers };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
test('rooms: host gets a code, one guest joins and messages flow both ways', async () => {
  const { Peer } = fakeNetwork(), log = { host: [], guest: [] }; let code;
  const host = hostRoom(Peer, { onCode: value => { code = value; }, onConnect: () => log.host.push('connect'), onMessage: msg => log.host.push(msg.t) });
  await tick(); assert.match(code, /^[A-Z]{4}$/);
  const guest = joinRoom(Peer, code.toLowerCase(), { onConnect: () => log.guest.push('connect'), onMessage: msg => log.guest.push(msg.t) });
  await tick(); assert.deepEqual(log.host, ['connect']); assert.deepEqual(log.guest, ['connect']);
  host.send({ t: 'start', level: 1, relaxed: false }); guest.send({ t: 'hit' });
  await tick(); assert.deepEqual(log.guest, ['connect', 'start']); assert.deepEqual(log.host, ['connect', 'hit']);
  guest.send({ t: 'nonsense' }); await tick(); assert.deepEqual(log.host, ['connect', 'hit']);
});
test('rooms: a third player is turned away and a taken code is retried', async () => {
  const { Peer, peers } = fakeNetwork(); let code; const closed = [];
  const host = hostRoom(Peer, { onCode: value => { code = value; }, onConnect() {} }, () => 0);
  await tick();
  // The second host with the same random code finds the id taken and retries (same sequence -> keeps failing -> error).
  let error; hostRoom(Peer, { onError: kind => { error = kind; } }, () => 0, 1); await tick(); await tick(); assert.equal(error, 'server');
  joinRoom(Peer, code, { onConnect() {} }); await tick();
  joinRoom(Peer, code, { onConnect() {}, onError: kind => closed.push(kind) }); await tick(); await tick();
  assert.deepEqual(closed, ['full']); assert.ok(peers.has(peerId(code)));
  host.close(); assert.equal(peers.has(peerId(code)), false);
});
const FAST = { grace: 120, retry: 15, beat: 1000, silence: 5000 };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('rooms: unknown code reports notfound', async () => {
  const { Peer } = fakeNetwork(); let error;
  joinRoom(Peer, 'ZZZZ', { onError: kind => { error = kind; } }); await tick(); await tick(); assert.equal(error, 'notfound');
});
test('rooms: a dropped link waits, the guest redials and both sides recover', async () => {
  const { Peer } = fakeNetwork(); let code; const events = [];
  const host = hostRoom(Peer, { onCode: value => { code = value; }, onConnect() {}, onDrop: () => events.push('host-drop'), onReconnect: () => events.push('host-back'), onClose: () => events.push('host-closed'), onMessage: msg => events.push(`host-${msg.t}`) }, Math.random, 5, FAST); await tick();
  const guest = joinRoom(Peer, code, { onConnect() {}, onDrop: () => events.push('guest-drop'), onReconnect: () => events.push('guest-back'), onClose: () => events.push('guest-closed') }, 12000, FAST); await tick(); await tick();
  guest.conn.close();
  assert.ok(events.includes('host-drop') && events.includes('guest-drop'));
  await wait(60);
  assert.ok(events.includes('host-back') && events.includes('guest-back')); assert.ok(!events.some(event => event.endsWith('closed')));
  guest.send({ t: 'hit' }); await tick(); assert.ok(events.includes('host-hit'));
  host.close(); guest.close();
});
test('rooms: a partner that never comes back closes the room; saying bye closes it at once', async () => {
  const { Peer, peers } = fakeNetwork(); let code; const events = [];
  const host = hostRoom(Peer, { onCode: value => { code = value; }, onConnect() {}, onClose: () => events.push('host-closed') }, Math.random, 5, FAST); await tick();
  const guest = joinRoom(Peer, code, { onConnect() {} }, 12000, FAST); await tick(); await tick();
  guest.close(); guest.conn.close(); peers.delete(guest.peer.id);
  await wait(FAST.grace + 40); assert.deepEqual(events, ['host-closed']);
  const other = fakeNetwork(); let second; const log = [];
  const host2 = hostRoom(other.Peer, { onCode: value => { second = value; }, onConnect() {}, onClose: () => log.push('closed') }, Math.random, 5, FAST); await tick();
  const guest2 = joinRoom(other.Peer, second, { onConnect() {} }, 12000, FAST); await tick(); await tick();
  guest2.leave(); await tick(); assert.deepEqual(log, ['closed']);
  host.close(); host2.close();
});
test('invite links carry the room code', () => {
  assert.equal(inviteLink('ABCD', { origin: 'https://buzo.example', pathname: '/' }), 'https://buzo.example/?sala=ABCD');
  assert.equal(codeFromLink('?sala=ab-cd'), 'ABCD'); assert.equal(codeFromLink(''), '');
  assert.deepEqual(parseMessage({ t: 'sync', o: 50, ack: 3 }), { t: 'sync', o: 50, ack: 3 });
  assert.deepEqual(parseMessage({ t: 'o2', d: -5, seq: 'x' }), { t: 'o2', d: -5, seq: 0 });
});
