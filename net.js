// Two-player rooms over WebRTC (PeerJS). The first player hosts, the second joins
// with a 4-letter code. Only small game messages travel; nothing personal.
// A dropped connection is not the end: both sides keep the room for a grace period
// and the guest dials again, so a wifi hiccup does not ruin the dive.
import { skinById, accessoryById, SLOTS } from './skins.js';
export const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
export const PEER_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
export const ROOM_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const EMOTES = ['👍', '🎉', '❤️', '😂', '🦈', '🐙'];
export const makeCode = (random = Math.random) => Array.from({ length: 4 }, () => ROOM_LETTERS[Math.floor(random() * ROOM_LETTERS.length)]).join('');
export const normalizeCode = raw => String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
export const peerId = code => `buzo-letras-${code}`;
// Invite links carry the room code: https://…/?sala=ABCD
export const inviteLink = (code, location = globalThis.location) => `${location.origin}${location.pathname}?sala=${code}`;
export const codeFromLink = search => normalizeCode(new URLSearchParams(search).get('sala'));
// grace: how long a dropped room waits; retry: guest redial interval;
// beat: heartbeat interval; silence: no news for this long means the link is gone.
export const TIMING = { grace: 30000, retry: 2500, beat: 2000, silence: 7000 };

let loading = null;
// The library loads only when someone opens a room, so solo play never touches the network.
export function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEER_SRC; script.integrity = PEER_SRI; script.crossOrigin = 'anonymous';
    script.onload = () => globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error('load'));
    script.onerror = () => { loading = null; reject(new Error('load')); };
    document.head.append(script);
  });
  return loading;
}

const count = (value, max = 100000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
// Everything from the other device is untrusted: keep only known shapes and clamp numbers.
export function parseMessage(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.t !== 'string') return null;
  switch (raw.t) {
    case 'hello': {
      const gear = {};
      for (const { id: slot } of SLOTS) { const item = accessoryById(raw.gear?.[slot]); gear[slot] = item?.slot === slot ? item.id : null; }
      return { t: 'hello', skin: skinById(raw.skin).id, level: Math.min(2, count(raw.level, 2)), gear };
    }
    case 'start': return { t: 'start', level: Math.min(2, count(raw.level, 2)), relaxed: raw.relaxed === true };
    // Oxygen changes are numbered so the host can confirm which ones it applied.
    case 'o2': return Number.isFinite(raw.d) ? { t: 'o2', d: Math.max(-100, Math.min(100, raw.d)), seq: count(raw.seq, 1e9) } : null;
    case 'sync': return { t: 'sync', o: Math.min(100, count(raw.o, 100)), ack: count(raw.ack, 1e9) };
    case 'score': return { t: 'score', v: count(raw.v) };
    case 'col': return { t: 'col', v: count(raw.v) };
    case 'hit': return { t: 'hit' };
    case 'ping': return { t: 'ping' };
    case 'bye': return { t: 'bye' };
    case 'emote': return EMOTES.includes(raw.e) ? { t: 'emote', e: raw.e } : null;
    default: return null;
  }
}

