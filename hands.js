// Ghost hands over the reference keyboard: every finger rests on its home key and
// the one that should press the next letter lights up and reaches for it.
import { fingerFor } from './engine.js';

export const FINGERS = ['L5', 'L4', 'L3', 'L2', 'R2', 'R3', 'R4', 'R5'];
export const HOME = { L5: 'a', L4: 's', L3: 'd', L2: 'f', R2: 'j', R3: 'k', R4: 'l', R5: 'ñ' };
const BY_NAME = {
  'meñique izquierdo': 'L5', 'anular izquierdo': 'L4', 'medio izquierdo': 'L3', 'índice izquierdo': 'L2',
  'índice derecho': 'R2', 'medio derecho': 'R3', 'anular derecho': 'R4', 'meñique derecho': 'R5'
};
export const COLORS = { pink: '#f0a8d0', orange: '#ffb98a', yellow: '#ffdb70', mint: '#8fe6c4', blue: '#a8d4f0' };
// The key a character lives on: accents ride on their vowel, Ñ keeps its own key.
export const plainKey = char => !char ? null : char === 'ñ' ? 'ñ' : char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Which finger presses a character: one of FINGERS, 'thumbs' for space, or null.
export function fingerId(char) {
  if (!char) return null;
  const finger = fingerFor(char);
  return finger.name === 'pulgar' ? 'thumbs' : BY_NAME[finger.name] || null;
}

export function createHands() { return { tips: {}, thumbs: {} }; }
// layout: { keys: { [char]: { x, y, w, h } } } in canvas pixels; `char` is the next letter or null.
// Tips glide toward their goal; `snap` jumps straight there (reduced motion, first frame).
export function stepHands(hands, layout, char, dt, snap = false) {
  const target = fingerId(char), key = layout.keys[plainKey(char)];
  const ease = snap ? 1 : Math.min(1, dt * 16);
  for (const id of FINGERS) {
    const home = layout.keys[HOME[id]]; if (!home) continue;
    const goal = id === target && key ? key : home;
    const tip = hands.tips[id] ||= { x: home.x, y: home.y };
    tip.x += (goal.x - tip.x) * ease; tip.y += (goal.y - tip.y) * ease;
  }
  hands.active = target; hands.color = char ? COLORS[fingerFor(char).color] : null;
  return hands;
}

