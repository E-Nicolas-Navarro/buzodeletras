import test from 'node:test';
import assert from 'node:assert/strict';

// A dependency-free DOM/canvas harness checks the real UI controller. It is not
// a substitute for browser layout/accessibility testing.
class Element {
  constructor(id = '') {
    this.id = id; this.children = []; this.listeners = {}; this.dataset = {};
    this.hidden = false; this.disabled = false; this.value = ''; this.checked = false;
    this.classes = new Set(); this.attributes = {}; this.style = {};
    this.classList = { toggle: (key, enabled) => enabled ? this.classes.add(key) : this.classes.delete(key), remove: key => this.classes.delete(key), add: key => this.classes.add(key) };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.children.length ? this.children.map(child => child.textContent).join('') : this.text || ''; }
  set innerHTML(value) { this.textContent = value; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; this.text = ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatchEvent(event) { for (const callback of this.listeners[event.type] || []) callback({ target: this, ...event }); }
  focus() { focused = this.id; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  getBoundingClientRect() { return { width: 1100, height: 480 }; }
  getContext() { return new Proxy({}, { get: (_, name) => name === 'createLinearGradient' ? () => ({ addColorStop() {} }) : name === 'measureText' ? value => ({ width: value.length * 12 }) : () => {} }); }
}
let focused = '';
for (const reducedMotion of [false, true]) test(`UI: full expedition, victory reveal, pause and restart (reduced motion: ${reducedMotion})`, async () => {
  const ids = ['scene', 'level', 'relaxed', 'record', 'keyboard', 'fingerHint', 'wordDisplay', 'depth', 'score', 'air', 'typing', 'status', 'feedback', 'welcome', 'results', 'pauseOverlay', 'pauseButton', 'resultLabel', 'resultTitle', 'resultMessage', 'resultWords', 'resultAccuracy', 'resultSpeed', 'againButton', 'resumeButton', 'startButton', 'homeButton', 'exitButton', 'soundButton', 'guideButton', 'handGuide', 'helpButton', 'help', 'closeHelp', 'helpReady', 'nextButton', 'targetList', 'points', 'oxygenFill', 'resultPoints', 'diverConsole', 'bossHud', 'bossBanner', 'scoreLabel', 'bossHp', 'bossHealth', 'bossHealthFill', 'bossAttackHint', 'oxygenHud', 'oxygenMeter', 'walletCoins', 'walletGems', 'shopButton', 'resultShopButton', 'shop', 'closeShop', 'skinGrid', 'shopCoins', 'shopGems', 'shopMessage', 'rewards', 'toast', 'coach', 'levelCards', 'resultStars', 'shopPreview', 'shopTabs', 'walletCoinsWrap', 'coopButton', 'coopBanner', 'coopText', 'leaveRoom', 'earn', 'coop', 'closeCoop', 'coopMenu', 'hostButton', 'codeInput', 'joinButton', 'coopWait', 'roomCode', 'cancelRoom', 'coopMessage', 'partnerHud', 'partnerText', 'emoteBar', 'coopResult', 'progressButton', 'progress', 'closeProgress', 'backupCode', 'copyBackup', 'downloadBackup', 'restoreInput', 'restoreFile', 'checkRestore', 'confirmRestore', 'progressMessage', 'progressStatus', 'storageStatus'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const label = new Element(); elements.level.value = '0'; elements.relaxed.checked = true;
  const document = new Element();
  document.getElementById = id => elements[id]; document.createElement = () => new Element();
  document.querySelector = () => label;
  document.querySelectorAll = () => elements.keyboard.children.flatMap(row => row.children);
  let nextFrame, timerId = 0, time = 0; const timers = new Map(), store = {};
  const saved = Object.fromEntries(['document', 'window', 'matchMedia', 'localStorage', 'ResizeObserver', 'requestAnimationFrame', 'devicePixelRatio', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, {
    document, window: new Element(), matchMedia: () => ({ matches: reducedMotion }),
    localStorage: { getItem: key => store[key], setItem: (key, value) => { store[key] = value; } },
    ResizeObserver: class { observe() {} }, devicePixelRatio: 1,
    requestAnimationFrame: fn => { nextFrame = fn; },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  const flush = () => { const callbacks = [...timers.values()]; timers.clear(); for (const callback of callbacks) callback(); };
  const type = value => { elements.typing.value = value; elements.typing.dispatchEvent({ type: 'input' }); };
  const complete = () => { const word = elements.wordDisplay.textContent; for (let i = 1; i <= word.length; i++) type(word.slice(0, i)); };
  const advance = seconds => { for (let i = 0; i < seconds * 10 + 1; i++) { time += 100; nextFrame(time); } };
  try {
    await import(`../game.js?reducedMotion=${reducedMotion}`);
    assert.equal(elements.keyboard.children.length, 4);
    elements.startButton.onclick();
    assert.equal(elements.typing.disabled, true); assert.equal(elements.wordDisplay.textContent, '¡Al agua!');
    // Help freezes the dive, not just the game after entry.
    elements.helpButton.onclick(); advance(5);
    assert.equal(elements.typing.disabled, true); assert.equal(elements.pauseOverlay.hidden, false);
    elements.helpReady.onclick(); elements.resumeButton.onclick(); advance(2);
    assert.equal(elements.wordDisplay.textContent, 'fff'); assert.equal(focused, 'typing');
    assert.equal(elements.diverConsole.hidden, false);
    assert.equal(elements.oxygenHud.hidden, false);
    assert.ok(parseFloat(elements.oxygenHud.style.top) < 200);
    assert.equal(elements.oxygenMeter.attributes['aria-valuenow'], '100');
    type('x'); assert.match(elements.feedback.textContent, /Retroceso/); type('');
    complete(); advance(.1); assert.equal(elements.score.textContent, '1 / 24');
    assert.equal(elements.wordDisplay.textContent, 'jjj');
    document.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
    advance(40); assert.equal(elements.score.textContent, '1 / 24');
    elements.resumeButton.onclick();
    elements.typing.dispatchEvent({ type: 'paste', preventDefault() {} });
    assert.match(elements.feedback.textContent, /sin pegar/);
    for (let i = 0; i < 11; i++) { complete(); advance(.1); }
    advance(15); assert.equal(elements.targetList.children.length, 4);
    const other = elements.targetList.children[1]; other.onclick();
    assert.equal(elements.wordDisplay.textContent, other.textContent.slice(2));
    for (let i = 0; i < 12; i++) { complete(); advance(.1); }
    assert.equal(elements.results.hidden, true); assert.equal(elements.bossBanner.hidden, false);
    assert.equal(elements.diverConsole.hidden, true); assert.equal(elements.bossHud.hidden, false);
    advance(2); assert.equal(elements.bossBanner.hidden, true); assert.equal(elements.typing.disabled, false);
    assert.equal(elements.diverConsole.hidden, false); assert.equal(elements.targetList.hidden, true);
    elements.pauseButton.onclick(); advance(30); assert.equal(elements.bossHp.textContent, '8 / 8');
    elements.resumeButton.onclick();
    for (let i = 0; i < 8; i++) { complete(); advance(.1); }
    if (!reducedMotion) {
      assert.equal(elements.results.hidden, true); assert.equal(elements.typing.disabled, true);
      assert.equal(elements.diverConsole.hidden, true); assert.equal(elements.bossHud.hidden, true);
      assert.match(elements.status.textContent, /cofre/);
      // The reveal freezes while paused, even after more than its full duration.
      elements.pauseButton.onclick(); advance(10);
      assert.equal(elements.results.hidden, true);
      elements.resumeButton.onclick(); advance(1);
      assert.equal(elements.results.hidden, true);
      advance(3);
    }
    assert.equal(elements.results.hidden, false); assert.equal(elements.resultWords.textContent, '32');
    assert.equal(elements.bossHealth.attributes['aria-valuenow'], '0');
    assert.equal(elements.depth.textContent, '240 m');
    assert.notEqual(elements.resultAccuracy.textContent, '100%');
    assert.ok(store['buzo-records-v4']); assert.equal(elements.nextButton.hidden, false);
    elements.nextButton.onclick(); advance(2);
    assert.equal(elements.level.value, '1'); assert.equal(elements.results.hidden, true);
    elements.pauseButton.onclick(); elements.exitButton.onclick();
    assert.equal(elements.welcome.hidden, false); assert.equal(elements.typing.disabled, true);
    elements.relaxed.checked = false; elements.startButton.onclick(); advance(2);
    for (let i = 0; i < 20; i++) type(i % 2 ? '@' : '#');
    assert.equal(elements.results.hidden, false); assert.equal(elements.resultWords.textContent, '0');
    assert.equal(elements.oxygenHud.hidden, true);
    assert.equal(elements.oxygenMeter.attributes['aria-valuenow'], '0');
    assert.equal(elements.air.textContent, '0%'); assert.match(elements.resultTitle.textContent, /intento/);
    // A new practice mission works even if localStorage refuses writes.
    elements.homeButton.onclick(); elements.relaxed.checked = true;
    globalThis.localStorage.setItem = () => { throw new Error('Storage denied'); };
    elements.startButton.onclick(); advance(2);
    for (let i = 0; i < 24; i++) { complete(); advance(.1); }
    advance(2); for (let i = 0; i < 8; i++) { complete(); advance(.1); }
    if (!reducedMotion) advance(3);
    assert.equal(elements.results.hidden, false);

  } finally {
    Object.assign(globalThis, saved);
  }
});