// `Peer` is injected so the room logic can be tested without a network.
// handlers: onCode(code), onConnect(), onMessage(msg), onDrop(), onReconnect(), onClose(), onError(kind)
// kinds: 'load', 'server', 'notfound', 'full', 'timeout'
function makeRoom(role, code, handlers, timing) {
  const room = { role, code, conn: null, peer: null, closed: false, dropped: false, everConnected: false, lastSeen: 0 };
  const timers = new Set();
  const later = (fn, ms, repeat = false) => {
    const id = (repeat ? setInterval : setTimeout)(() => { if (!repeat) timers.delete(id); fn(); }, ms);
    id?.unref?.(); timers.add(id); return id;
  };
  const cancel = id => { clearTimeout(id); clearInterval(id); timers.delete(id); };
  room.later = later; room.cancel = cancel;
  room.send = msg => { if (room.conn?.open && !room.dropped) room.conn.send(msg); };
  room.close = () => {
    room.closed = true;
    for (const id of timers) { clearTimeout(id); clearInterval(id); }
    timers.clear();
    try { room.peer?.destroy(); } catch { /* Already closed. */ }
  };
  // Saying goodbye spares the other player the reconnection wait.
  room.leave = () => {
    if (room.conn?.open) try { room.conn.send({ t: 'bye' }); } catch { /* Closing anyway. */ }
    const id = setTimeout(room.close, 150); id?.unref?.();
  };
  room.giveUp = () => { if (room.closed) return; room.close(); handlers.onClose?.(); };
  room.drop = conn => {
    if (room.closed || room.dropped || conn !== room.conn) return;
    if (!room.everConnected) {
      // Closed before it ever opened: the host turned us away (room full), or a pending guest gave up.
      if (room.role === 'guest') { room.close(); handlers.onError?.('full'); } else room.conn = null;
      return;
    }
    room.dropped = true;
    try { conn.close?.(); } catch { /* Already closed. */ }
    handlers.onDrop?.();
    room.graceTimer = later(room.giveUp, timing.grace);
    room.onDropped?.();
  };
  room.linked = conn => {
    room.conn = conn; room.lastSeen = Date.now();
    if (room.graceTimer) { cancel(room.graceTimer); room.graceTimer = null; }
    const recovering = room.dropped; room.dropped = false;
    if (!room.everConnected) { room.everConnected = true; handlers.onConnect?.(); } else if (recovering) handlers.onReconnect?.();
  };
  room.wire = conn => {
    conn.on('data', raw => {
      if (conn !== room.conn) return;
      room.lastSeen = Date.now();
      const msg = parseMessage(raw); if (!msg) return;
      if (msg.t === 'bye') { room.giveUp(); return; }
      if (msg.t !== 'ping') handlers.onMessage?.(msg);
    });
    conn.on('close', () => room.drop(conn));
    conn.on('error', () => room.drop(conn));
  };
  // Heartbeat: a ping every `beat` ms; silence for `silence` ms counts as a drop.
  later(() => {
    if (room.closed || room.dropped || !room.conn?.open) return;
    try { room.conn.send({ t: 'ping' }); } catch { /* Checked below. */ }
    if (Date.now() - room.lastSeen > timing.silence) room.drop(room.conn);
  }, timing.beat, true);
  return room;
}
export function hostRoom(Peer, handlers, random = Math.random, attempts = 5, timing = TIMING) {
  const room = makeRoom('host', '', handlers, timing);
  const open = remaining => {
    const code = makeCode(random), peer = new Peer(peerId(code));
    room.peer = peer;
    peer.on('open', () => { room.code = code; handlers.onCode?.(code); });
    peer.on('connection', conn => {
      // Rooms are for two: a third device is turned away unless the partner dropped.
      if (room.conn && !room.dropped) { conn.on('open', () => conn.close()); return; }
      room.wire(conn);
      conn.on('open', () => room.linked(conn));
      if (!room.conn) room.conn = conn;
    });
    peer.on('error', error => {
      if (error?.type === 'unavailable-id' && remaining > 0) { try { peer.destroy(); } catch { /* Ignore. */ } open(remaining - 1); return; }
      if (!room.everConnected) handlers.onError?.('server');
    });
    // Lost the matchmaking server: keep our id so the guest can still find us.
    peer.on('disconnected', () => {
      if (room.closed) return;
      if (!room.everConnected) handlers.onError?.('server'); else try { peer.reconnect?.(); } catch { /* Retry on the next drop. */ }
    });
  };
  open(attempts); return room;
}
export function joinRoom(Peer, rawCode, handlers, timeout = 12000, timing = TIMING) {
  const code = normalizeCode(rawCode);
  const room = makeRoom('guest', code, handlers, timing);
  let timer = null;
  const fail = kind => { if (!room.everConnected && !room.closed) { room.close(); handlers.onError?.(kind); } };
  const dial = () => {
    const conn = room.peer.connect(peerId(code), { reliable: true });
    if (!room.everConnected) room.conn = conn;
    room.wire(conn);
    conn.on('open', () => {
      clearTimeout(timer);
      // Several redials may be in flight; keep the first one that answers.
      if (room.everConnected && !room.dropped && room.conn !== conn) { conn.close(); return; }
      room.linked(conn);
    });
    return conn;
  };
  const peer = new Peer(); room.peer = peer;
  peer.on('open', () => { dial(); timer = setTimeout(() => fail('timeout'), timeout); timer?.unref?.(); });
  peer.on('error', error => {
    if (room.everConnected) return; // While reconnecting, a missing host just means "try again".
    fail(error?.type === 'peer-unavailable' ? 'notfound' : 'server');
  });
  peer.on('disconnected', () => { if (room.everConnected && !room.closed) try { peer.reconnect?.(); } catch { /* Next retry. */ } });
  // After a drop, dial the host again until it answers or the grace period ends.
  room.onDropped = () => {
    const retry = room.later(() => {
      if (room.closed || !room.dropped) { room.cancel(retry); return; }
      try { if (peer.disconnected) peer.reconnect?.(); dial(); } catch { /* Try again next time. */ }
    }, timing.retry, true);
  };
  return room;
}
