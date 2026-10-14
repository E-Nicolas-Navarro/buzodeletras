import { drawBoat, drawDiver, drawOceanBackdrop, drawOceanForeground, drawShipwreck, drawOctopus } from './visuals.js';
import { LEVELS, MISSION_WORDS, BOSS_HITS, currentWord, fingerFor, accuracy, computeRewards, starsFor, refreshRun, partnerBossHit, bossAttackDamage, createRun, activeSharks, chooseTarget, typeInRun, tickRun } from './engine.js';
import { SKINS, SLOTS, ACCESSORIES, sanitizeWallet, canAfford, buySkin, equipSkin, equipGear } from './skins.js';
import { makeBackup, readBackup, describeBackup, needsBackup, backupAge } from './save.js';
import { loadPeer, hostRoom, joinRoom, normalizeCode, EMOTES } from './net.js';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createRun(0); state.mode = 'welcome';
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
  $('walletCoins').textContent = wallet.coins; $('walletGems').textContent = wallet.gems;
  $('progressButton').classList.toggle('needs-backup', needsBackup(wallet, lastBackup));
}
const modalOpen = () => $('help').open || $('shop').open || $('coop').open || $('progress').open;
// ----- Two-player room: shared oxygen, words and boss, one device each -----
let room = null, linked = false, partner = null, coopNote = '', syncClock = 0;
const emotes = [];
const coopActive = () => Boolean(room && linked);
const isGuest = () => coopActive() && room.role === 'guest';
const clamp = value => Math.max(0, Math.min(100, value));
function sendHello() { if (coopActive()) room.send({ t: 'hello', skin: wallet.equipped, gear: wallet.gear }); }
function renderLobby() {
  const inRoom = coopActive();
  $('coopBanner').hidden = !inRoom && !coopNote; $('leaveRoom').hidden = !inRoom;
  $('coopText').textContent = inRoom ? `Sala ${room.code} · ${isGuest() ? 'conectado con el anfitrión' : '¡tu compañero está conectado!'}` : coopNote;
  $('coopButton').hidden = Boolean(room); $('earn').hidden = inRoom;
  $('startButton').disabled = isGuest();
  $('startButton').innerHTML = isGuest() ? 'Esperando al anfitrión…' : inRoom ? '¡Empezar juntos!' : '¡Al agua! <span>↗</span>';
  $('relaxed').disabled = isGuest(); renderLevels();
}
function leaveRoom() {
  room?.close(); room = null; linked = false; partner = null;
  if (state.coop) home(); else renderLobby();
}
function partnerLeft() {
  room?.close(); room = null; linked = false; partner = null; coopNote = 'Tu compañero se desconectó.';
  if (state.coop) home(); else renderLobby();
}
const COOP_ERRORS = {
  load: 'No se pudo cargar el servicio de salas. Revisá tu conexión.',
  server: 'No pudimos conectar con el servicio de salas. Probá de nuevo en un rato.',
  notfound: 'No encontramos esa sala. Revisá el código.',
  timeout: 'Tardó demasiado en conectar. Probá de nuevo.'
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
  if (state.oxygen !== oxygen && !state.relaxed) room.send({ t: 'o2', d: state.oxygen - oxygen });
  if (state.score !== score) room.send({ t: 'score', v: state.score });
  if (state.collisions !== collisions) room.send({ t: 'col', v: state.collisions });
  return out;
}
function handlePartner(msg) {
  if (msg.t === 'hello') { partner = { skin: msg.skin, gear: msg.gear }; return; }
  if (msg.t === 'start') {
    if (!isGuest() || !['welcome', 'results', 'ended', 'celebrating'].includes(state.mode)) return;
    $('shop').close(); $('help').close();
    $('level').value = String(msg.level); $('relaxed').checked = msg.relaxed; start(); return;
  }
  if (!state.coop) return;
  if (msg.t === 'o2' && !state.relaxed) state.oxygen = clamp(state.oxygen + msg.d);
  else if (msg.t === 'sync' && !state.relaxed && isGuest()) state.oxygen = msg.o;
  else if (msg.t === 'score') state.partnerScore = msg.v;
  else if (msg.t === 'col') { if (msg.v > state.partnerCollisions) toast('¡Un tiburón alcanzó a tu compañero!', 'miss'); state.partnerCollisions = msg.v; }
  else if (msg.t === 'hit') partnerBossHit(state);
  else if (msg.t === 'emote') emotes.push({ who: 'partner', text: msg.e, time: 0 });
  const before = state.mode;
  refreshRun(state);
  if (before === 'playing' && state.mode === 'bossIntro') $('status').textContent = '¡Llegaron al naufragio! Otto custodia el tesoro.';
  sync(); if (state.mode === 'ended') finish();
}
const roomHandlers = () => ({
  onCode: code => { $('roomCode').textContent = code; $('coopMenu').hidden = true; $('coopWait').hidden = false; $('coopMessage').textContent = ''; },
  onConnect: () => { linked = true; coopNote = ''; $('coopMessage').textContent = ''; sendHello(); $('coop').close(); renderLobby(); },
  onMessage: handlePartner, onClose: partnerLeft, onError: coopFail
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
    card.disabled = isGuest();
    card.onclick = () => { $('level').value = String(index); renderLevels(); showRecord(); };
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
function hint(char) {
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
  if (!word) { $('wordDisplay').textContent = state.mode === 'diving' ? '¡Al agua!' : '…'; hint(null); return; }
  for (let i = 0; i < word.length; i++) {
    const span = document.createElement('span'); span.textContent = word[i];
    if (i < state.input.length) span.className = state.input[i] === word[i] ? 'correct' : 'incorrect';
    $('wordDisplay').append(span);
  }
  $('wordDisplay').setAttribute('aria-label', `Palabra para escribir: ${word}`);
  let next = 0;
  while (next < state.input.length && state.input[next] === word[next]) next++;
  hint(word[Math.min(next, word.length - 1)]);
}
function updateTargets() {
  const active = state.mode === 'playing' ? activeSharks(state) : [];
  const signature = active.map(shark => `${shark.id}:${shark.id === state.targetId}`).join(',');
  if (signature === targetSignature) return;
  targetSignature = signature; $('targetList').replaceChildren();
  for (const shark of active) {
    const button = document.createElement('button');
    button.className = `target-chip ${shark.id === state.targetId ? 'selected' : ''}`;
    button.textContent = `${shark.side === 'left' ? '←' : '→'} ${shark.word}`;
    button.setAttribute('aria-label', `Elegir ${shark.word}, desde la ${shark.side === 'left' ? 'izquierda' : 'derecha'}`);
    button.setAttribute('aria-pressed', String(shark.id === state.targetId));
    button.onclick = () => {
      if (state.mode !== 'playing') return;
      chooseTarget(state, shark.id); $('typing').value = ''; updateWord(); updateTargets(); $('typing').focus();
    };
    $('targetList').append(button);
  }
}
function hud() {
  $('depth').textContent = `${state.depth} m`;
  $('scoreLabel').textContent = state.boss ? 'Pulpo' : state.coop ? 'Equipo' : 'Palabras';
  $('score').textContent = state.boss ? `${BOSS_HITS - state.boss.hp} / ${BOSS_HITS}` : `${state.score + state.partnerScore} / ${MISSION_WORDS}`;
  $('partnerHud').hidden = !state.coop || ['welcome', 'results'].includes(state.mode);
  $('partnerText').textContent = `Compañero: ${state.partnerScore} ${state.partnerScore === 1 ? 'palabra' : 'palabras'}`;
  $('oxygenHud').style.left = state.coop ? '33%' : '50%';
  $('points').textContent = state.points;
  $('air').textContent = state.relaxed ? '∞' : `${state.oxygen}%`;
  $('air').setAttribute('aria-label', state.relaxed ? 'Oxígeno ilimitado' : `Oxígeno al ${state.oxygen} por ciento`);
  $('oxygenFill').style.width = `${state.relaxed ? 100 : state.oxygen}%`;
  $('oxygenFill').classList.toggle('low', !state.relaxed && state.oxygen <= 30);
  $('oxygenHud').hidden = ['welcome', 'results'].includes(state.mode);
  $('oxygenMeter').setAttribute('aria-valuenow', String(state.relaxed ? 100 : state.oxygen));
  $('oxygenMeter').setAttribute('aria-valuetext', state.relaxed ? 'Oxígeno ilimitado' : `${state.oxygen}%`);
  document.querySelector('.sea-label').textContent = state.boss ? 'El naufragio de Otto · 240 m' : `${LEVELS[state.level].name} · Oleada ${state.wave}`;
  updateBossHud();
}
function updateBossHud() {
  $('bossHud').hidden = !state.boss || ['welcome', 'results', 'celebrating'].includes(state.mode) || (state.mode === 'paused' && pausedMode === 'celebrating');
  if (!state.boss) return;
  $('bossHp').textContent = `${state.boss.hp} / ${BOSS_HITS}`;
  $('bossHealthFill').style.width = `${state.boss.hp / BOSS_HITS * 100}%`;
  $('bossHealth').setAttribute('aria-valuenow', String(state.boss.hp));
  const warning = !state.relaxed && state.mode === 'boss' && state.boss.attackIn <= 1.5;
  $('bossHud').classList.toggle('charging', warning);
  $('bossAttackHint').textContent = state.relaxed ? 'Sin apuro: escribí las dos palabras y el espacio.' : `${warning ? '¡Prepará los dedos!' : state.boss.hp <= 4 ? '¡Otto aceleró!' : 'Ataque'} · ${Math.ceil(state.boss.attackIn)} s · El reloj no se frena.`;
}
function sync() {
  const canType = ['playing', 'boss'].includes(state.mode);
  $('typing').value = state.input; $('typing').disabled = !canType;
  $('diverConsole').hidden = !canType;
  $('bossBanner').hidden = state.mode !== 'bossIntro';
  $('targetList').hidden = state.mode !== 'playing';
  updateWord(); updateTargets(); hud();
  if (canType && !state.relaxed) {
    if (state.oxygen <= 30 && !lowWarned) { lowWarned = true; toast('¡Poco oxígeno! Seguí escribiendo', 'miss'); }
    else if (state.oxygen > 45) lowWarned = false;
  }
}
function start() {
  state = createRun(Number($('level').value), $('relaxed').checked, Math.random, { coop: coopActive() });
  sendHello(); syncClock = 0; emotes.length = 0;
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
  const row = (label, coins, gems, className = '') => {
    const div = document.createElement('div'); div.className = `reward-row ${className}`;
    const name = document.createElement('span'); name.textContent = label; div.append(name);
    if (coins) div.append(amount(coins, 'coin'));
    if (gems) div.append(amount(gems, 'gem'));
    div.style.animationDelay = `${box.children.length * .18}s`; box.append(div);
  };
  for (const item of rewards.items) if (item.coins || item.gems) row(item.label, item.coins, item.gems, item.label.includes('tiburon') ? 'bonus' : '');
  row('Total ganado', rewards.coins, rewards.gems, 'reward-total');
  for (const id of ['walletCoinsWrap', 'walletGems']) { const chip = $(id); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
}
function finish() {
  if (state.won && state.mode === 'ended' && !reducedMotion) {
    state.mode = 'celebrating'; state.treasureTime = 0;
    $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true;
    $('typing').disabled = true;
    $('status').textContent = '¡Otto se hizo tu amigo! El cofre está abriéndose…';
    hint(null); return;
  }
  state.mode = 'results'; $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true; $('typing').disabled = true; $('pauseButton').disabled = true; hint(null);
  const acc = accuracy(state.attempts, state.mistakes);
  const speed = state.elapsed ? Math.round(state.score / (state.elapsed / 60)) : 0;
  $('resultLabel').textContent = state.won ? 'Expedición completa' : 'Hora de subir a la superficie';
  $('resultTitle').textContent = state.won ? '¡Encontraste el tesoro!' : '¡Cada intento te enseña!';
  $('resultMessage').textContent = state.won ? '¡Completaste las ocho frases de Otto y abriste el tesoro del barco hundido!' : `Llegaste a ${state.depth} metros. Recargá el oxígeno y probá otra vez.`;
  $('resultWords').textContent = state.score; $('resultAccuracy').textContent = `${acc}%`; $('resultSpeed').textContent = speed;
  $('resultPoints').textContent = `${state.points} puntos · ${state.bestStreak} palabras seguidas sin errores`;
  const key = recordKey(), old = records[key];
  if (!old || state.points > old.points) {
    records[key] = { points: state.points, depth: state.depth, accuracy: acc };
    try { localStorage.setItem('buzo-records-v4', JSON.stringify(records)); } catch { /* Optional in private browsing. */ }
  }
  if (!state.rewarded) {
    state.rewarded = computeRewards(state); wallet.coins += state.rewarded.coins; wallet.gems += state.rewarded.gems; saveWallet(); void protectStorage();
  }
  const earned = starsFor(state);
  if (earned > (Number(stars[state.level]) || 0)) {
    stars[state.level] = earned;
    try { localStorage.setItem('buzo-stars-v1', JSON.stringify(stars)); } catch { /* Optional in private browsing. */ }
  }
  $('resultStars').hidden = !earned; $('resultStars').textContent = starText(earned);
  $('resultStars').setAttribute('aria-label', `${earned} de 3 estrellas`);
  showRewards(state.rewarded); if (state.rewarded.coins) beep(state.won ? 'prize' : 'win');
  $('oxygenHud').hidden = true;
  const guest = state.coop && isGuest();
  $('againButton').hidden = guest; $('nextButton').hidden = guest || !state.won || state.level >= LEVELS.length - 1;
  $('coopResult').hidden = !state.coop;
  $('coopResult').textContent = `Entre los dos: ${state.score + state.partnerScore} palabras.${guest ? ' Esperando al anfitrión para jugar otra vez…' : ''}`;
  $('results').hidden = false; (guest ? $('homeButton') : $('againButton')).focus(); showRecord();
}
$('typing').addEventListener('input', event => {
  if (event.isComposing) return;
  const result = track(() => typeInRun(state, event.target.value));
  if (result.ignored) return;
  if (result.bossHit && state.coop && coopActive()) room.send({ t: 'hit' });
  if (!seenCoach) {
    seenCoach = true; $('coach').hidden = true;
    try { localStorage.setItem('buzo-seen-v1', '1'); } catch { /* Optional. */ }
  }
  if (result.complete) {
    beep('win');
    const praise = ['¡Genial!', '¡Muy bien!', '¡Así se hace!'][state.score % 3];
    toast(result.bossHit ? `¡Tentáculo calmado! +${result.gained}` : state.streak >= 3 ? `¡Racha de ${state.streak}! +${result.gained}` : `${praise} +${result.gained}`);
    $('status').textContent = result.bossHit ? `¡Bien! +${result.gained} puntos. Quedan ${state.boss.hp} tentáculos por calmar.` : `¡Bien! +${result.gained} puntos. Bajaste a ${state.depth} metros.`;
    if (result.bossStarted) $('status').textContent = '¡Llegaste al naufragio! Otto custodia el tesoro. Encontraste una reserva de oxígeno.';
    $('feedback').textContent = state.relaxed ? '¡Seguí con la próxima palabra!' : 'Palabra completa: +3% de oxígeno.';
  } else if (result.mistakes) {
    beep('miss'); $('feedback').textContent = state.relaxed ? 'Usá Retroceso para corregir. ¡Vos podés!' : `−${result.mistakes * 5}% de oxígeno. Corregí con Retroceso.`;
    $('typing').classList.remove('shake'); void $('typing').offsetWidth; $('typing').classList.add('shake');
  } else {
    $('feedback').textContent = 'Seguí con la tecla iluminada. No hace falta Enter.';
  }
  sync(); if (state.mode === 'ended') finish();
});
$('typing').addEventListener('compositionend', () => $('typing').dispatchEvent(new Event('input')));
$('typing').addEventListener('paste', event => { event.preventDefault(); $('feedback').textContent = 'Escribí con tus dedos, sin pegar palabras.'; });
function pause() {
  if (!['playing', 'diving', 'bossIntro', 'boss', 'celebrating'].includes(state.mode)) return;
  pausedMode = state.mode; state.mode = 'paused';
  $('pauseOverlay').hidden = false; $('typing').disabled = true; $('pauseButton').textContent = 'Seguir'; $('resumeButton').focus();
}
function resume() {
  if (state.mode !== 'paused' || modalOpen()) return;
  state.mode = pausedMode; $('pauseOverlay').hidden = true; $('pauseButton').textContent = 'Pausar';
  sync(); if (['playing', 'boss'].includes(state.mode)) $('typing').focus();
}
function home() {
  state = createRun(Number($('level').value), $('relaxed').checked); state.mode = 'welcome'; emotes.length = 0;
  $('results').hidden = true; $('pauseOverlay').hidden = true; $('welcome').hidden = false; $('targetList').hidden = true;
  $('typing').disabled = true; $('typing').value = ''; $('pauseButton').disabled = true;
  $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true; $('coach').hidden = true; renderLevels();
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
    if (['playing', 'boss'].includes(state.mode)) $('typing').focus();
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
  const card = document.createElement('div'); card.className = `skin-card ${equipped ? 'equipped' : ''}`;
  const preview = document.createElement('canvas'); preview.width = 400; preview.height = 260;
  preview.setAttribute('aria-hidden', 'true');
  const pctx = preview.getContext('2d');
  if (pctx) {
    pctx.fillStyle = '#0a6a7c'; pctx.fillRect(0, 0, 400, 260);
    drawDiver(pctx, 190, 160, 1.15, 0, 0, isSkin ? item.id : wallet.equipped, isSkin ? wallet.gear : { ...wallet.gear, [item.slot]: item.id });
  }
  const title = document.createElement('h3'); title.textContent = item.name;
  const blurb = document.createElement('p'); blurb.textContent = item.blurb;
  const price = document.createElement('div'); price.className = 'skin-price';
  if (owned) price.textContent = equipped ? 'Puesto' : 'Tuyo';
  else if (!item.price.coins && !item.price.gems) price.textContent = 'Gratis';
  else {
    if (item.price.coins) { const part = document.createElement('span'); part.append(amount(item.price.coins, 'coin', '')); price.append(part); }
    if (item.price.gems) { const part = document.createElement('span'); part.append(amount(item.price.gems, 'gem', '')); price.append(part); }
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
    button.textContent = ok ? 'Comprar' : 'Te falta tesoro'; button.disabled = !ok;
    button.setAttribute('aria-label', `${button.textContent}: ${item.name}`);
    button.onclick = () => {
      if (!buySkin(wallet, item.id)) return;
      if (isSkin) equipSkin(wallet, item.id); else equipGear(wallet, item.slot, item.id);
      done(`¡Compraste ${item.name.toLowerCase()} y ya lo tenés puesto!`);
    };
  }
  card.append(preview); card.append(title); card.append(blurb); card.append(price); card.append(button);
  return card;
}
let shopTab = 'skins';
function renderShop() {
  $('shopCoins').textContent = wallet.coins; $('shopGems').textContent = wallet.gems;
  const view = $('shopPreview').getContext('2d');
  if (view) { view.clearRect(0, 0, 400, 260); view.fillStyle = '#0a6a7c'; view.fillRect(0, 0, 400, 260); drawDiver(view, 190, 160, 1.15, 0, 0, wallet.equipped, wallet.gear); }
  $('shopTabs').replaceChildren();
  for (const tab of [{ id: 'skins', title: 'Trajes' }, ...SLOTS.map(slot => ({ id: slot.id, title: slot.title }))]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = tab.title;
    button.className = `shop-tab ${tab.id === shopTab ? 'selected' : ''}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(tab.id === shopTab));
    button.onclick = () => { shopTab = tab.id; renderShop(); };
    $('shopTabs').append(button);
  }
  $('skinGrid').replaceChildren();
  const grid = document.createElement('div'); grid.className = 'skin-grid';
  if (shopTab === 'skins') for (const skin of SKINS) grid.append(shopCard(skin, 'skin'));
  else for (const item of ACCESSORIES.filter(accessory => accessory.slot === shopTab)) grid.append(shopCard(item, 'gear'));
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
function ellipse(x, y, rx, ry, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function path(points, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...points[0]); for (const point of points.slice(1)) ctx.lineTo(...point); ctx.closePath(); ctx.fill(); }
function shark(x, y, scale, word, options = {}) {
  const { side = 'right', fleeing = false, selected = false, labelY = y - 85 } = options;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if ((side === 'left') !== fleeing) ctx.scale(-1, 1);
  path([[45, 0], [100, -37], [87, 0], [100, 34]], '#76bac3');
  path([[-12, -23], [12, -66], [26, -22]], '#8fc8cf');
  ellipse(0, 0, 71, 32, '#91c9d0'); ellipse(-10, 13, 52, 13, '#c9e6e3');
  path([[8, 10], [33, 49], [40, 16]], '#6cabb7');
  ellipse(-44, -8, 5, 5, '#153e50'); ellipse(-45, -9, 1.6, 1.6, '#fff');
  ctx.strokeStyle = '#458492'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-15 + i * 7, -6); ctx.quadraticCurveTo(-21 + i * 7, 3, -15 + i * 7, 10); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(-48, 7, 9, .15, 1.6); ctx.stroke(); ctx.restore();
  if (word && !fleeing) {
    ctx.font = `bold ${width < 500 ? 15 : 20}px Trebuchet MS, Arial`;
    const labelWidth = ctx.measureText(word).width + 26;
    const labelX = Math.max(labelWidth / 2 + 8, Math.min(width - labelWidth / 2 - 8, x));
    ctx.strokeStyle = selected ? '#ffdb70aa' : '#b6e0dc55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(labelX, labelY + 32); ctx.lineTo(x, y - 12); ctx.stroke();
    ctx.fillStyle = selected ? '#ffdb70' : '#edf6f4';
    ctx.beginPath(); ctx.roundRect(labelX - labelWidth / 2, labelY, labelWidth, 34, 8); ctx.fill();
    if (selected) { ctx.strokeStyle = '#fff5c2'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#164b57'; ctx.textAlign = 'center'; ctx.fillText(word, labelX, labelY + 23);
  }
}

function draw() {
  const t = reducedMotion ? 0 : clock;
  const welcome = state.mode === 'welcome';
  const diving = state.mode === 'diving' || state.mode === 'paused' && pausedMode === 'diving';
  const sceneDepth = reducedMotion ? state.depth : state.visualDepth;
  drawOceanBackdrop(ctx, width, height, sceneDepth, t);
  drawOceanForeground(ctx, width, height, sceneDepth, t);
  if (welcome) {
    ctx.fillStyle = '#b7dfdc'; ctx.fillRect(0, 0, width, 110);
    ctx.strokeStyle = '#e3f6ed'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(0, 110); ctx.lineTo(width, 110); ctx.stroke();
    drawBoat(ctx, width * .73, 103, Math.min(.85, width / 750), t);
    drawDiver(ctx, width * .66, height * .53 + Math.sin(t * 1.5) * 4, width < 500 ? .65 : 1.05, t, state.visualDepth, wallet.equipped, wallet.gear);
    shark(width * .85, height * .57, width < 500 ? .45 : .8, 'mar');
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
    $('oxygenHud').style.top = `${Math.max(8, entryY - 82 * scale - 43)}px`;
    ctx.font = 'bold 24px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#f0f7f4';
    ctx.fillText('¡Al agua!', width / 2, height * .85);
    return;
  }
  if (state.boss) {
    const smallScreen = width < 500;
    drawShipwreck(ctx, width * .23, height * (smallScreen ? .71 : .77), Math.min(1, width / 650), t, state.won ? (reducedMotion ? 1 : Math.min(1, (state.treasureTime || 0) / 1.8)) : 0, smallScreen ? { x: 35, y: -45 } : undefined);
    const ottoX = width * .77, ottoY = height * .42, ottoScale = Math.min(1.15, width / 620);
    drawOctopus(ctx, ottoX, ottoY, ottoScale, t, { ...state.boss,
      attackTime: reducedMotion ? 0 : state.boss.attackTime,
      charging: !state.relaxed && (state.mode === 'boss' || state.mode === 'paused' && pausedMode === 'boss') && state.boss.attackIn <= 1.5,
      target: { x: (diverX - ottoX) / ottoScale, y: (diverY - ottoY) / ottoScale }
    });
  }
  const bob = Math.sin(t * 1.5) * 4;
  drawDiver(ctx, diverX, diverY + bob, scale, t, state.visualDepth, wallet.equipped, wallet.gear);
  $('oxygenHud').style.top = `${diverY + bob - 82 * scale - 43}px`;
  if (state.coop) {
    const px = width * .55, py = diverY + Math.sin(t * 1.5 + 2) * 4, mate = partner || { skin: 'clasico', gear: {} };
    drawDiver(ctx, px, py, scale, t, state.visualDepth, mate.skin, mate.gear);
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Trebuchet MS'; ctx.fillStyle = '#e6f5f4';
    ctx.fillText('Tu compañero', px, py + 100 * scale);
    for (const emote of emotes) {
      ctx.globalAlpha = Math.max(0, 1 - emote.time / 2); ctx.font = '30px Trebuchet MS';
      ctx.fillText(emote.text, emote.who === 'me' ? diverX : px, py - 130 * scale - (reducedMotion ? 0 : emote.time * 30));
    }
    ctx.globalAlpha = 1;
  }
  const laneY = [.23, .42, .63, .83];
  for (const enemy of state.sharks) {
    const startX = width * (enemy.side === 'left' ? .1 : .9);
    const endX = width * (enemy.side === 'left' ? diverFrac - .06 : diverFrac + .06);
    let x = startX + (endX - startX) * enemy.progress;
    let y = height * laneY[enemy.lane] + (diverY - height * laneY[enemy.lane]) * enemy.progress;
    const fleeing = Boolean(enemy.departure);
    if (fleeing) {
      const exit = reducedMotion ? 1 : enemy.exitTime / .8;
      x += (enemy.side === 'left' ? -1 : 1) * exit * width * .5;
    }
    shark(x, y + Math.sin(t + enemy.id) * 3, width < 500 ? .4 : .75, enemy.word, {
      side: enemy.side, fleeing, selected: enemy.id === state.targetId,
      labelY: Math.min(height * .63, height * laneY[enemy.lane] - (width < 500 ? 43 : 58))
    });
  }
  if (!state.relaxed && state.oxygen <= 30) {
    ctx.strokeStyle = '#ef8f83'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, width - 4, height - 4);
  }
  ctx.textAlign = 'center'; ctx.font = '12px Trebuchet MS'; ctx.fillStyle = '#bfe2df';
  if (!state.boss) ctx.fillText(`Oleada ${state.wave} · Naufragio a 240 m`, width / 2, 24);
  for (const effect of state.effects) {
    ctx.globalAlpha = Math.max(0, 1 - effect.time / 1.2);
    ctx.font = 'bold 23px Trebuchet MS'; ctx.fillStyle = effect.kind === 'win' ? '#ffdb70' : '#ffa99b';
    ctx.fillText(effect.text, diverX, diverY - 132 - (reducedMotion ? 0 : effect.time * 28));
    ctx.globalAlpha = 1;
  }

}
function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now;
  if (!document.hidden && ['welcome', 'diving', 'playing', 'bossIntro', 'boss', 'celebrating'].includes(state.mode)) clock += dt;
  if (!document.hidden && state.mode === 'celebrating') {
    state.treasureTime += dt;
    if (state.treasureTime >= 3) finish();
  }
  const targetBefore = state.targetId;
  for (const emote of emotes) emote.time += dt;
  while (emotes.length && emotes[0].time >= 2) emotes.shift();
  if (!document.hidden && coopActive() && room.role === 'host' && state.coop && !state.relaxed && ['playing', 'boss'].includes(state.mode) && (syncClock += dt) >= 1) {
    syncClock = 0; room.send({ t: 'sync', o: state.oxygen });
  }
  const events = document.hidden ? [] : track(() => tickRun(state, dt));
  if (events.length || targetBefore !== state.targetId) {
    sync();
    if (events.includes('bossReady')) {
      toast('¡Batalla final contra Otto!');
      $('status').textContent = '¡Batalla final! Escribí ocho frases con su espacio. ¡El reloj no se frena!';
      $('feedback').textContent = 'Dos palabras y un espacio calman un tentáculo.'; $('typing').focus();
    }
    if (events.includes('bossAttack')) {
      beep('miss'); toast(`¡Otto atacó! −${bossAttackDamage(state)}% O₂`, 'miss'); $('status').textContent = `¡Otto agitó sus tentáculos! −${bossAttackDamage(state)}% de oxígeno.`;
      $('feedback').textContent = 'Tu frase sigue intacta. ¡Seguí escribiendo!';
    }
    if (events.includes('ready')) {
      if (!seenCoach) $('coach').hidden = false;
      $('status').textContent = 'Elegí un tiburón escribiendo la primera letra de su palabra.';
      $('typing').focus();
    }
    if (events.includes('collision')) {
      beep('shark'); toast('¡Un tiburón llegó! −22% O₂', 'miss'); $('status').textContent = '¡Un tiburón llegó! −22% de oxígeno. Seguí escribiendo.';
    }
  }
  if (state.boss) updateBossHud();
  if (state.mode === 'ended') { hud(); finish(); }
  draw(); requestAnimationFrame(frame);
}
resize(); saveWallet(); showSound(); renderLobby(); showRecord(); hud(); requestAnimationFrame(frame);
