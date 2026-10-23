import { drawBoat, drawBoatShadow, drawDiver, drawOceanBackdrop, drawOceanForeground, drawShipwreck, drawOctopus, drawCreature, drawLoot, diverTop } from './visuals.js';
import { LEVELS, MISSION_WORDS, BOSS_HITS, FRENZY, currentWord, fingerFor, accuracy, computeRewards, starsFor, refreshRun, partnerBossHit, bossAttackDamage, createRun, activeSharks, chooseTarget, typeInRun, tickRun } from './engine.js';
import { SKINS, SLOTS, ACCESSORIES, skinById, sanitizeWallet, canAfford, buySkin, equipSkin, equipGear, priceOf, onSale } from './skins.js';
import { makeBackup, readBackup, describeBackup, needsBackup, backupAge } from './save.js';
import { loadPeer, hostRoom, joinRoom, normalizeCode, inviteLink, codeFromLink, EMOTES } from './net.js';
import { currentEvent, eventWords } from './events.js';
import { createHands, stepHands, drawHands } from './hands.js';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createRun(0); state.mode = 'welcome';
const search = globalThis.location?.search || '';
// A season (Halloween…) only changes words, decorations and the shop; never the rules.
const season = currentEvent(search);
let audio, last = 0, clock = 0, width = 1000, height = 480;
let pausedMode = 'playing', targetSignature = '';
let records = {};
try {
  const stored = JSON.parse(localStorage.getItem('buzo-records-v4') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) records = stored;
} catch { /* Persistence is optional. */ }
let seenCoach = false;
try { seenCoach = localStorage.getItem('buzo-seen-v1') === '1'; } catch { /* Optional. */ }
let lowWarned = false;
let lastBackup = 0;
try { lastBackup = Number(JSON.parse(localStorage.getItem('buzo-backup-v1') || '{}').at) || 0; } catch { /* Optional. */ }
let wallet = sanitizeWallet(null);
try { wallet = sanitizeWallet(JSON.parse(localStorage.getItem('buzo-wallet-v1') || 'null')); } catch { /* Persistence is optional. */ }
function saveWallet() {
  try { localStorage.setItem('buzo-wallet-v1', JSON.stringify(wallet)); } catch { /* Optional in private browsing. */ }
  $('walletCoins').textContent = wallet.coins; $('walletGems').textContent = wallet.gems; $('walletCandy').textContent = wallet.candy;
  $('walletCandyWrap').hidden = !season && !wallet.candy;
  $('progressButton').classList.toggle('needs-backup', needsBackup(wallet, lastBackup));
}
// Modes where the typing box is live.
const typingMode = () => ['playing', 'boss', 'frenzy'].includes(state.mode);
const inFrenzy = () => state.mode === 'frenzy' || state.mode === 'paused' && pausedMode === 'frenzy';
const modalOpen = () => $('help').open || $('shop').open || $('coop').open || $('progress').open;
// ----- Two-player room: shared oxygen, words and boss, one device each -----
let room = null, linked = false, partner = null, coopNote = '', syncClock = 0, waitingPartner = false;
// Oxygen is decided by the host. The guest numbers its own changes and keeps the ones
// the host has not confirmed yet, so a late sync never undoes them.
let o2Seq = 0, o2Pending = [], o2Ack = 0;
const emotes = [];
const coopActive = () => Boolean(room && linked);
const isGuest = () => coopActive() && room.role === 'guest';
const clamp = value => Math.max(0, Math.min(100, value));
function sendHello() { if (coopActive()) room.send({ t: 'hello', skin: wallet.equipped, gear: wallet.gear, level: Number($('level').value) }); }
function renderLobby() {
  const inRoom = coopActive();
  $('coopBanner').hidden = !inRoom && !coopNote; $('leaveRoom').hidden = !inRoom;
  const mateLevel = partner ? ` · tu compañero juega el nivel ${partner.level + 1}` : '';
  $('coopText').textContent = !inRoom ? coopNote : waitingPartner ? `Sala ${room.code} · reconectando con tu compañero…`
    : `Sala ${room.code} · ${isGuest() ? 'conectado con el anfitrión' : '¡tu compañero está conectado!'}${mateLevel}`;
  $('coopButton').hidden = Boolean(room); $('earn').hidden = inRoom;
  $('startButton').disabled = isGuest();
  $('levelLabel').textContent = inRoom ? 'Elegí tu nivel (cada uno el suyo)' : 'Elegí tu aventura';
  $('startButton').innerHTML = isGuest() ? 'Esperando al anfitrión…' : inRoom ? '¡Empezar juntos!' : '¡Al agua! <span>↗</span>';
  $('relaxed').disabled = isGuest(); renderLevels();
}
function leaveRoom() {
  room?.leave(); room = null; linked = false; partner = null; dropped(false);
  if (state.coop) home(); else renderLobby();
}
function partnerLeft() {
  room?.close(); room = null; linked = false; partner = null; coopNote = 'Tu compañero se desconectó.'; dropped(false);
  if (state.coop) home(); else renderLobby();
}
// While the link is down the shared dive freezes for both players.
function dropped(waiting) {
  waitingPartner = waiting; $('dropNotice').hidden = !waiting;
  if (typingMode()) { $('typing').disabled = waiting; if (!waiting) $('typing').focus(); }
  renderLobby();
}
function partnerBack() {
  dropped(false); sendHello();
  if (state.coop) {
    room.send({ t: 'score', v: state.score }); room.send({ t: 'col', v: state.collisions });
    if (room.role === 'host') room.send({ t: 'sync', o: state.oxygen, ack: o2Ack });
  }
  toast('¡Tu compañero volvió!');
}
const COOP_ERRORS = {
  load: 'No se pudo cargar el servicio de salas. Revisá tu conexión.',
  server: 'No pudimos conectar con el servicio de salas. Probá de nuevo en un rato.',
  notfound: 'No encontramos esa sala. Revisá el código.',
  timeout: 'Tardó demasiado en conectar. Probá de nuevo.',
  full: 'Esa sala ya tiene dos jugadores.'
};
function coopFail(kind) {
  room?.close(); room = null; linked = false;
  $('coopWait').hidden = true; $('coopMenu').hidden = false; $('coopMessage').textContent = COOP_ERRORS[kind] || COOP_ERRORS.server;
  renderLobby();
}
// Runs a local action and tells the partner what changed in the shared state.
function track(action) {
  if (!state.coop || !coopActive()) return action();
  const oxygen = state.oxygen, score = state.score, collisions = state.collisions;
  const out = action();
  if (state.oxygen !== oxygen && !state.relaxed) {
    const d = state.oxygen - oxygen, seq = ++o2Seq;
    if (isGuest()) o2Pending.push({ seq, d });
    room.send({ t: 'o2', d, seq });
  }
  if (state.score !== score) room.send({ t: 'score', v: state.score });
  if (state.collisions !== collisions) room.send({ t: 'col', v: state.collisions });
  return out;
}
function handlePartner(msg) {
  if (msg.t === 'hello') { partner = { skin: msg.skin, gear: msg.gear, level: msg.level }; renderLobby(); return; }
  if (msg.t === 'start') {
    // Each player keeps their own level; the host decides when to dive and the practice mode.
    if (!isGuest() || !['welcome', 'results', 'ended', 'celebrating'].includes(state.mode)) return;
    $('shop').close(); $('help').close();
    $('relaxed').checked = msg.relaxed; start(); return;
  }
  if (!state.coop) return;
  if (msg.t === 'o2' && !state.relaxed) {
    state.oxygen = clamp(state.oxygen + msg.d);
    if (!isGuest()) { o2Ack = Math.max(o2Ack, msg.seq); room.send({ t: 'sync', o: state.oxygen, ack: o2Ack }); }
  } else if (msg.t === 'sync' && !state.relaxed && isGuest()) {
    o2Pending = o2Pending.filter(change => change.seq > msg.ack);
    state.oxygen = clamp(msg.o + o2Pending.reduce((sum, change) => sum + change.d, 0));
  }
  else if (msg.t === 'score') state.partnerScore = msg.v;
  else if (msg.t === 'col') { if (msg.v > state.partnerCollisions) toast('¡Un tiburón alcanzó a tu compañero!', 'miss'); state.partnerCollisions = msg.v; }
  else if (msg.t === 'hit') partnerBossHit(state);
  else if (msg.t === 'emote') emotes.push({ who: 'partner', text: msg.e, time: 0 });
  const before = state.mode;
  refreshRun(state);
  if (before === 'playing' && state.mode === 'bossIntro') $('status').textContent = '¡Llegaron al naufragio! Otto custodia el tesoro.';
  if (before !== 'frenzy' && state.mode === 'frenzy') frenzyStarted();
  sync(); if (state.mode === 'ended') finish();
}
const roomHandlers = () => ({
  onCode: code => {
    $('roomCode').textContent = code; $('coopMenu').hidden = true; $('coopWait').hidden = false; $('coopMessage').textContent = '';
    if (globalThis.location) $('inviteLink').value = inviteLink(code);
  },
  onConnect: () => { linked = true; coopNote = ''; $('coopMessage').textContent = ''; sendHello(); $('coop').close(); renderLobby(); },
  onMessage: handlePartner, onClose: partnerLeft, onError: coopFail,
  onDrop: () => { dropped(true); toast('Se cortó la conexión. Reconectando…', 'miss'); }, onReconnect: partnerBack
});

