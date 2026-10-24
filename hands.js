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
// Geometry of one hand from the home keys and the space bar: a rounded palm under the
// bottom row, finger capsules that start inside it, and a thumb reaching the space bar.
function handShape(layout, side) {
  const ids = side === 'L' ? ['L5', 'L4', 'L3', 'L2'] : ['R2', 'R3', 'R4', 'R5'];
  const homes = ids.map(id => layout.keys[HOME[id]]);
  const space = layout.keys[' '];
  if (homes.some(home => !home) || !space) return null;
  const k = homes[0].w, inner = side === 'L' ? 1 : -1;
  const knuckleY = space.y - k * .5;
  const knuckles = homes.map((home, i) => {
    const fromIndex = side === 'L' ? 3 - i : i;
    return [home.x + inner * k * (.12 + fromIndex * .05), knuckleY + fromIndex * k * .1];
  });
  const xs = knuckles.map(point => point[0]);
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + k * .22, ry = k * .7;
  const palm = { cx: (Math.max(...xs) + Math.min(...xs)) / 2, top: knuckleY, rx, ry, tilt: inner * -.12, k };
  const thumbBase = [palm.cx + inner * rx * .55, knuckleY + ry * .9];
  const thumbTip = [space.x - inner * space.w * .14, space.y];
  return { ids, knuckles, palm, thumbBase, thumbTip, k, inner };
}
// Palm and wrist as one mitten-shaped path that narrows smoothly into the wrist;
// `grow` widens it for the outline pass.
function palmPath(ctx, palm, grow = 0) {
  const { cx, top, rx, ry, tilt, k } = palm, w = rx + grow, g = grow;
  ctx.save(); ctx.translate(cx, top); ctx.rotate(tilt);
  ctx.beginPath(); ctx.moveTo(-w, k * .15);
  ctx.bezierCurveTo(-w * 1.06, ry * .7, -w * .78, ry * 1.25, -w * .58, ry * 1.5);
  ctx.lineTo(-w * .55, ry * 1.5 + k * 1.3 + g);
  ctx.lineTo(w * .55, ry * 1.5 + k * 1.3 + g);
  ctx.lineTo(w * .58, ry * 1.5);
  ctx.bezierCurveTo(w * .78, ry * 1.25, w * 1.06, ry * .7, w, k * .1);
  ctx.quadraticCurveTo(0, -k * .22 - g, -w, k * .15);
  ctx.fill(); ctx.restore();
}
const fingerPath = (base, tip, k) => [base, [(base[0] + tip.x) / 2, (base[1] + tip.y) / 2 + k * .04], [tip.x, tip.y + k * .06]];
const thumbPath = shape => [shape.thumbBase, [shape.thumbTip[0] + shape.inner * shape.k * .45, shape.thumbBase[1] + shape.k * .05], shape.thumbTip];
const FINGER = .38;
// The whole hand as one solid shape; `grow` widens it by a few pixels to make an outline.
function silhouette(octx, shape, hands, grow = 0) {
  const { k } = shape, width = k * FINGER + grow * 2;
  octx.fillStyle = '#ffffff';
  palmPath(octx, shape.palm, grow);
  stroke(octx, thumbPath(shape), width * 1.2, '#ffffff');
  shape.ids.forEach((id, i) => { const tip = hands.tips[id]; if (tip) stroke(octx, fingerPath(shape.knuckles[i], tip, k), width, '#ffffff'); });
}
export function drawHands(ctx, hands, layout, width, height, time = 0, scratch = null) {
  ctx.clearRect(0, 0, width, height);
  const shapes = ['L', 'R'].map(side => handShape(layout, side)).filter(Boolean);
  if (!shapes.length) return;
  // Glass hands: a faint body and a crisp outline of the whole hand, so the letters stay readable.
  // Both are painted opaque on a scratch canvas and laid down translucent, so overlaps never darken.
  if (scratch) {
    const octx = scratch.getContext('2d');
    scratch.width = ctx.canvas.width; scratch.height = ctx.canvas.height; octx.setTransform(ctx.getTransform());
    const layer = alpha => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(scratch, 0, 0); ctx.restore(); };
    for (const shape of shapes) silhouette(octx, shape, hands);
    layer(.12);
    octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, scratch.width, scratch.height); octx.restore();
    for (const shape of shapes) silhouette(octx, shape, hands, 1.5);
    octx.globalCompositeOperation = 'destination-out';
    for (const shape of shapes) silhouette(octx, shape, hands);
    octx.globalCompositeOperation = 'source-over';
    layer(.7);
  } else {
    ctx.save(); ctx.globalAlpha = .15;
    for (const shape of shapes) silhouette(ctx, shape, hands);
    ctx.restore();
  }
  // Soft pads where each finger rests.
  ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = '#ffffff';
  for (const shape of shapes) shape.ids.forEach(id => { const tip = hands.tips[id]; if (tip) { ctx.beginPath(); ctx.arc(tip.x, tip.y + shape.k * .1, shape.k * .07, 0, Math.PI * 2); ctx.fill(); } });
  ctx.restore();
  // The finger to use glows in its keyboard color and its tip pulses on the key.
  const color = hands.color || '#ffffff';
  for (const shape of shapes) {
    const w = shape.k * FINGER, pulse = 1 + Math.sin(time * 6) * .12;
    let path = null, tip = null;
    if (hands.active === 'thumbs') { path = thumbPath(shape); tip = shape.thumbTip; }
    else {
      const index = shape.ids.indexOf(hands.active);
      if (index >= 0) { const t = hands.tips[hands.active]; path = fingerPath(shape.knuckles[index], t, shape.k); tip = [t.x, t.y]; }
    }
    if (!path) continue;
    ctx.save(); ctx.globalAlpha = .85; ctx.shadowColor = color; ctx.shadowBlur = 10;
    stroke(ctx, path, hands.active === 'thumbs' ? w * 1.15 : w, color);
    ctx.restore();
    ring(ctx, tip[0], tip[1], shape.k * .38 * pulse, color);
  }
}
function ring(ctx, x, y, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
