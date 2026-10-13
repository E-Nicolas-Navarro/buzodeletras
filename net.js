// Two-player rooms over WebRTC (PeerJS). The first player hosts, the second joins
// with a 4-letter code. Only small game messages travel; nothing personal.
import { skinById, accessoryById, SLOTS } from './skins.js';
export const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
export const PEER_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
export const ROOM_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const EMOTES = ['👍', '🎉', '❤️'];
export const makeCode = (random = Math.random) => Array.from({ length: 4 }, () => ROOM_LETTERS[Math.floor(random() * ROOM_LETTERS.length)]).join('');
export const normalizeCode = raw => String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
export const peerId = code => `buzo-letras-${code}`;

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
      return { t: 'hello', skin: skinById(raw.skin).id, gear };
    }
    case 'start': return { t: 'start', level: Math.min(2, count(raw.level, 2)), relaxed: raw.relaxed === true };
    case 'o2': return Number.isFinite(raw.d) ? { t: 'o2', d: Math.max(-100, Math.min(100, raw.d)) } : null;
    case 'sync': return { t: 'sync', o: Math.min(100, count(raw.o, 100)) };
    case 'score': return { t: 'score', v: count(raw.v) };
    case 'col': return { t: 'col', v: count(raw.v) };
    case 'hit': return { t: 'hit' };
    case 'emote': return EMOTES.includes(raw.e) ? { t: 'emote', e: raw.e } : null;
    default: return null;
  }
}

// `Peer` is injected so the room logic can be tested without a network.
// handlers: onCode(code), onConnect(), onMessage(msg), onClose(), onError(kind)
// kinds: 'load', 'server', 'notfound', 'full', 'timeout'
function wire(conn, handlers, state) {
  conn.on('data', raw => { const msg = parseMessage(raw); if (msg) handlers.onMessage?.(msg); });
  conn.on('close', () => { if (!state.closed) { state.closed = true; handlers.onClose?.(); } });
  conn.on('error', () => { if (!state.closed) { state.closed = true; handlers.onClose?.(); } });
}
export function hostRoom(Peer, handlers, random = Math.random, attempts = 5) {
  const room = { role: 'host', code: '', conn: null, peer: null, closed: false };
  room.send = msg => { if (room.conn?.open) room.conn.send(msg); };
  room.close = () => { room.closed = true; try { room.peer?.destroy(); } catch { /* Already closed. */ } };
  const open = remaining => {
    const code = makeCode(random), peer = new Peer(peerId(code));
    room.peer = peer;
    peer.on('open', () => { room.code = code; handlers.onCode?.(code); });
    peer.on('connection', conn => {
      if (room.conn) { conn.on('open', () => conn.close()); return; }
      room.conn = conn;
      conn.on('open', () => handlers.onConnect?.());
      wire(conn, handlers, room);
    });
    peer.on('error', error => {
      if (error?.type === 'unavailable-id' && remaining > 0) { try { peer.destroy(); } catch { /* Ignore. */ } open(remaining - 1); return; }
      handlers.onError?.('server');
    });
    peer.on('disconnected', () => { if (!room.closed && !room.conn) handlers.onError?.('server'); });
  };
  open(attempts); return room;
}
export function joinRoom(Peer, rawCode, handlers, timeout = 12000) {
  const code = normalizeCode(rawCode);
  const room = { role: 'guest', code, conn: null, peer: null, closed: false };
  room.send = msg => { if (room.conn?.open) room.conn.send(msg); };
  let timer = null, connected = false;
  const fail = kind => { if (!connected && !room.closed) { room.close(); handlers.onError?.(kind); } };
  room.close = () => { room.closed = true; clearTimeout(timer); try { room.peer?.destroy(); } catch { /* Already closed. */ } };
  const peer = new Peer(); room.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(peerId(code), { reliable: true }); room.conn = conn;
    timer = setTimeout(() => fail('timeout'), timeout);
    conn.on('open', () => { connected = true; clearTimeout(timer); handlers.onConnect?.(); });
    wire(conn, handlers, room);
  });
  peer.on('error', error => fail(error?.type === 'peer-unavailable' ? 'notfound' : 'server'));
  return room;
}
