import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { drawBoat, drawBoatShadow, drawDiver, drawOceanBackdrop, drawOceanForeground, REEF_LAYERS, layerOffset, drawShipwreck, drawOctopus, drawTreasure, drawLoot, drawBoss, drawLetterFish } from '../visuals.js';

function recordingContext() {
  const initial = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter' };
  let properties = { ...initial };
  const stack = [], calls = [];
  const ctx = new Proxy({}, {
    set(_, key, value) {
      if (key === 'globalAlpha') assert.ok(value >= 0 && value <= 1);
      properties[key] = value; return true;
    },
    get(_, key) {
      if (key in properties) return properties[key];
      if (key === 'save') return () => { stack.push({ ...properties }); calls.push(['save']); };
      if (key === 'restore') return () => { assert.ok(stack.length); properties = stack.pop(); calls.push(['restore']); };
      if (key === 'createLinearGradient') return (...coords) => {
        assert.ok(coords.every(Number.isFinite));
        const gradient = { coords, stops: [], addColorStop(at, color) { assert.ok(at >= 0 && at <= 1); this.stops.push([at, color]); } };
        return gradient;
      };
      return (...args) => {
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value));
        if (key === 'arc') assert.ok(args[2] >= 0);
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        calls.push([key, ...args]);
      };
    }
  });
  return { ctx, calls, assertBalanced: () => assert.equal(stack.length, 0), properties: () => properties, initial };
}

test('boat and diver keep canvas styles isolated and generate valid paths', () => {
  const recording = recordingContext();
  drawBoat(recording.ctx, 600, 110, .85, 4);
  drawDiver(recording.ctx, 550, 255, .9, 4, 160);
  recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  assert.ok(recording.calls.some(call => call[0] === 'bezierCurveTo'));
  assert.ok(recording.calls.some(call => call[0] === 'roundRect'));
});
test('ocean layers support small screens, maximum depth and bounded drawing work', () => {
  for (const width of [320, 1100]) for (const depth of [0, 120, 240]) {
    const recording = recordingContext();
    drawOceanBackdrop(recording.ctx, width, 480, depth, 8);
    drawOceanForeground(recording.ctx, width, 480, depth, 8);
    recording.assertBalanced(); assert.equal(recording.properties().globalAlpha, 1);
    assert.ok(recording.calls.length < 3000, 'Bound work per frame without generating new background entities');
  }
});
test('near scenery has stronger parallax and frozen time reproduces the same frame', () => {
  assert.ok(REEF_LAYERS.every((layer, i) => i === 0 || layer.z > REEF_LAYERS[i - 1].z));
  assert.ok(layerOffset(120, REEF_LAYERS[2]) > layerOffset(120, REEF_LAYERS[0]));
  const first = recordingContext(), second = recordingContext();
  drawOceanBackdrop(first.ctx, 1100, 480, 80, 0);
  drawOceanBackdrop(second.ctx, 1100, 480, 80, 0);
  assert.deepEqual(first.calls, second.calls);
});
test('local server and static build include every module the game imports', async () => {
  const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const build = await read('build.mjs'), server = await read('server.mjs');
  // Follow the imports from game.js: a module missing from either list breaks the page.
  const seen = new Set(), queue = ['game.js'];
  while (queue.length) {
    const file = queue.pop(); if (seen.has(file)) continue; seen.add(file);
    for (const [, dep] of (await read(file)).matchAll(/from '\.\/([\w-]+\.js)'/g)) queue.push(dep);
  }
  assert.ok(seen.has('visuals.js') && seen.has('album.js'));
  for (const file of seen) { assert.match(build, new RegExp(`'${file}'`), `build: ${file}`); assert.match(server, new RegExp(`'${file}'`), `server: ${file}`); }
});

test('wreck, treasure and octopus draw safely in active and peaceful victory states', () => {
  for (const width of [320, 1100]) for (const hp of [8, 4, 0]) {
    const recording = recordingContext();
    drawShipwreck(recording.ctx, width * .23, 370, Math.min(1, width / 650), 4, hp === 0);
    drawOctopus(recording.ctx, width * .75, 153, Math.min(1.1, width / 530), 4, { hp, maxHp: 8, defeated: hp === 0, hitTime: hp === 4 ? .2 : 0, attackTime: .2 });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
});
test('typing controls live in the game console with an accessible label', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const shell = html.indexOf('class="game-shell"');
  const input = html.indexOf('id="typing"');
  const shellEnd = html.indexOf('</section>', shell);
  assert.ok(shell < input && input < shellEnd);
  assert.match(html, /aria-describedby="fingerHint feedback"/);
  assert.equal((html.match(/id="typing"/g) || []).length, 1);
  assert.equal((html.match(/id="wordDisplay"/g) || []).length, 1);
});