let stars = {};
try {
  const stored = JSON.parse(localStorage.getItem('buzo-stars-v1') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) stars = stored;
} catch { /* Persistence is optional. */ }
const LEVEL_TIPS = ['Fila central', 'Palabras del mar', 'Todo el teclado'];
const starText = count => '★'.repeat(count) + '☆'.repeat(3 - count);
function renderLevels() {
  const box = $('levelCards'); box.replaceChildren();
  LEVELS.forEach((level, index) => {
    const selected = Number($('level').value) === index, earned = Math.min(3, Math.max(0, Number(stars[index]) || 0));
    const card = document.createElement('button'); card.type = 'button'; card.className = `level-card ${selected ? 'selected' : ''}`;
    card.setAttribute('role', 'radio'); card.setAttribute('aria-checked', String(selected));
    card.setAttribute('aria-label', `Nivel ${index + 1}: ${LEVEL_TIPS[index]}. ${earned} de 3 estrellas`);
    const title = document.createElement('strong'); title.textContent = `${index + 1} · ${LEVEL_TIPS[index]}`;
    const name = document.createElement('small'); name.textContent = level.name;
    const rating = document.createElement('span'); rating.className = 'level-stars'; rating.textContent = starText(earned);
    card.append(title); card.append(name); card.append(rating);
    card.onclick = () => { $('level').value = String(index); renderLevels(); showRecord(); sendHello(); };
    box.append(card);
  });
}
function recordKey() { return `${state.level}-${state.relaxed ? 'practice' : 'challenge'}`; }
function showRecord() {
  const key = `${$('level').value}-${$('relaxed').checked ? 'practice' : 'challenge'}`;
  const best = records[key];
  $('record').textContent = best ? `Tu récord: ${best.points} puntos · ${best.depth} m de profundidad` : 'Tu primera expedición te espera.';
}
const TONES = { win: [[520, 880]], miss: [[240, 180]], shark: [[300, 120], [200, 90]], prize: [[523, 659], [659, 784], [784, 1047]] };
let sound = true;
try { sound = localStorage.getItem('buzo-sound-v1') !== 'off'; } catch { /* Persistence is optional. */ }
function showSound() { $('soundButton').textContent = `Sonido: ${sound ? 'sí' : 'no'}`; $('soundButton').setAttribute('aria-pressed', String(sound)); }
function beep(kind) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    (TONES[kind] || TONES.win).forEach(([from, to], i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .13;
      osc.connect(gain); gain.connect(audio.destination); osc.type = kind === 'shark' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + .15);
      gain.gain.setValueAtTime(.06, at); gain.gain.exponentialRampToValueAtTime(.001, at + .2);
      osc.start(at); osc.stop(at + .22);
    });
  } catch { /* Audio is optional. */ }
}
function toast(text, kind = 'win') {
  const el = $('toast'); el.textContent = text; el.className = `toast ${kind}`;
  void el.offsetWidth; el.classList.add('show');
}
const rows = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm', ' '];
for (const row of rows) {
  const div = document.createElement('div'); div.className = 'key-row';
  for (const char of row) {
    const key = document.createElement('span');
    key.className = `key ${fingerFor(char).color} ${char === ' ' ? 'space' : ''} ${'fj'.includes(char) ? 'home' : ''}`;
    key.dataset.key = char; key.textContent = char === ' ' ? 'espacio · pulgares' : char.toUpperCase(); div.append(key);
  }
  $('keyboard').append(div);
}
// The letter the ghost hands point at: the next one to type, or none (resting on the home row).
let guideChar = null;
function hint(char) {
  guideChar = char || null;
  const plain = char === 'ñ' ? 'ñ' : char?.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of document.querySelectorAll('.key')) key.classList.toggle('active', key.dataset.key === plain);
  if (!char) { $('fingerHint').innerHTML = 'Índices en <b>F</b> y <b>J</b>.<br>Buscá sus pequeñas rayitas.'; return; }
  const finger = fingerFor(char);
  $('fingerHint').textContent = `${char.toUpperCase()}: ${finger.name}. Después volvé a ${finger.home}.`;
  if (char !== plain) $('fingerHint').textContent += char === 'ü' ? ' Usá la tecla de diéresis y luego U.' : ' Usá la tecla de tilde y luego la vocal.';
}
function updateWord() {
  const word = currentWord(state);
  $('wordDisplay').replaceChildren();
  if (!word) { $('wordDisplay').textContent = state.mode === 'diving' ? '¡Al agua!' : state.mode === 'frenzy' ? '¡Preparate!' : '…'; hint(null); return; }
  let next = 0;
  while (next < state.input.length && state.input[next] === word[next]) next++;
  // One tile per letter: green when right, red when wrong, yellow for the next one.
  for (let i = 0; i < word.length; i++) {
    const span = document.createElement('span'); span.textContent = word[i];
    const classes = [];
    if (i < state.input.length) classes.push(state.input[i] === word[i] ? 'correct' : 'incorrect');
    else if (i === next) classes.push('next');
    if (word[i] === ' ') classes.push('space');
    span.className = classes.join(' ');
    $('wordDisplay').append(span);
  }
  $('wordDisplay').setAttribute('aria-label', `Palabra para escribir: ${word}`);
  hint(word[Math.min(next, word.length - 1)]);
}
function updateTargets() {
  const active = ['playing', 'frenzy'].includes(state.mode) ? activeSharks(state) : [];
  const signature = active.map(shark => `${shark.id}:${shark.id === state.targetId}`).join(',');
  if (signature === targetSignature) return;
  targetSignature = signature; $('targetList').replaceChildren();
  for (const shark of active) {
    const button = document.createElement('button');
    button.className = `target-chip ${shark.id === state.targetId ? 'selected' : ''}`;
    button.textContent = `${{ left: '←', right: '→', top: '↓' }[shark.side]} ${shark.word}`;
    button.setAttribute('aria-label', shark.side === 'top' ? `Atrapar ${shark.word}, que cae del barco` : `Elegir ${shark.word}, desde la ${shark.side === 'left' ? 'izquierda' : 'derecha'}`);
    button.setAttribute('aria-pressed', String(shark.id === state.targetId));
    button.onclick = () => {
      if (!['playing', 'frenzy'].includes(state.mode)) return;
      chooseTarget(state, shark.id); $('typing').value = ''; updateWord(); updateTargets(); $('typing').focus();
    };
    $('targetList').append(button);
  }
}
function hud() {
  $('depth').textContent = `${state.depth} m`;
  $('scoreLabel').textContent = state.frenzy ? 'Tesoro' : state.boss ? 'Pulpo' : state.coop ? 'Equipo' : 'Palabras';
  $('score').textContent = state.frenzy ? `${state.frenzy.caught}` : state.boss ? `${BOSS_HITS - state.boss.hp} / ${BOSS_HITS}` : `${state.score + state.partnerScore} / ${MISSION_WORDS}`;
  $('partnerHud').hidden = !state.coop || ['welcome', 'results'].includes(state.mode);
  $('partnerText').textContent = `Compañero: ${state.partnerScore} ${state.partnerScore === 1 ? 'palabra' : 'palabras'}`;
  $('oxygenHud').style.left = state.coop ? '33%' : '50%';
  $('points').textContent = state.points;
  $('air').textContent = state.relaxed ? '∞' : `${state.oxygen}%`;
  $('air').setAttribute('aria-label', state.relaxed ? 'Oxígeno ilimitado' : `Oxígeno al ${state.oxygen} por ciento`);
  $('oxygenFill').style.width = `${state.relaxed ? 100 : state.oxygen}%`;
  $('oxygenFill').classList.toggle('low', !state.relaxed && state.oxygen <= 30);
  // No oxygen is at stake during the frenzy, so its meter steps aside.
  $('oxygenHud').hidden = ['welcome', 'results'].includes(state.mode) || inFrenzy();
  $('hudBar').hidden = ['welcome', 'results'].includes(state.mode);
  $('oxygenMeter').setAttribute('aria-valuenow', String(state.relaxed ? 100 : state.oxygen));
  $('oxygenMeter').setAttribute('aria-valuetext', state.relaxed ? 'Oxígeno ilimitado' : `${state.oxygen}%`);
  document.querySelector('.sea-label').textContent = state.frenzy ? 'El naufragio de Otto · ¡Frenesí del tesoro!' : state.boss ? 'El naufragio de Otto · 240 m' : `${LEVELS[state.level].name} · Oleada ${state.wave}`;
  updateBossHud(); updateFrenzyHud();
}
function updateFrenzyHud() {
  const f = state.frenzy, live = Boolean(f) && inFrenzy();
  $('frenzyBanner').hidden = !live || f.intro <= 0;
  $('frenzyHud').hidden = !live || f.intro > 0;
  if (!f) return;
  const seconds = Math.ceil(f.time);
  $('frenzyTime').textContent = `${seconds} s`;
  $('frenzyFill').style.width = `${f.time / FRENZY.seconds * 100}%`;
  $('frenzyMeter').setAttribute('aria-valuenow', String(seconds));
  $('frenzyHud').classList.toggle('hurry', f.time <= 4);
  $('frenzyInfo').textContent = f.combo >= 2 ? `¡Combo ×${f.combo}! · ${f.caught} atrapados · puntos ×2` : `${f.caught} atrapados · escribí la palabra antes de que toque el fondo · puntos ×2`;
}
function frenzyStarted() {
  burst(ottoAt, '#ffe27a', 26); beep('prize');
  toast('¡Otto se hizo tu amigo! ¡Frenesí del tesoro!');
  $('status').textContent = '¡Ganaste! Desde el barco cae el tesoro: escribí sus palabras para atraparlo.';
  $('feedback').textContent = 'Puntos ×2 y sin oxígeno en juego.';
}
function updateBossHud() {
  $('bossHud').hidden = !state.boss || ['welcome', 'results', 'celebrating'].includes(state.mode) || (state.mode === 'paused' && pausedMode === 'celebrating') || inFrenzy();
  if (!state.boss) return;
  $('bossHp').textContent = `${state.boss.hp} / ${BOSS_HITS}`;
  $('bossHealthFill').style.width = `${state.boss.hp / BOSS_HITS * 100}%`;
  $('bossHealth').setAttribute('aria-valuenow', String(state.boss.hp));
  const warning = !state.relaxed && state.mode === 'boss' && state.boss.attackIn <= 1.5;
  $('bossHud').classList.toggle('charging', warning);
  $('bossAttackHint').textContent = state.relaxed ? 'Sin apuro: escribí las dos palabras y el espacio.' : `${warning ? '¡Prepará los dedos!' : state.boss.hp <= 4 ? '¡Otto aceleró!' : 'Ataque'} · ${Math.ceil(state.boss.attackIn)} s · Cada letra bien escrita lo frena.`;
}
function sync() {
  const canType = typingMode();
  $('typing').value = state.input; $('typing').disabled = !canType;
  $('diverConsole').hidden = !canType; $('idlePanel').hidden = canType;
  $('bossBanner').hidden = state.mode !== 'bossIntro';
  $('targetList').hidden = !['playing', 'frenzy'].includes(state.mode);
  updateWord(); updateTargets(); hud();
  if (canType && !state.relaxed && state.mode !== 'frenzy') {
    if (state.oxygen <= 30 && !lowWarned) { lowWarned = true; toast('¡Poco oxígeno! Seguí escribiendo', 'miss'); }
    else if (state.oxygen > 45) lowWarned = false;
  }
}
function start() {
  const level = Number($('level').value);
  state = createRun(level, $('relaxed').checked, Math.random, { coop: coopActive(), event: season?.id, eventWords: eventWords(season, level) });
  sendHello(); syncClock = 0; emotes.length = 0; o2Seq = 0; o2Pending = []; o2Ack = 0;
  particles.length = 0; lootStart.clear(); Object.assign(anim, { cheer: 0, hurt: 0, type: 0, flip: false });
  if (reducedMotion) state.diveTime = 1.5;
  $('welcome').hidden = true; $('results').hidden = true; $('pauseOverlay').hidden = true; $('targetList').hidden = false;
  $('pauseButton').disabled = false; $('pauseButton').textContent = 'Pausar';
  $('status').textContent = '¡Saltamos! Prepará los dedos en F y J.';
  $('feedback').textContent = 'Escribí para sumar. Cuidá tu oxígeno.';
  targetSignature = 'reset'; lowWarned = false; $('toast').className = 'toast'; $('coach').hidden = true; sync();
}
function amount(value, kind, sign = '+') {
  const span = document.createElement('span'); span.className = 'reward-amount';
  const icon = document.createElement('i'); icon.className = kind; icon.setAttribute('aria-hidden', 'true');
  const number = document.createElement('strong'); number.textContent = `${sign}${value}`;
  span.append(icon); span.append(number); return span;
}
function showRewards(rewards) {
  const box = $('rewards'); box.replaceChildren();
  const row = (label, coins, gems, candy, className = '') => {
    const div = document.createElement('div'); div.className = `reward-row ${className}`;
    const name = document.createElement('span'); name.textContent = label; div.append(name);
    if (coins) div.append(amount(coins, 'coin'));
    if (gems) div.append(amount(gems, 'gem'));
    if (candy) div.append(amount(candy, 'candy'));
    div.style.animationDelay = `${box.children.length * .18}s`; box.append(div);
  };
  for (const item of rewards.items) if (item.coins || item.gems || item.candy) row(item.label, item.coins, item.gems, item.candy, /tibur|ballena|dorado|frenes/i.test(item.label) ? 'bonus' : '');
  row('Total ganado', rewards.coins, rewards.gems, rewards.candy, 'reward-total');
  for (const id of ['walletCoinsWrap', 'walletGems']) { const chip = $(id); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
}
function finish() {
  if (state.won && state.mode === 'ended' && !reducedMotion) {
    // After a frenzy the chest is already open: a shorter bow before the results.
    state.mode = 'celebrating'; state.treasureTime = state.frenzy ? 1.6 : 0;
    $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true; $('frenzyHud').hidden = true;
    $('typing').disabled = true; $('targetList').hidden = true;
    $('status').textContent = state.frenzy ? `¡Qué botín! Atrapaste ${state.frenzy.caught} tesoros del barco.` : '¡Otto se hizo tu amigo! El cofre está abriéndose…';
    hint(null); return;
  }
  state.mode = 'results'; $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true; $('frenzyHud').hidden = true; $('frenzyBanner').hidden = true; $('targetList').hidden = true; $('typing').disabled = true; $('pauseButton').disabled = true; hint(null);
  const acc = accuracy(state.attempts, state.mistakes);
  const speed = state.elapsed ? Math.round(state.score / (state.elapsed / 60)) : 0;
  $('resultLabel').textContent = state.won ? 'Expedición completa' : 'Hora de subir a la superficie';
  $('resultTitle').textContent = state.won ? '¡Encontraste el tesoro!' : '¡Cada intento te enseña!';
  $('resultMessage').textContent = state.won ? '¡Completaste las ocho frases de Otto y abriste el tesoro del barco hundido!' : `Llegaste a ${state.depth} metros. Recargá el oxígeno y probá otra vez.`;
  if (state.frenzy) $('resultMessage').textContent += ` En el frenesí atrapaste ${state.frenzy.caught} ${state.frenzy.caught === 1 ? 'tesoro' : 'tesoros'} (+${state.frenzy.points} puntos).`;
  $('resultWords').textContent = state.score; $('resultAccuracy').textContent = `${acc}%`; $('resultSpeed').textContent = speed;
  $('resultPoints').textContent = `${state.points} puntos · ${state.bestStreak} palabras seguidas sin errores`;
  const key = recordKey(), old = records[key];
  if (!old || state.points > old.points) {
    records[key] = { points: state.points, depth: state.depth, accuracy: acc };
    try { localStorage.setItem('buzo-records-v4', JSON.stringify(records)); } catch { /* Optional in private browsing. */ }
  }
  if (!state.rewarded) {
    state.rewarded = computeRewards(state); wallet.coins += state.rewarded.coins; wallet.gems += state.rewarded.gems; wallet.candy += state.rewarded.candy; saveWallet(); void protectStorage();
  }
  const earned = starsFor(state);
  if (earned > (Number(stars[state.level]) || 0)) {
    stars[state.level] = earned;
    try { localStorage.setItem('buzo-stars-v1', JSON.stringify(stars)); } catch { /* Optional in private browsing. */ }
  }
  $('resultStars').hidden = !earned; $('resultStars').textContent = starText(earned);
  $('resultStars').setAttribute('aria-label', `${earned} de 3 estrellas`);
  showRewards(state.rewarded); if (state.rewarded.coins || state.rewarded.gems) beep(state.won ? 'prize' : 'win');
  $('oxygenHud').hidden = true;
  const guest = state.coop && isGuest();
  $('againButton').hidden = guest; $('nextButton').hidden = guest || !state.won || state.level >= LEVELS.length - 1;
  $('coopResult').hidden = !state.coop;
  $('coopResult').textContent = `Entre los dos: ${state.score + state.partnerScore} palabras.${guest ? ' Esperando al anfitrión para jugar otra vez…' : ''}`;
  $('results').hidden = false; (guest ? $('homeButton') : $('againButton')).focus(); showRecord();
}
$('typing').addEventListener('input', event => {
  if (event.isComposing || waitingPartner) return;
  const result = track(() => typeInRun(state, event.target.value));
  if (result.ignored) return;
  if (result.added && !result.mistakes) anim.type = 1;
  if (result.bossHit && state.coop && coopActive()) room.send({ t: 'hit' });
  if (!seenCoach) {
    seenCoach = true; $('coach').hidden = true;
    try { localStorage.setItem('buzo-seen-v1', '1'); } catch { /* Optional. */ }
  }
  if (result.frenzy) frenzyStarted();
  if (result.loot) {
    beep(result.kind === 'gem' ? 'prize' : 'win'); cheer(result.combo % 5 === 0);
    burst(lastSaved(), result.kind === 'gem' ? '#c9a6ff' : '#ffe27a', result.kind === 'gem' ? 22 : 14);
    toast(result.kind === 'gem' ? '¡Una gema! +1 al terminar' : result.combo >= 3 ? `¡Combo ×${result.combo}! +${result.gained}` : `¡Atrapado! +${result.gained}`);
    $('status').textContent = `¡Atrapaste ${state.frenzy.caught}! +${result.gained} puntos.`;
    $('feedback').textContent = 'Seguí: puntos ×2 hasta que se acabe el tiempo.';
  } else if (result.complete && !result.frenzy) {
    beep(result.kind === 'golden' || result.kind === 'whale' ? 'prize' : 'win');
    cheer(result.bossHit || state.streak % 5 === 0);
    burst(lastSaved(), result.kind === 'golden' ? '#ffe27a' : result.kind === 'whale' ? '#9be3ff' : '#fff5c2', result.kind === 'golden' ? 22 : 12);
    const praise = ['¡Genial!', '¡Muy bien!', '¡Así se hace!'][state.score % 3];
    toast(result.kind === 'whale' ? (state.relaxed ? '¡La ballena te saludó!' : '¡La ballena te regaló oxígeno! +12%')
      : result.kind === 'golden' ? '¡Tiburón dorado! +1 gema al terminar'
      : result.bossHit ? `¡Tentáculo calmado! +${result.gained}` : state.streak >= 3 ? `¡Racha de ${state.streak}! +${result.gained}` : `${praise} +${result.gained}`);
    $('status').textContent = result.bossHit ? `¡Bien! +${result.gained} puntos. Quedan ${state.boss.hp} tentáculos por calmar.` : `¡Bien! +${result.gained} puntos. Bajaste a ${state.depth} metros.`;
    if (result.bossStarted) $('status').textContent = '¡Llegaste al naufragio! Otto custodia el tesoro. Encontraste una reserva de oxígeno.';
    $('feedback').textContent = state.relaxed ? '¡Seguí con la próxima palabra!' : 'Palabra completa: +3% de oxígeno.';
  } else if (result.mistakes) {
    beep('miss'); $('feedback').textContent = state.relaxed || state.mode === 'frenzy' ? 'Usá Retroceso para corregir. ¡Vos podés!' : `−${result.mistakes * 5}% de oxígeno. Corregí con Retroceso.`;
    $('typing').classList.remove('shake'); void $('typing').offsetWidth; $('typing').classList.add('shake');
  } else if (!result.frenzy) {
    $('feedback').textContent = 'Seguí con la tecla iluminada. No hace falta Enter.';
  }
  sync(); if (state.mode === 'ended') finish();
});
$('typing').addEventListener('compositionend', () => $('typing').dispatchEvent(new Event('input')));
$('typing').addEventListener('paste', event => { event.preventDefault(); $('feedback').textContent = 'Escribí con tus dedos, sin pegar palabras.'; });
function pause() {
  if (!['playing', 'diving', 'bossIntro', 'boss', 'frenzy', 'celebrating'].includes(state.mode)) return;
  pausedMode = state.mode; state.mode = 'paused';
  $('pauseOverlay').hidden = false; $('typing').disabled = true; $('pauseButton').textContent = 'Seguir'; $('resumeButton').focus();
}
function resume() {
  if (state.mode !== 'paused' || modalOpen()) return;
  state.mode = pausedMode; $('pauseOverlay').hidden = true; $('pauseButton').textContent = 'Pausar';
  sync(); if (typingMode()) $('typing').focus();
}
function home() {
  state = createRun(Number($('level').value), $('relaxed').checked); state.mode = 'welcome'; emotes.length = 0; particles.length = 0;
  $('results').hidden = true; $('pauseOverlay').hidden = true; $('welcome').hidden = false; $('targetList').hidden = true;
  $('typing').disabled = true; $('typing').value = ''; $('pauseButton').disabled = true;
  $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true; $('frenzyHud').hidden = true; $('frenzyBanner').hidden = true; $('coach').hidden = true; renderLevels();
  $('status').textContent = '¿Listo para una nueva inmersión?'; $('wordDisplay').textContent = 'f j f j';
  $('feedback').textContent = 'Escribí para sumar. Cuidá tu oxígeno.'; hud(); hint(null); showRecord(); renderLobby(); $('startButton').focus();
}
function launch() {
  if (coopActive()) {
    if (!room || room.role !== 'host') return;
    room.send({ t: 'start', level: Number($('level').value), relaxed: $('relaxed').checked });
  }
  start();
}
$('nextButton').onclick = () => { $('level').value = String(state.level + 1); renderLevels(); launch(); };
$('startButton').onclick = launch; $('againButton').onclick = launch;
$('coopButton').onclick = () => { $('coopMenu').hidden = false; $('coopWait').hidden = true; $('coopMessage').textContent = ''; $('coop').showModal(); };
$('hostButton').onclick = async () => {
  $('coopMessage').textContent = 'Creando sala…';
  try { const Peer = await loadPeer(); room = hostRoom(Peer, roomHandlers()); } catch { coopFail('load'); }
};
$('joinButton').onclick = async () => {
  const code = normalizeCode($('codeInput').value);
  if (code.length < 4) { $('coopMessage').textContent = 'El código tiene 4 letras.'; return; }
  $('coopMessage').textContent = 'Conectando…';
  try { const Peer = await loadPeer(); room = joinRoom(Peer, code, roomHandlers()); } catch { coopFail('load'); }
};
$('codeInput').addEventListener('input', () => { $('codeInput').value = normalizeCode($('codeInput').value); });
$('copyInvite').onclick = async () => {
  const link = $('inviteLink').value;
  try {
    if (navigator.share) { await navigator.share({ title: 'Buzo de letras', text: '¡Vení a bucear conmigo!', url: link }); return; }
    await navigator.clipboard.writeText(link); $('coopMessage').textContent = '¡Link copiado! Mandáselo a tu compañero.';
  } catch { $('inviteLink').select?.(); $('coopMessage').textContent = 'Copiá el link de arriba y mandáselo.'; }
};
// Opening an invite link (…?sala=ABCD) prepares the join dialog with that code.
const invited = codeFromLink(search);
if (invited.length === 4) {
  try { history.replaceState(null, '', location.pathname); } catch { /* The code still works. */ }
  $('coopMenu').hidden = false; $('coopWait').hidden = true; $('codeInput').value = invited;
  $('coopMessage').textContent = `Te invitaron a la sala ${invited}. Tocá Entrar.`;
  queueMicrotask(() => { try { $('coop').showModal(); $('joinButton').focus(); } catch { /* Dialog unsupported. */ } });
}
$('cancelRoom').onclick = $('closeCoop').onclick = () => $('coop').close();
$('coop').addEventListener('close', () => { if (room && !linked) { room.close(); room = null; renderLobby(); } });
$('leaveRoom').onclick = leaveRoom;
for (const emote of EMOTES) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = emote;
  button.setAttribute('aria-label', `Mandar ${emote}`);
  button.onmousedown = event => event.preventDefault?.();
  button.onclick = () => {
    if (!coopActive()) return;
    room.send({ t: 'emote', e: emote }); emotes.push({ who: 'me', text: emote, time: 0 });
    if (typingMode()) $('typing').focus();
  };
  $('emoteBar').append(button);
} $('homeButton').onclick = home; $('exitButton').onclick = home;
$('pauseButton').onclick = () => state.mode === 'paused' ? resume() : pause(); $('resumeButton').onclick = resume;
$('level').onchange = showRecord; $('relaxed').onchange = showRecord;
$('soundButton').onclick = () => {
  sound = !sound; showSound(); if (sound) beep('win');
  try { localStorage.setItem('buzo-sound-v1', sound ? 'on' : 'off'); } catch { /* Optional. */ }
};
$('guideButton').onclick = () => { const open = $('handGuide').hidden; $('handGuide').hidden = !open; $('guideButton').setAttribute('aria-expanded', String(open)); $('guideButton').textContent = open ? 'Ocultar posición de las manos' : 'Ver posición de las manos'; };
$('helpButton').onclick = () => { pause(); $('help').showModal(); };
$('closeHelp').onclick = $('helpReady').onclick = () => $('help').close();
function shopCard(item, kind) {
  const isSkin = kind === 'skin';
  const owned = wallet.owned.includes(item.id);
  const equipped = isSkin ? wallet.equipped === item.id : wallet.gear[item.slot] === item.id;
  const card = document.createElement('div'); card.className = `skin-card ${equipped ? 'equipped' : ''} ${item.event ? 'seasonal' : ''}`;
  const preview = document.createElement('canvas'); preview.width = 400; preview.height = 260;
  preview.setAttribute('aria-hidden', 'true');
  const pctx = preview.getContext('2d');
  if (pctx) {
    pctx.fillStyle = item.event ? '#2d2350' : '#0a6a7c'; pctx.fillRect(0, 0, 400, 260);
    // Pets and trails sit to the left of the diver, so those previews shift right.
    const shift = ['pet', 'trail', 'back'].includes(item.slot) ? 50 : 0;
    drawDiver(pctx, 190 + shift, 160, 1.15, 1, 0, isSkin ? item.id : wallet.equipped, isSkin ? wallet.gear : { ...wallet.gear, [item.slot]: item.id });
  }
  const title = document.createElement('h3'); title.textContent = item.name;
  const blurb = document.createElement('p');
  blurb.textContent = item.slot === 'fins' && skinById(wallet.equipped).extra === 'tail' ? `${item.blurb} (La cola de sirena las tapa.)` : item.blurb;
  const price = document.createElement('div'); price.className = 'skin-price';
  const cost = priceOf(item);
  if (owned) price.textContent = equipped ? 'Puesto' : 'Tuyo';
  else if (!cost.coins && !cost.gems && !cost.candy) price.textContent = 'Gratis';
  else {
    for (const kind of ['coins', 'gems', 'candy']) if (cost[kind]) {
      const part = document.createElement('span'); part.append(amount(cost[kind], { coins: 'coin', gems: 'gem', candy: 'candy' }[kind], '')); price.append(part);
    }
  }
  const button = document.createElement('button');
  const done = text => { saveWallet(); renderShop(); $('shopMessage').textContent = text; };
  if (owned) {
    if (isSkin) {
      button.textContent = equipped ? 'Equipado' : 'Equipar'; button.disabled = equipped;
      button.onclick = () => { equipSkin(wallet, item.id); done(`Ahora usás el ${item.name.toLowerCase()}.`); };
    } else {
      button.textContent = equipped ? 'Quitar' : 'Equipar';
      button.onclick = () => { equipGear(wallet, item.slot, equipped ? null : item.id); done(equipped ? `Te sacaste: ${item.name.toLowerCase()}.` : `Te pusiste: ${item.name.toLowerCase()}.`); };
    }
  } else {
    const ok = canAfford(wallet, item);
    button.textContent = ok ? 'Comprar' : cost.candy ? 'Te faltan caramelos' : 'Te falta tesoro'; button.disabled = !ok;
    button.setAttribute('aria-label', `${button.textContent}: ${item.name}`);
    button.onclick = () => {
      if (!buySkin(wallet, item.id, season?.id)) return;
      if (isSkin) equipSkin(wallet, item.id); else equipGear(wallet, item.slot, item.id);
      done(`¡Compraste ${item.name.toLowerCase()} y ya lo tenés puesto!`);
    };
  }
  card.append(preview); card.append(title); card.append(blurb); card.append(price); card.append(button);
  return card;
}
let shopTab = season ? 'event' : 'skins';
function renderShop() {
  $('shopCoins').textContent = wallet.coins; $('shopGems').textContent = wallet.gems; $('shopCandy').textContent = wallet.candy;
  $('shopCandyWrap').hidden = !season && !wallet.candy;
  const view = $('shopPreview').getContext('2d');
  if (view) { view.clearRect(0, 0, 400, 260); view.fillStyle = '#0a6a7c'; view.fillRect(0, 0, 400, 260); drawDiver(view, 230, 160, 1.15, 1, 0, wallet.equipped, wallet.gear); }
  $('shopTabs').replaceChildren();
  const tabs = [{ id: 'skins', title: 'Trajes' }, ...SLOTS.map(slot => ({ id: slot.id, title: slot.title }))];
  if (season) tabs.unshift({ id: 'event', title: '🎃 Halloween' });
  if (!tabs.some(tab => tab.id === shopTab)) shopTab = 'skins';
  for (const tab of tabs) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = tab.title;
    button.className = `shop-tab ${tab.id === shopTab ? 'selected' : ''}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(tab.id === shopTab));
    button.onclick = () => { shopTab = tab.id; renderShop(); };
    $('shopTabs').append(button);
  }
  $('skinGrid').replaceChildren();
  const grid = document.createElement('div'); grid.className = 'skin-grid';
  // Seasonal items stay visible to their owners after the season ends.
  const shown = item => onSale(item, season?.id) || wallet.owned.includes(item.id);
  if (shopTab === 'event') {
    for (const skin of SKINS.filter(entry => entry.event === season.id)) grid.append(shopCard(skin, 'skin'));
    for (const item of ACCESSORIES.filter(entry => entry.event === season.id)) grid.append(shopCard(item, 'gear'));
  } else if (shopTab === 'skins') for (const skin of SKINS.filter(shown)) grid.append(shopCard(skin, 'skin'));
  else for (const item of ACCESSORIES.filter(accessory => accessory.slot === shopTab && shown(accessory))) grid.append(shopCard(item, 'gear'));
  $('skinGrid').append(grid);
}
// ----- Progress backup and restore -----
async function protectStorage() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* Optional. */ }
  return false;
}
const snapshot = () => ({ wallet, stars, records, sound });
function markBackup() {
  lastBackup = Date.now();
  try { localStorage.setItem('buzo-backup-v1', JSON.stringify({ at: lastBackup })); } catch { /* Optional. */ }
  saveWallet(); $('progressStatus').textContent = `Tu progreso se guarda en este navegador (${backupAge(lastBackup)}).`;
}
function progressMessage(text, error = false) { $('progressMessage').textContent = text; $('progressMessage').classList.toggle('error', error); }
let pendingRestore = null;
async function openProgress() {
  pause(); pendingRestore = null; progressMessage(''); $('confirmRestore').hidden = true; $('restoreInput').value = '';
  $('backupCode').value = makeBackup(snapshot());
  $('progressStatus').textContent = `Tu progreso se guarda en este navegador (${backupAge(lastBackup)}).`;
  $('storageStatus').textContent = '';
  $('progress').showModal();
  const kept = await protectStorage();
  $('storageStatus').textContent = kept ? 'El navegador protegió estos datos para que no se borren solos.' : 'El navegador puede borrar estos datos si hace falta espacio. Guardá un respaldo para no perderlos.';
}
async function copyBackup() {
  try { await navigator.clipboard.writeText($('backupCode').value); }
  catch { $('backupCode').select?.(); try { document.execCommand?.('copy'); } catch { /* The code stays visible to copy by hand. */ } }
  markBackup(); progressMessage('¡Código copiado! Guardalo en un lugar seguro.');
}
function downloadBackup() {
  try {
    const url = URL.createObjectURL(new Blob([$('backupCode').value], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'buzo-de-letras-progreso.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markBackup(); progressMessage('Archivo descargado. Guardalo en un lugar seguro.');
  } catch { progressMessage('No se pudo descargar. Copiá el código y guardalo a mano.', true); }
}
function checkRestore() {
  const data = readBackup($('restoreInput').value);
  if (!data) { pendingRestore = null; $('confirmRestore').hidden = true; progressMessage('Ese código no es válido. Revisá que esté completo.', true); return; }
  pendingRestore = data; $('confirmRestore').hidden = false;
  progressMessage(`Código válido: ${describeBackup(data)}. Reemplazaría lo que tenés ahora (${describeBackup(snapshot())}).`);
}
function applyRestore() {
  if (!pendingRestore) return;
  ({ wallet, stars, records, sound } = { ...pendingRestore });
  try {
    localStorage.setItem('buzo-records-v4', JSON.stringify(records)); localStorage.setItem('buzo-stars-v1', JSON.stringify(stars));
    localStorage.setItem('buzo-sound-v1', sound ? 'on' : 'off');
  } catch { /* Optional in private browsing. */ }
  pendingRestore = null; $('confirmRestore').hidden = true;
  markBackup(); showSound(); renderLevels(); showRecord(); hud(); progressMessage('¡Progreso recuperado!');
}
$('progressButton').onclick = openProgress; $('closeProgress').onclick = () => $('progress').close();
$('progress').addEventListener('close', () => { if (state.mode === 'paused') $('resumeButton').focus(); });
$('copyBackup').onclick = copyBackup; $('downloadBackup').onclick = downloadBackup;
$('checkRestore').onclick = checkRestore; $('confirmRestore').onclick = applyRestore;
$('restoreFile').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { $('restoreInput').value = (await file.text()).slice(0, 20000); checkRestore(); } catch { progressMessage('No se pudo leer el archivo.', true); }
});
function openShop() { pause(); $('shopMessage').textContent = ''; renderShop(); $('shop').showModal(); }
$('shopButton').onclick = $('resultShopButton').onclick = openShop;
$('closeShop').onclick = () => $('shop').close();
$('shop').addEventListener('close', () => { if (state.mode === 'paused') $('resumeButton').focus(); });
$('help').addEventListener('close', () => { if (state.mode === 'paused') $('resumeButton').focus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalOpen()) { event.preventDefault(); state.mode === 'paused' ? resume() : pause(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
function resize() {
  const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  width = rect.width; height = rect.height; canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
// ----- Ghost hands over the reference keyboard -----
const handsCanvas = $('handsCanvas'), hctx = handsCanvas.getContext('2d'), handsScratch = document.createElement('canvas');
const hands = createHands();
let handsLayout = { keys: {} }, handsSize = { width: 0, height: 0 }, handsFresh = true;
let handsOn = true;
try { handsOn = localStorage.getItem('buzo-hands-v1') !== 'off'; } catch { /* Optional. */ }
function showHands() {
  handsCanvas.classList.toggle('off', !handsOn);
  $('handsButton').textContent = `Manos guía: ${handsOn ? 'sí' : 'no'}`; $('handsButton').setAttribute('aria-pressed', String(handsOn));
}
// Key centers in canvas pixels, measured from the real keyboard layout.
function measureHands() {
  const wrap = handsCanvas.parentElement?.getBoundingClientRect?.();
  if (!wrap || !wrap.width) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  handsSize = { width: wrap.width, height: wrap.height };
  handsCanvas.width = wrap.width * ratio; handsCanvas.height = wrap.height * ratio; hctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const keys = {};
  for (const key of document.querySelectorAll('.key')) {
    const r = key.getBoundingClientRect();
    if (Number.isFinite(r.left)) keys[key.dataset.key] = { x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top + r.height / 2, w: r.width, h: r.height };
  }
  handsLayout = { keys }; handsFresh = true;
}
if (handsCanvas.parentElement) new ResizeObserver(measureHands).observe(handsCanvas.parentElement);
$('handsButton').onclick = () => {
  handsOn = !handsOn; showHands();
  try { localStorage.setItem('buzo-hands-v1', handsOn ? 'on' : 'off'); } catch { /* Optional. */ }
};
function renderHands(dt) {
  if (!handsOn || !handsSize.width) return;
  stepHands(hands, handsLayout, guideChar, dt, reducedMotion || handsFresh); handsFresh = false;
  drawHands(hctx, hands, handsLayout, handsSize.width, handsSize.height, reducedMotion ? 0 : clock, handsScratch);
}

// ----- Scene -----
// Short reactions of the diver: a nudge per letter, a jump (or a flip) per word, a wobble when hit.
const anim = { cheer: 0, hurt: 0, type: 0, flip: false };
function cheer(flip) { if (!reducedMotion) { anim.cheer = .001; anim.flip = flip; } }
function hurt() { if (!reducedMotion) anim.hurt = 1; }
// Little bursts of light and bubbles, drawn on top of the scene.
const particles = [];
// Where Otto floats (for the victory burst) and where each piece of treasure left the boat.
let ottoAt = null;
const lootStart = new Map();
const lastPos = new Map();
let lastTarget = null;
function lastSaved() { return lastPos.get(lastTarget) || null; }
function burst(at, color, count = 12) {
  if (!at || reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + Math.random() * .4, speed = 60 + Math.random() * 90;
    particles.push({ x: at.x, y: at.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life: 0, max: .7 + Math.random() * .4, color, star: i % 2 === 0 });
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    if (p.star) {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
    } else {
      ctx.strokeStyle = '#d0f6eb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function stepAnimations(dt) {
  if (anim.cheer > 0) { anim.cheer += dt / .7; if (anim.cheer >= 1) anim.cheer = 0; }
  anim.hurt = Math.max(0, anim.hurt - dt / .8);
  anim.type = Math.max(0, anim.type - dt / .18);
  for (const p of particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy = p.vy * .94 - 20 * dt; }
  while (particles.length && particles[0].life >= particles[0].max) particles.shift();
  if (particles.length > 200) particles.splice(0, particles.length - 200);
}
function pose(look = 0) {
  return { cheer: anim.cheer, flip: anim.flip, hurt: anim.hurt, type: anim.type, worried: !state.relaxed && state.oxygen <= 30 && ['playing', 'boss'].includes(state.mode), look };
}
function label(word, x, y, labelY, selected, tether = true) {
  ctx.font = `bold ${width < 500 ? 15 : 20}px Trebuchet MS, Arial`;
  const labelWidth = ctx.measureText(word).width + 26;
  const labelX = Math.max(labelWidth / 2 + 8, Math.min(width - labelWidth / 2 - 8, x));
  ctx.strokeStyle = selected ? '#ffdb70aa' : '#b6e0dc55'; ctx.lineWidth = 1;
  if (tether) { ctx.beginPath(); ctx.moveTo(labelX, labelY + 32); ctx.lineTo(x, y - 12); ctx.stroke(); }
  ctx.fillStyle = selected ? '#ffdb70' : '#edf6f4';
  ctx.beginPath(); ctx.roundRect(labelX - labelWidth / 2, labelY, labelWidth, 34, 8); ctx.fill();
  if (selected) { ctx.strokeStyle = '#fff5c2'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = '#164b57'; ctx.textAlign = 'center'; ctx.fillText(word, labelX, labelY + 23);
}
// Where the oxygen meter sits: just above the tallest piece the diver wears.
function hudTop(y, scale, skin = wallet.equipped, gear = wallet.gear) { return y + (diverTop(skin, gear) - 4) * scale - 43; }

function draw() {
  const t = reducedMotion ? 0 : clock;
  const welcome = state.mode === 'welcome';
  const diving = state.mode === 'diving' || state.mode === 'paused' && pausedMode === 'diving';
  const sceneDepth = reducedMotion ? state.depth : state.visualDepth;
  const theme = season?.id || null;
  drawOceanBackdrop(ctx, width, height, sceneDepth, t, theme);
  drawOceanForeground(ctx, width, height, sceneDepth, t);
  if (welcome) {
    ctx.fillStyle = '#b7dfdc'; ctx.fillRect(0, 0, width, 110);
    ctx.strokeStyle = '#e3f6ed'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(0, 110); ctx.lineTo(width, 110); ctx.stroke();
    drawBoat(ctx, width * .73, 103, Math.min(.85, width / 750), t);
    const small = width < 500;
    drawDiver(ctx, width * .66, height * .53 + Math.sin(t * 1.5) * 4, small ? .65 : 1.05, t, state.visualDepth, wallet.equipped, wallet.gear, { look: 1 });
    if (coopActive() && partner) {
      const px = width * .5, py = height * .66 + Math.sin(t * 1.5 + 2) * 4;
      drawDiver(ctx, px, py, small ? .45 : .7, t + 1, 0, partner.skin, partner.gear, { look: 1 });
      ctx.textAlign = 'center'; ctx.font = 'bold 12px Trebuchet MS'; ctx.fillStyle = '#e6f5f4'; ctx.fillText('Tu compañero', px, py + (small ? 45 : 70));
    }
    drawCreature(ctx, 'shark', width * .85, height * .57, small ? .45 : .8, { time: t, costume: theme });
    label('mar', width * .85, height * .57, height * .57 - 85, false);
    return;
  }
  const diverFrac = state.coop ? .33 : .5;
  const diverX = width * diverFrac, diverY = height * .53;
  const scale = width < 500 ? .6 : .9;
  if (diving) {
    const progress = state.diveTime / 1.6;
    const eased = 1 - Math.pow(1 - progress, 2);
    const waterline = height * .27 - Math.max(0, progress - .45) * height;
    ctx.fillStyle = '#a8dfdc'; ctx.fillRect(0, 0, width, Math.max(0, waterline));
    if (waterline > -40) {
      ctx.strokeStyle = '#d9f6ed'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(0, waterline); ctx.lineTo(width, waterline); ctx.stroke();
      const boatScale = Math.min(1.05, width / 720);
      drawBoat(ctx, diverX - 108 * boatScale, waterline - 7, boatScale, t);
    }
    const entryY = -80 + (diverY + 80) * eased;
    drawDiver(ctx, diverX, entryY, scale, t, 0, wallet.equipped, wallet.gear);
    $('oxygenHud').style.top = `${Math.max(8, hudTop(entryY, scale))}px`;
    ctx.font = 'bold 24px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#f0f7f4';
    ctx.fillText('¡Al agua!', width / 2, height * .85);
    return;
  }
  if (state.boss) {
    const smallScreen = width < 500;
    drawShipwreck(ctx, width * .23, height * (smallScreen ? .71 : .77), Math.min(1, width / 650), t, state.won ? (reducedMotion ? 1 : Math.min(1, (state.treasureTime || 0) / 1.8)) : 0, smallScreen ? { x: 35, y: -45 } : undefined);
    const ottoX = width * .77, ottoY = height * .42, ottoScale = Math.min(1.15, width / 620);
    ottoAt = { x: ottoX, y: ottoY };
    drawOctopus(ctx, ottoX, ottoY, ottoScale, t, { ...state.boss, theme,
      attackTime: reducedMotion ? 0 : state.boss.attackTime,
      charging: !state.relaxed && (state.mode === 'boss' || state.mode === 'paused' && pausedMode === 'boss') && state.boss.attackIn <= 1.5,
      target: { x: (diverX - ottoX) / ottoScale, y: (diverY - ottoY) / ottoScale }
    });
  }
  // During the frenzy the expedition boat sails overhead, dropping treasure.
  const frenzy = inFrenzy();
  const boatX = width * (.5 + Math.sin(t * .35) * .3);
  if (frenzy) drawBoatShadow(ctx, boatX, 20, Math.min(1, width / 700), t);
  const bob = Math.sin(t * 1.5) * 4;
  const target = state.sharks.find(enemy => enemy.id === state.targetId);
  const lootX = loot => width * (.12 + loot.lane * .19);
  const look = frenzy ? (target ? Math.max(-1, Math.min(1, (lootX(target) - diverX) / (width * .3))) : 0) : state.boss ? 1 : target ? (target.side === 'left' ? -1 : 1) : 0;
  drawDiver(ctx, diverX, diverY + bob, scale, t, state.visualDepth, wallet.equipped, wallet.gear, pose(look));
  const myHud = hudTop(diverY + bob, scale);
  $('oxygenHud').style.top = `${myHud}px`;
  if (state.coop) {
    const px = width * .55, py = diverY + Math.sin(t * 1.5 + 2) * 4, mate = partner || { skin: 'clasico', gear: {} };
    drawDiver(ctx, px, py, scale, t + 1, state.visualDepth, mate.skin, mate.gear, { look: 1 });
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Trebuchet MS'; ctx.fillStyle = '#e6f5f4';
    ctx.fillText(waitingPartner ? 'Reconectando…' : 'Tu compañero', px, py + 100 * scale);
    for (const emote of emotes) {
      const mine = emote.who === 'me';
      ctx.globalAlpha = Math.max(0, 1 - emote.time / 2); ctx.font = '30px Trebuchet MS';
      ctx.fillText(emote.text, mine ? diverX : px, (mine ? myHud : hudTop(py, scale, mate.skin, mate.gear) + 30) - (reducedMotion ? 0 : emote.time * 30));
    }
    ctx.globalAlpha = 1;
  }
  const laneY = [.23, .42, .63, .83];
  lastPos.clear();
  for (const loot of frenzy ? state.sharks : []) {
    if (!lootStart.has(loot.id)) lootStart.set(loot.id, boatX);
    // Thrown from the boat toward its column, then it sinks straight down.
    const throwing = Math.min(1, loot.progress / .15), from = lootStart.get(loot.id);
    const x = from + (lootX(loot) - from) * (1 - (1 - throwing) ** 2);
    const exit = loot.departure ? (reducedMotion ? 1 : Math.min(1, loot.exitTime / .6)) : 0;
    let y = 44 + (height * .9 - 44) * loot.progress - Math.sin(Math.PI * throwing) * 18;
    if (loot.departure === 'caught') y -= exit * 30;
    lastPos.set(loot.id, { x, y });
    ctx.save(); if (loot.departure === 'lost') ctx.globalAlpha = 1 - exit;
    drawLoot(ctx, loot.kind, x, y, width < 500 ? .75 : 1, { time: t, id: loot.id, flinch: reducedMotion ? 0 : loot.flinch, caught: loot.departure === 'caught' ? exit : 0 });
    ctx.restore();
    if (!loot.departure) label(loot.word, x, y, y < 140 ? y + 26 : y - (width < 500 ? 62 : 72), loot.id === state.targetId, false);
  }
  for (const enemy of frenzy ? [] : state.sharks) {
    const startX = width * (enemy.side === 'left' ? .1 : .9);
    const endX = width * (enemy.side === 'left' ? diverFrac - .06 : diverFrac + .06);
    let x = startX + (endX - startX) * enemy.progress;
    let y = height * laneY[enemy.lane] + (diverY - height * laneY[enemy.lane]) * enemy.progress;
    const fleeing = Boolean(enemy.departure);
    if (fleeing) {
      const exit = reducedMotion ? 1 : enemy.exitTime / .8;
      x += (enemy.side === 'left' ? -1 : 1) * exit * width * .5;
      if (enemy.departure === 'saved' && !reducedMotion) y -= exit * 30;
    }
    y += Math.sin(t + enemy.id) * 3;
    lastPos.set(enemy.id, { x, y });
    const size = (width < 500 ? .4 : .75) * (enemy.kind === 'whale' ? .8 : enemy.kind === 'puffer' ? 1.15 : 1);
    // A friendly whale swims past the diver instead of toward it.
    drawCreature(ctx, enemy.kind, x, y, size, {
      flip: (enemy.side === 'left') !== (fleeing && enemy.departure !== 'passed'), fleeing: fleeing && enemy.departure !== 'passed',
      progress: enemy.progress, flinch: reducedMotion ? 0 : enemy.flinch, time: t, id: enemy.id, costume: theme
    });
    // Labels stay below the floating counters at the top of the ocean.
    const lift = (width < 500 ? 43 : 58) + (enemy.kind === 'puffer' ? 12 : 0);
    if (!fleeing) label(enemy.word, x, y, Math.max(48, Math.min(height * .63, height * laneY[enemy.lane] - lift)), enemy.id === state.targetId);
  }
  if (!state.relaxed && state.oxygen <= 30) {
    ctx.strokeStyle = '#ef8f83'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, width - 4, height - 4);
  }
  for (const effect of state.effects) {
    ctx.globalAlpha = Math.max(0, 1 - effect.time / 1.2);
    ctx.font = 'bold 23px Trebuchet MS'; ctx.fillStyle = effect.kind === 'win' ? '#ffdb70' : '#ffa99b';
    ctx.fillText(effect.text, diverX, myHud - 10 - (reducedMotion ? 0 : effect.time * 28));
    ctx.globalAlpha = 1;
  }
  drawParticles();
}
function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now;
  const live = !document.hidden && !waitingPartner;
  if (live && ['welcome', 'diving', 'playing', 'bossIntro', 'boss', 'frenzy', 'celebrating'].includes(state.mode)) { clock += dt; stepAnimations(dt); }
  // The chest opens while the treasure rains down.
  if (live && state.mode === 'frenzy') state.treasureTime = (state.treasureTime || 0) + dt;
  if (live && state.mode === 'celebrating') {
    state.treasureTime += dt;
    if (state.treasureTime >= 3) finish();
  }
  const targetBefore = state.targetId;
  lastTarget = targetBefore ?? lastTarget;
  for (const emote of emotes) emote.time += dt;
  while (emotes.length && emotes[0].time >= 2) emotes.shift();
  if (live && coopActive() && room.role === 'host' && state.coop && !state.relaxed && ['playing', 'boss'].includes(state.mode) && (syncClock += dt) >= 1) {
    syncClock = 0; room.send({ t: 'sync', o: state.oxygen, ack: o2Ack });
  }
  const events = live ? track(() => tickRun(state, dt)) : [];
  if (events.length || targetBefore !== state.targetId) {
    sync();
    if (events.includes('bossReady')) {
      toast('¡Batalla final contra Otto!');
      $('status').textContent = '¡Batalla final! Escribí ocho frases con su espacio. Cada letra bien escrita frena a Otto.';
      $('feedback').textContent = 'Dos palabras y un espacio calman un tentáculo.'; $('typing').focus();
    }
    if (events.includes('bossAttack')) {
      beep('miss'); hurt(); toast(`¡Otto atacó! −${bossAttackDamage(state)}% O₂`, 'miss'); $('status').textContent = `¡Otto agitó sus tentáculos! −${bossAttackDamage(state)}% de oxígeno.`;
      $('feedback').textContent = 'Tu frase sigue intacta. ¡Seguí escribiendo!';
    }
    if (events.includes('frenzyReady')) {
      toast('¡Atrapá el tesoro! Puntos ×2'); $('status').textContent = 'Escribí la palabra de cada moneda o gema antes de que toque el fondo.'; $('typing').focus();
    }
    if (events.includes('lootLost')) $('feedback').textContent = 'Una moneda se hundió en la arena. ¡Vamos con la próxima!';
    if (events.includes('ready')) {
      if (!seenCoach) $('coach').hidden = false;
      $('status').textContent = 'Elegí un tiburón escribiendo la primera letra de su palabra.';
      $('typing').focus();
    }
    if (events.includes('collision')) {
      beep('shark'); hurt(); toast('¡Un tiburón llegó! −22% O₂', 'miss'); $('status').textContent = '¡Un tiburón llegó! −22% de oxígeno. Seguí escribiendo.';
    }
  }
  if (state.boss) updateBossHud();
  if (state.frenzy) updateFrenzyHud();
  if (state.mode === 'ended') { hud(); finish(); }
  draw(); renderHands(dt); requestAnimationFrame(frame);
}
if (season) { $('eventBanner').hidden = false; $('eventBanner').textContent = `🎃 ${season.name} · ¡ganá caramelos!`; $('eventBanner').title = season.blurb; }
showHands(); measureHands(); resize(); saveWallet(); showSound(); renderLobby(); showRecord(); hud(); requestAnimationFrame(frame);
