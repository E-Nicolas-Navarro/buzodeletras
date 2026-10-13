import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { drawBoat, drawDiver, drawOceanBackdrop, drawOceanForeground, REEF_LAYERS, layerOffset, drawShipwreck, drawOctopus } from '../visuals.js';

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
test('local server and static build both include the illustration module', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const game = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  assert.match(build, /'visuals\.js'/); assert.match(server, /'visuals\.js'/);
  assert.match(game, /from '\.\/visuals\.js'/);
});

test('wreck, treasure and octopus draw safely in active and peaceful victory states', () => {
  for (const width of [320, 1100]) for (const hp of [8, 4, 0]) {
    const recording = recordingContext();
    drawShipwreck(recording.ctx, width * .23, 370, Math.min(1, width / 650), 4, hp === 0);
    drawOctopus(recording.ctx, width * .75, 153, Math.min(1.1, width / 530), 4, { hp, maxHp: 8, defeated: hp === 0, hitTime: hp === 4 ? .2 : 0, attackTime: .2 });
    recording.assertBalanced(); assert.deepEqual(recording.properties(), recording.initial);
  }
});
test('typing controls are nested inside the ocean with an accessible label, not below it', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const oceanStart = html.indexOf('id="ocean"');
  const input = html.indexOf('id="typing"');
  const welcome = html.indexOf('id="welcome"');
  assert.ok(oceanStart < input && input < welcome);
  assert.match(html, /aria-describedby="fingerHint feedback"/);
  assert.equal((html.match(/id="typing"/g) || []).length, 1);
  assert.equal((html.match(/id="wordDisplay"/g) || []).length, 1);
});