test('treasure opening progresses smoothly, clamps endpoints and restores styles', () => {
  const frames = [0, .25, .5, .75, 1].map(progress => {
    const recording = recordingContext();
    drawTreasure(recording.ctx, 150, 250, .8, progress);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
    return recording.calls;
  });
  for (let i = 1; i < frames.length; i++) assert.notDeepEqual(frames[i], frames[i - 1]);
  for (const [input, endpoint] of [[false, 0], [true, 1], [-2, 0], [3, 1]]) {
    const recording = recordingContext(); drawTreasure(recording.ctx, 150, 250, .8, input);
    assert.deepEqual(recording.calls, frames[endpoint ? 4 : 0]);
  }
});


test('Otto has distinct anticipation, strike and calm poses with isolated canvas state', () => {
  const poses = [{ hp: 8 }, { hp: 8, charging: true }, { hp: 8, attackTime: .3 }, { hp: 0, defeated: true }];
  const frames = poses.map(boss => {
    const recording = recordingContext();
    drawOctopus(recording.ctx, 270, 200, .6, 0, { ...boss, target: { x: -180, y: 60 } });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
    assert.ok(recording.calls.length < 1500);
    return recording.calls;
  });
  for (let i = 1; i < frames.length; i++) assert.notDeepEqual(frames[i], frames[0]);
});
test('oxygen is attached to the ocean, outside the expedition HUD, with an accessible meter', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="oxygenHud"') > html.indexOf('id="ocean"'));
  assert.ok(html.indexOf('id="oxygenHud"') < html.indexOf('id="welcome"'));
  assert.match(html, /id="oxygenMeter"[^>]*role="progressbar"/);
  assert.equal((html.match(/id="air"/g) || []).length, 1);
});