function stroke(ctx, points, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(...points[0]);
  if (points.length === 3) ctx.quadraticCurveTo(...points[1], ...points[2]); else ctx.lineTo(...points[1]);
  ctx.stroke();
}
// Geometry of one hand from the home keys and the space bar.
function handShape(layout, side) {
  const ids = side === 'L' ? ['L5', 'L4', 'L3', 'L2'] : ['R2', 'R3', 'R4', 'R5'];
  const homes = ids.map(id => layout.keys[HOME[id]]);
  const space = layout.keys[' '];
  if (homes.some(home => !home) || !space) return null;
  const k = homes[0].w, inner = side === 'L' ? 1 : -1;
  // Knuckles sit a little below the bottom letter row, fanned like a real hand.
  const knuckleY = space.y - k * .2;
  const knuckles = homes.map((home, i) => {
    const fromIndex = side === 'L' ? 3 - i : i;
    return [home.x + inner * k * (.1 + fromIndex * .06), knuckleY + fromIndex * k * .12];
  });
  const outerX = knuckles[side === 'L' ? 0 : 3][0] - inner * k * .3, innerX = knuckles[side === 'L' ? 3 : 0][0] + inner * k * .3;
  const wristY = knuckleY + k * 1.45;
  const palm = { outerX, innerX, topY: knuckleY, wristY, k, inner };
  const thumbBase = [innerX - inner * k * .15, knuckleY + k * .75];
  const thumbTip = [space.x - inner * space.w * .16, space.y];
  return { ids, knuckles, palm, thumbBase, thumbTip, k };
}
// Palm outline: from the knuckle line down to a narrower, rounded wrist.
function palmPath(ctx, palm) {
  const { outerX, innerX, topY, wristY, k, inner } = palm;
  const wristOuter = outerX + inner * k * .35, wristInner = innerX - inner * k * .25;
  ctx.beginPath(); ctx.moveTo(outerX, topY);
  ctx.quadraticCurveTo((outerX + innerX) / 2, topY - k * .25, innerX, topY + k * .1);
  ctx.quadraticCurveTo(innerX + inner * k * .1, wristY - k * .5, wristInner, wristY);
  ctx.lineTo(wristOuter, wristY);
  ctx.quadraticCurveTo(outerX - inner * k * .1, wristY - k * .6, outerX, topY);
  ctx.closePath();
}
const fingerPath = (base, tip, k) => [base, [(base[0] * 2 + tip.x) / 3, (base[1] * 2 + tip.y) / 3 - k * .05], [tip.x, tip.y + k * .12]];
const thumbPath = shape => [shape.thumbBase, [shape.thumbTip[0] + shape.palm.inner * shape.k * .3, shape.thumbBase[1] - shape.k * .05], shape.thumbTip];
// Each hand is painted twice on a scratch canvas: a white rim, then a pale body.
function silhouette(octx, shape, hands, rim) {
  const { k } = shape, width = k * .46 + (rim ? 4 : 0), color = rim ? '#ffffff' : '#bfe3f2';
  octx.fillStyle = color; octx.strokeStyle = color; octx.lineWidth = rim ? 4 : 0;
  palmPath(octx, shape.palm); octx.fill(); if (rim) octx.stroke();
  stroke(octx, thumbPath(shape), width * 1.1, color);
  shape.ids.forEach((id, i) => { const tip = hands.tips[id]; if (tip) stroke(octx, fingerPath(shape.knuckles[i], tip, k), width, color); });
}
export function drawHands(ctx, hands, layout, width, height, time = 0, scratch = null) {
  ctx.clearRect(0, 0, width, height);
  const shapes = ['L', 'R'].map(side => handShape(layout, side)).filter(Boolean);
  if (!shapes.length) return;
  // Painting opaque on a scratch canvas and laying it down translucent keeps
  // overlapping fingers from turning into darker blotches.
  const octx = scratch ? scratch.getContext('2d') : ctx;
  if (scratch) { scratch.width = ctx.canvas.width; scratch.height = ctx.canvas.height; octx.setTransform(ctx.getTransform()); }
  for (const rim of [true, false]) for (const shape of shapes) silhouette(octx, shape, hands, rim);
  if (scratch) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = .34; ctx.drawImage(scratch, 0, 0); ctx.restore(); }
  // Fingernails make each fingertip easy to read.
  ctx.save(); ctx.globalAlpha = .5;
  for (const shape of shapes) shape.ids.forEach(id => { const tip = hands.tips[id]; if (tip) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(tip.x, tip.y - shape.k * .02, shape.k * .12, shape.k * .09, 0, 0, Math.PI * 2); ctx.fill(); } });
  ctx.restore();
  // The finger to use glows in its keyboard color and its tip pulses on the key.
  const color = hands.color || '#ffffff';
  for (const shape of shapes) {
    const w = shape.k * .46, pulse = 1 + Math.sin(time * 6) * .12;
    let path = null, tip = null;
    if (hands.active === 'thumbs') { path = thumbPath(shape); tip = shape.thumbTip; }
    else {
      const index = shape.ids.indexOf(hands.active);
      if (index >= 0) { const t = hands.tips[hands.active]; path = fingerPath(shape.knuckles[index], t, shape.k); tip = [t.x, t.y]; }
    }
    if (!path) continue;
    ctx.save(); ctx.globalAlpha = .9; ctx.shadowColor = color; ctx.shadowBlur = 16;
    stroke(ctx, path, hands.active === 'thumbs' ? w * 1.1 : w, color);
    ctx.restore();
    ring(ctx, tip[0], tip[1], shape.k * .38 * pulse, color);
  }
}
function ring(ctx, x, y, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
