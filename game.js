import { drawBoat, drawDiver, drawOceanBackdrop, drawOceanForeground, drawShipwreck, drawOctopus } from './visuals.js';
import { LEVELS, MISSION_WORDS, BOSS_HITS, currentWord, fingerFor, accuracy, computeRewards, createRun, activeSharks, chooseTarget, typeInRun, tickRun } from './engine.js';
import { SKINS, SLOTS, ACCESSORIES, sanitizeWallet, canAfford, buySkin, equipSkin, equipGear } from './skins.js';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createRun(0); state.mode = 'welcome';
let sound = false, audio, last = 0, clock = 0, width = 1000, height = 480;
let pausedMode = 'playing', targetSignature = '';
let records = {};
try {
  const stored = JSON.parse(localStorage.getItem('buzo-records-v4') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) records = stored;
} catch { /* Persistence is optional. */ }
let wallet = sanitizeWallet(null);
try { wallet = sanitizeWallet(JSON.parse(localStorage.getItem('buzo-wallet-v1') || 'null')); } catch { /* Persistence is optional. */ }
function saveWallet() {
  try { localStorage.setItem('buzo-wallet-v1', JSON.stringify(wallet)); } catch { /* Optional in private browsing. */ }
  $('walletCoins').textContent = wallet.coins; $('walletGems').textContent = wallet.gems;
}
const modalOpen = () => $('help').open || $('shop').open;
function recordKey() { return `${state.level}-${state.relaxed ? 'practice' : 'challenge'}`; }
function showRecord() {
  const key = `${$('level').value}-${$('relaxed').checked ? 'practice' : 'challenge'}`;
  const best = records[key];
  $('record').textContent = best ? `Tu récord: ${best.points} puntos · ${best.depth} m de profundidad` : 'Tu primera expedición te espera.';
}
function beep(kind) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.connect(gain); gain.connect(audio.destination); osc.type = 'sine';
    osc.frequency.setValueAtTime(kind === 'win' ? 520 : 240, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(kind === 'win' ? 880 : 180, audio.currentTime + .15);
    gain.gain.setValueAtTime(.06, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .2);
    osc.start(); osc.stop(audio.currentTime + .22);
  } catch { /* Audio is optional. */ }
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
  $('scoreLabel').textContent = state.boss ? 'Pulpo' : 'Palabras';
  $('score').textContent = state.boss ? `${BOSS_HITS - state.boss.hp} / ${BOSS_HITS}` : `${state.score} / ${MISSION_WORDS}`;
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
}
function start() {
  state = createRun(Number($('level').value), $('relaxed').checked);
  if (reducedMotion) state.diveTime = 1.5;
  $('welcome').hidden = true; $('results').hidden = true; $('pauseOverlay').hidden = true; $('targetList').hidden = false;
  $('pauseButton').disabled = false; $('pauseButton').textContent = 'Pausar';
  $('status').textContent = '¡Saltamos! Prepará los dedos en F y J.';
  $('feedback').textContent = 'Escribí para sumar. Cuidá tu oxígeno.';
  targetSignature = 'reset'; sync();
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
    box.append(div);
  };
  for (const item of rewards.items) if (item.coins || item.gems) row(item.label, item.coins, item.gems, item.label.includes('tiburon') ? 'bonus' : '');
  row('Total ganado', rewards.coins, rewards.gems, 'reward-total');
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
    state.rewarded = computeRewards(state); wallet.coins += state.rewarded.coins; wallet.gems += state.rewarded.gems; saveWallet();
  }
  showRewards(state.rewarded);
  $('oxygenHud').hidden = true;
  $('nextButton').hidden = !state.won || state.level >= LEVELS.length - 1;
  $('results').hidden = false; $('againButton').focus(); showRecord();
}
$('typing').addEventListener('input', event => {
  if (event.isComposing) return;
  const result = typeInRun(state, event.target.value);
  if (result.ignored) return;
  if (result.complete) {
    beep('win');
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
  state = createRun(Number($('level').value), $('relaxed').checked); state.mode = 'welcome';
  $('results').hidden = true; $('pauseOverlay').hidden = true; $('welcome').hidden = false; $('targetList').hidden = true;
  $('typing').disabled = true; $('typing').value = ''; $('pauseButton').disabled = true;
  $('diverConsole').hidden = true; $('bossHud').hidden = true; $('bossBanner').hidden = true;
  $('status').textContent = '¿Listo para una nueva inmersión?'; $('wordDisplay').textContent = 'f j f j';
  $('feedback').textContent = 'Escribí para sumar. Cuidá tu oxígeno.'; hud(); hint(null); showRecord(); $('startButton').focus();
}
$('nextButton').onclick = () => { $('level').value = String(state.level + 1); start(); };
$('startButton').onclick = start; $('againButton').onclick = start; $('homeButton').onclick = home; $('exitButton').onclick = home;
$('pauseButton').onclick = () => state.mode === 'paused' ? resume() : pause(); $('resumeButton').onclick = resume;
$('level').onchange = showRecord; $('relaxed').onchange = showRecord;
$('soundButton').onclick = () => { sound = !sound; $('soundButton').textContent = `Sonido: ${sound ? 'sí' : 'no'}`; $('soundButton').setAttribute('aria-pressed', String(sound)); if (sound) beep('win'); };
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
function renderShop() {
  $('shopCoins').textContent = wallet.coins; $('shopGems').textContent = wallet.gems;
  $('skinGrid').replaceChildren();
  const section = (heading, items, kind) => {
    const title = document.createElement('h3'); title.className = 'shop-section'; title.textContent = heading; $('skinGrid').append(title);
    const grid = document.createElement('div'); grid.className = 'skin-grid';
    for (const item of items) grid.append(shopCard(item, kind));
    $('skinGrid').append(grid);
  };
  section('Trajes', SKINS, 'skin');
  for (const slot of SLOTS) section(slot.title, ACCESSORIES.filter(item => item.slot === slot.id), 'gear');
}
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
  const diverX = width * .5, diverY = height * .53;
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
  const laneY = [.23, .42, .63, .83];
  for (const enemy of state.sharks) {
    const startX = width * (enemy.side === 'left' ? .1 : .9);
    const endX = width * (enemy.side === 'left' ? .44 : .56);
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
  const events = document.hidden ? [] : tickRun(state, dt);
  if (events.length || targetBefore !== state.targetId) {
    sync();
    if (events.includes('bossReady')) {
      $('status').textContent = '¡Batalla final! Escribí ocho frases con su espacio. ¡El reloj no se frena!';
      $('feedback').textContent = 'Dos palabras y un espacio calman un tentáculo.'; $('typing').focus();
    }
    if (events.includes('bossAttack')) {
      beep('miss'); $('status').textContent = '¡Otto agitó sus tentáculos! −18% de oxígeno.';
      $('feedback').textContent = 'Tu frase sigue intacta. ¡Seguí escribiendo!';
    }
    if (events.includes('ready')) {
      $('status').textContent = 'Elegí un tiburón escribiendo la primera letra de su palabra.';
      $('typing').focus();
    }
    if (events.includes('collision')) {
      beep('miss'); $('status').textContent = '¡Un tiburón llegó! −22% de oxígeno. Seguí escribiendo.';
    }
  }
  if (state.boss) updateBossHud();
  if (state.mode === 'ended') { hud(); finish(); }
  draw(); requestAnimationFrame(frame);
}
resize(); saveWallet(); showRecord(); hud(); requestAnimationFrame(frame);