import { drawCreature, drawPet, diverTop } from '../visuals.js';
import { SKINS, ACCESSORIES, SLOTS } from '../skins.js';
import { eventOn, currentEvent, eventWords } from '../events.js';
test('every skin, accessory and pose draws with balanced canvas state', () => {
  const poses = [{}, { cheer: .5, flip: true }, { hurt: 1 }, { type: 1, worried: true, look: -1 }, { cheer: .3 }];
  for (const skin of SKINS) for (const pose of poses) {
    const recording = recordingContext();
    drawDiver(recording.ctx, 200, 160, 1, 2.3, 100, skin.id, {}, pose);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
  for (const item of ACCESSORIES) for (const skin of ['clasico', 'sirena', 'tiburon']) {
    const recording = recordingContext();
    drawDiver(recording.ctx, 200, 160, 1, 1.7, 0, skin, { [item.slot]: item.id }, { cheer: .4 });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
    assert.ok(recording.calls.length < 2500);
  }
  assert.ok(SLOTS.every(slot => ACCESSORIES.some(item => item.slot === slot.id)));
});
test('the oxygen meter clears tall hats: diverTop grows with what the diver wears', () => {
  const bare = diverTop('clasico', {});
  for (const hat of ACCESSORIES.filter(item => item.slot === 'head')) assert.ok(diverTop('clasico', { head: hat.id }) < bare - 15, hat.id);
  assert.ok(diverTop('dorado', {}) < bare); assert.ok(diverTop('clasico', { hand: 'tridente' }) < bare);
  assert.equal(diverTop('clasico', { mask: 'mascara-sol' }), bare);
  assert.ok(diverTop('clasico', { hand: 'globo' }) < bare - 40);
});
test('creatures and pets draw in every state, including the Halloween costume', () => {
  for (const kind of ['shark', 'golden', 'hammer', 'puffer', 'whale', 'unknown']) for (const options of [{}, { flip: true, progress: .8 }, { fleeing: true, time: 3 }, { flinch: .2, costume: 'halloween', id: 2 }, { costume: 'halloween', id: 3 }]) {
    const recording = recordingContext();
    drawCreature(recording.ctx, kind, 300, 200, .75, options);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
  for (const pet of ACCESSORIES.filter(item => item.slot === 'pet')) {
    const recording = recordingContext(); drawPet(recording.ctx, pet.id, 50, 50, 2);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
  const recording = recordingContext();
  drawOceanBackdrop(recording.ctx, 1100, 480, 120, 4, 'halloween');
  drawOctopus(recording.ctx, 800, 200, 1, 2, { hp: 6, maxHp: 8, theme: 'halloween' });
  recording.assertBalanced(); assert.ok(recording.calls.length < 4000);
});
test('seasons follow the calendar and can be previewed or turned off', () => {
  assert.equal(eventOn(new Date(2026, 9, 31)).id, 'halloween');
  assert.equal(eventOn(new Date(2026, 9, 15)).id, 'halloween'); assert.equal(eventOn(new Date(2026, 10, 5)).id, 'halloween');
  assert.equal(eventOn(new Date(2026, 10, 6)), null); assert.equal(eventOn(new Date(2026, 6, 1)), null);
  assert.equal(currentEvent('?evento=halloween', new Date(2026, 6, 1)).id, 'halloween');
  assert.equal(currentEvent('?evento=no', new Date(2026, 9, 31)), null);
  const halloween = eventOn(new Date(2026, 9, 31));
  assert.deepEqual(eventWords(halloween, null), []); assert.ok(eventWords(halloween, 1).includes('fantasma')); assert.ok(eventWords(halloween, 0).includes('bruja'));
});

import { fingerId, plainKey, createHands, stepHands, drawHands, HOME } from '../hands.js';
test('ghost hands: each letter maps to its finger and only that finger reaches out', () => {
  assert.equal(fingerId('f'), 'L2'); assert.equal(fingerId('c'), 'L3'); assert.equal(fingerId('p'), 'R5');
  assert.equal(fingerId('ñ'), 'R5'); assert.equal(fingerId('í'), 'R3'); assert.equal(fingerId(' '), 'thumbs'); assert.equal(fingerId(null), null);
  assert.equal(plainKey('é'), 'e'); assert.equal(plainKey('ñ'), 'ñ');
  const keys = {};
  ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'].forEach((row, r) => [...row].forEach((char, i) => { keys[char] = { x: 30 + i * 50 + r * 15, y: 30 + r * 46, w: 44, h: 36 }; }));
  keys[' '] = { x: 260, y: 170, w: 250, h: 28 };
  const layout = { keys }, hands = createHands();
  stepHands(hands, layout, null, 0, true);
  for (const [id, home] of Object.entries(HOME)) assert.deepEqual(hands.tips[id], { x: keys[home].x, y: keys[home].y });
  stepHands(hands, layout, 'c', 1, true);
  assert.deepEqual(hands.tips.L3, { x: keys.c.x, y: keys.c.y }); assert.deepEqual(hands.tips.L2, { x: keys.f.x, y: keys.f.y });
  assert.equal(hands.active, 'L3'); assert.ok(hands.color);
  for (const char of ['c', ' ', null]) {
    stepHands(hands, layout, char, .016);
    const recording = recordingContext();
    drawHands(recording.ctx, hands, layout, 600, 260, 1);
    recording.assertBalanced(); assert.equal(recording.properties().globalAlpha, 1);
  }
  const empty = recordingContext(); drawHands(empty.ctx, createHands(), { keys: {} }, 600, 260); empty.assertBalanced();
});
test('frenzy treasure and the boat overhead draw with balanced canvas state', () => {
  for (const kind of ['coin', 'gem']) for (const options of [{}, { time: 2.2, id: 4, flinch: .2 }, { caught: .5, time: 1 }, { caught: 1 }]) {
    const recording = recordingContext();
    drawLoot(recording.ctx, kind, 300, 200, .75, options);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
  for (const time of [0, 3.7]) {
    const recording = recordingContext();
    drawBoatShadow(recording.ctx, 400, 20, .9, time);
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
});
test('every world boss draws in every pose with balanced canvas state', () => {
  const poses = [{ hp: 8 }, { hp: 8, charging: true }, { hp: 6, attackTime: .3 }, { hp: 3, hitTime: .2 }, { hp: 0, defeated: true }, { hp: 8, theme: 'halloween' }];
  for (const kind of ['otto', 'pinza', 'medusa', 'unknown']) for (const boss of poses) {
    const recording = recordingContext();
    drawBoss(recording.ctx, kind, 600, 200, .9, 1.4, { maxHp: 8, ...boss, target: { x: -260, y: 80 } });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
    assert.ok(recording.calls.length < 4000);
  }
});
test('album fish draw rescued and locked with balanced canvas state', () => {
  for (const locked of [false, true]) for (let seed = 0; seed < 4; seed++) {
    const recording = recordingContext();
    drawLetterFish(recording.ctx, 60, 40, 1, { color: '#8fe6c4', seed, time: 1.3, locked });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
});
