import { skinById } from './skins.js';
// Canvas-native illustrations: no downloads, textures or WebGL dependencies.
// z = 0 is far away, z = 1 is near the camera (2.5D painter's-order depth).
const TAU = Math.PI * 2;
const mod = (value, span) => ((value % span) + span) % span;
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}
function polygon(ctx, points, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath(); ctx.fill();
}
function rounded(ctx, x, y, w, h, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function line(ctx, points, color, width = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
}

export function drawBoat(ctx, x, waterY, scale, time = 0) {
  ctx.save(); ctx.translate(x, waterY + Math.sin(time * 1.2) * 2); ctx.scale(scale, scale);
  ctx.rotate(Math.sin(time * .8) * .015);
  // Reflection and wake stay under the hull.
  ellipse(ctx, 5, 14, 128, 13, '#c4f4ea19');
  line(ctx, [[-137, 13], [-101, 13]], '#d9f6ed88', 2);
  line(ctx, [[86, 18], [144, 18]], '#d9f6ed66', 2);
  // Rail, wheelhouse and the little expedition flag.
  rounded(ctx, -44, -72, 83, 52, 6, '#edf6f4');
  polygon(ctx, [[-50, -71], [39, -71], [50, -63], [-54, -63]], '#ffd473');
  rounded(ctx, -35, -61, 28, 23, 3, '#2b7183');
  rounded(ctx, 1, -61, 28, 23, 3, '#2b7183');
  polygon(ctx, [[-32, -59], [-13, -59], [-32, -43]], '#a1ddd9');
  polygon(ctx, [[4, -59], [23, -59], [4, -43]], '#a1ddd9');
  line(ctx, [[-6, -76], [-6, -111]], '#edf6f4', 3);
  polygon(ctx, [[-5, -108], [26, -101], [-5, -90]], '#ef987f');
  line(ctx, [[12, -75], [18, -93]], '#173e50', 2);
  for (const post of [-87, -62, 47, 73, 98]) line(ctx, [[post, -21], [post, -40]], '#d3eeeb', 3);
  line(ctx, [[-92, -40], [-55, -40]], '#d3eeeb', 3);
  line(ctx, [[45, -40], [102, -40]], '#d3eeeb', 3);
  rounded(ctx, 72, -22, 10, 30, 3, '#365365');
  // Curved hull instead of a flat trapezoid.
  const hull = ctx.createLinearGradient(0, -24, 0, 19);
  hull.addColorStop(0, '#fff6df'); hull.addColorStop(.58, '#e0e9da'); hull.addColorStop(1, '#b7d5cd');
  ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(-116, -23);
  ctx.quadraticCurveTo(-91, 20, -48, 22); ctx.lineTo(79, 22);
  ctx.quadraticCurveTo(111, 14, 114, -23); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ef987f'; ctx.lineWidth = 9; ctx.beginPath();
  ctx.moveTo(-109, -12); ctx.quadraticCurveTo(-92, 2, -58, 2); ctx.lineTo(106, 2); ctx.stroke();
  for (const porthole of [-62, -26, 10]) {
    ellipse(ctx, porthole, -12, 5, 5, '#1b5367');
    ellipse(ctx, porthole - 1, -13, 2, 2, '#a3dfda');
  }
  // Life ring with four coral-colored sections.
  ellipse(ctx, 53, -52, 13, 13, '#fff5de');
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = '#ef987f'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.arc(53, -52, 10, i * Math.PI / 2 - .22, i * Math.PI / 2 + .22); ctx.stroke();
  }
  ellipse(ctx, 53, -52, 6, 6, '#367888');
  line(ctx, [[89, -13], [89, 36], [104, 36], [104, -12]], '#7fadaf', 3);
  for (const rung of [4, 16, 28]) line(ctx, [[89, rung], [104, rung]], '#c2e4db', 2);
  ctx.restore();
}

// ----- Diver: one drawing, dressed by a skin palette, an optional extra piece and accessories -----
function star(ctx, x, y, outer, inner, color, points = 5, rotation = -Math.PI / 2) {
  const corners = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer, angle = rotation + i * Math.PI / points;
    corners.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
  }
  polygon(ctx, corners, color);
}
function heart(ctx, x, y, size, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + size * .9);
  ctx.bezierCurveTo(x - size * 1.4, y - size * .1, x - size * .6, y - size * 1.1, x, y - size * .35);
  ctx.bezierCurveTo(x + size * .6, y - size * 1.1, x + size * 1.4, y - size * .1, x, y + size * .9); ctx.fill();
}
function bat(ctx, x, y, size, flap, color) {
  const lift = flap * size * .6;
  polygon(ctx, [[x, y], [x - size * .5, y - size * .3 - lift], [x - size * 1.2, y - lift * .6], [x - size * .9, y + size * .2], [x - size * .45, y + size * .05], [x, y + size * .35],
    [x + size * .45, y + size * .05], [x + size * .9, y + size * .2], [x + size * 1.2, y - lift * .6], [x + size * .5, y - size * .3 - lift]], color);
}
// Top of the drawing (diver units, before scaling) for each tall piece, so HUDs can sit above it.
const HAT_TOP = { 'sombrero-copa': -116, 'sombrero-vaquero': -102, 'gorro-cumple': -124, maceta: -132, 'sombrero-bruja': -138 };
const EXTRA_TOP = { crown: -99, antennae: -98, sharkHood: -102, pumpkin: -90 };
export function diverTop(skinId = 'clasico', gear = {}) {
  const skin = skinById(skinId);
  let top = -78;
  if (gear.head) top = Math.min(top, HAT_TOP[gear.head] ?? top);
  else if (EXTRA_TOP[skin.extra]) top = Math.min(top, EXTRA_TOP[skin.extra]);
  if (gear.hand === 'tridente') top = Math.min(top, -112);
  return top;
}

const TRAIL_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
function drawTrail(ctx, id, time) {
  if (!id) return;
  for (let i = 0; i < 9; i++) {
    const phase = mod(time * .6 + i / 9, 1);
    const px = -40 - phase * 150, py = 30 + Math.sin(time * 1.6 + i * 1.3) * 12 - phase * 30;
    const size = 4 + (1 - phase) * 4;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (1 - phase) * .9));
    if (id === 'estela-corazones') heart(ctx, px, py, size, '#ff8fb8');
    else if (id === 'estela-estrellas') star(ctx, px, py, size * 1.3, size * .5, '#ffe27a', 4);
    else if (id === 'estela-murcielagos') bat(ctx, px, py, size * 1.6, Math.sin(time * 9 + i), '#4a2d6b');
    else { ctx.strokeStyle = TRAIL_COLORS[i % TRAIL_COLORS.length]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, size, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}
// Pets float beside the diver. Also used on their own in the shop.
export function drawPet(ctx, id, x, y, time = 0, scale = 1) {
  if (!id) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const wiggle = Math.sin(time * 4);
  if (id === 'pez-payaso') {
    polygon(ctx, [[-14, 0], [-28, -10 + wiggle * 3], [-28, 10 + wiggle * 3]], '#ff8a3d');
    ellipse(ctx, 0, 0, 18, 12, '#ff8a3d');
    for (const sx of [-6, 6]) { ctx.save(); ctx.globalAlpha = .95; ellipse(ctx, sx, 0, 3.5, 11, '#fff8ee'); ctx.restore(); }
    line(ctx, [[-9.5, -10], [-9.5, 10]], '#1c1c26', 1); line(ctx, [[9.5, -10], [9.5, 10]], '#1c1c26', 1);
    ellipse(ctx, 12, -3, 3, 3, '#fff'); ellipse(ctx, 13, -3, 1.6, 1.6, '#1c1c26');
  } else if (id === 'tortuga') {
    for (const [fx, fy, dir] of [[-12, 8, -1], [12, 8, 1]]) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(dir * (.4 + wiggle * .3)); ellipse(ctx, dir * 8, 3, 9, 4, '#7cc45f'); ctx.restore(); }
    ellipse(ctx, 21, -2, 8, 7, '#8fd06f'); ellipse(ctx, 24, -4, 1.6, 1.6, '#1c1c26');
    ctx.strokeStyle = '#3f6e2a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(23, -1, 3, .3, 1.6); ctx.stroke();
    ctx.fillStyle = '#5b8f3a'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 14, 0, Math.PI, 0); ctx.fill();
    rounded(ctx, -18, -1, 36, 6, 3, '#b48a4a');
    for (const [hx, hy] of [[-8, -6], [0, -10], [8, -6]]) ellipse(ctx, hx, hy, 4, 3, '#7cb04a');
  } else if (id === 'medusa') {
    ctx.save(); ctx.globalAlpha = .9;
    for (let i = 0; i < 5; i++) {
      const tx = -10 + i * 5;
      ctx.strokeStyle = '#f5b8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, 2);
      ctx.bezierCurveTo(tx + Math.sin(time * 3 + i) * 5, 12, tx - Math.sin(time * 3 + i) * 5, 20, tx + Math.sin(time * 2 + i) * 3, 30); ctx.stroke();
    }
    ctx.fillStyle = '#d08cff'; ctx.beginPath(); ctx.ellipse(0, 2, 17 + wiggle, 16 - wiggle, 0, Math.PI, 0); ctx.fill();
    ellipse(ctx, -5, -6, 5, 3, '#f8e6ff88');
    ctx.restore();
    ellipse(ctx, -5, -2, 1.8, 2.2, '#4a1f5a'); ellipse(ctx, 5, -2, 1.8, 2.2, '#4a1f5a');
  } else if (id === 'mini-otto') {
    for (let i = 0; i < 4; i++) {
      const ax = -9 + i * 6;
      ctx.strokeStyle = '#d47f80'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, 6);
      ctx.quadraticCurveTo(ax + Math.sin(time * 3 + i) * 6, 16, ax + (i - 1.5) * 4, 22); ctx.stroke();
    }
    ellipse(ctx, 0, -4, 15, 14, '#e48f8a'); ellipse(ctx, -5, -10, 5, 3, '#ffe3b955');
    for (const ex of [-5, 5]) { ellipse(ctx, ex, -2, 4, 4.5, '#fff0d6'); ellipse(ctx, ex - 1, -1.5, 1.8, 2.4, '#163e51'); }
    ctx.strokeStyle = '#633c58'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 4, 3, .2, Math.PI - .2); ctx.stroke();
  } else if (id === 'fantasmita') {
    ctx.save(); ctx.globalAlpha = .88;
    ctx.fillStyle = '#f4f2ff'; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(-14, -2);
    ctx.bezierCurveTo(-14, -24, 14, -24, 14, -2); ctx.lineTo(14, 14);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(10.5 - i * 7, 8 + (i % 2 ? 8 : 0) + wiggle * 2, 7 - i * 7, 14);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ellipse(ctx, -5, -4, 2.6, 3.4, '#2a2340'); ellipse(ctx, 5, -4, 2.6, 3.4, '#2a2340');
    ellipse(ctx, 0, 4, 2.5, 3, '#2a2340');
  }
  ctx.restore();
}

function drawPattern(ctx, pattern) {
  if (!pattern) return;
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -3, 24, 39, 0, 0, TAU); ctx.clip();
  const color = pattern.color;
  if (pattern.type === 'stripes') for (const y of [-26, -10, 6, 22]) rounded(ctx, -26, y, 52, 8, 2, color);
  if (pattern.type === 'spots') for (const [sx, sy, r] of [[-10, -22, 5], [8, -12, 4], [-4, 4, 6], [12, 18, 4], [-14, 22, 3]]) ellipse(ctx, sx, sy, r, r * .8, color);
  if (pattern.type === 'scales') for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-18 + col * 12 + row % 2 * 6, -30 + row * 11, 6, 0, Math.PI); ctx.stroke();
  }
  if (pattern.type === 'bones') {
    line(ctx, [[0, -26], [0, 26]], color, 3);
    for (const y of [-18, -9, 0, 9]) { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-15, y + 3); ctx.quadraticCurveTo(0, y - 4, 15, y + 3); ctx.stroke(); }
    ellipse(ctx, -6, 20, 6, 4, color); ellipse(ctx, 6, 20, 6, 4, color);
  }
  if (pattern.type === 'ridges') for (const rx of [-12, 0, 12]) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, -40); ctx.quadraticCurveTo(rx * 1.6, -3, rx, 36); ctx.stroke(); }
  ctx.restore();
}
function drawBack(ctx, skin, gear, c, time) {
  // Pieces that sit behind the body, back to front.
  if (skin.extra === 'cape') {
    const wave = Math.sin(time * 2.2) * 8;
    ctx.fillStyle = c.cape || '#e64b4b'; ctx.beginPath(); ctx.moveTo(-6, -32); ctx.lineTo(12, -30);
    ctx.bezierCurveTo(-10, 0, -50, 30 + wave, -96, 26 + wave);
    ctx.quadraticCurveTo(-84, 6 + wave * .5, -100, -6 + wave);
    ctx.bezierCurveTo(-60, -10, -30, -20, -6, -32); ctx.fill();
  }
  if (gear.back === 'alas-mariposa') {
    const flap = .7 + Math.sin(time * 3) * .3;
    ctx.save(); ctx.translate(-22, -18); ctx.scale(flap, 1);
    for (const [wx, wy, rx, ry, rot, color] of [[-26, -24, 30, 20, -.5, '#c77dff'], [-22, 14, 22, 15, .5, '#ff8fb8']]) {
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(rot); ellipse(ctx, 0, 0, rx, ry, color);
      ellipse(ctx, -rx * .3, 0, rx * .3, ry * .35, '#fff3fb'); ctx.restore();
    }
    ctx.restore();
  }
  if (skin.extra === 'spikes') {
    for (const [sx, sy, rot] of [[-14, -66, -.9], [-24, -50, -1.3], [-26, -26, -1.6], [-26, -4, -1.7], [-22, 16, -1.9]]) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot); polygon(ctx, [[-7, 0], [0, -15], [7, 0]], c.fin); ctx.restore();
    }
  }
  if (skin.extra === 'sharkHood' && !gear.head) polygon(ctx, [[-6, -66], [-18, -102], [16, -70]], c.suit0);
}
function drawLegs(ctx, skin, gear, c, kick, time) {
  if (skin.extra === 'tail') {
    // A plump, tapering tail: one curve stroked in shrinking steps, then a wide fluke.
    const wave = Math.sin(time * 2) * 9;
    const at = t => [(1 - t) ** 2 * 2 + 2 * (1 - t) * t * -6 + t * t * -78, (1 - t) ** 2 * 18 + 2 * (1 - t) * t * 74 + t * t * (56 + wave)];
    ctx.lineCap = 'round';
    for (let step = 0; step < 14; step++) {
      const t0 = step / 14, t1 = (step + 1) / 14;
      ctx.strokeStyle = step % 2 ? c.legNear : c.legFar; ctx.lineWidth = 30 * (1 - t0 * .7);
      ctx.beginPath(); ctx.moveTo(...at(t0)); ctx.lineTo(...at(t1)); ctx.stroke();
    }
    for (let i = 1; i < 5; i++) { const [sx, sy] = at(i / 6); ctx.strokeStyle = c.finLine; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy - 2, 5, 0, Math.PI); ctx.stroke(); }
    const [ex, ey] = at(1);
    polygon(ctx, [[ex + 4, ey], [ex - 30, ey - 30 + wave * .4], [ex - 20, ey], [ex - 32, ey + 28 + wave * .4]], c.fin);
    line(ctx, [[ex, ey], [ex - 24, ey - 20]], c.finLine, 1.2);
    line(ctx, [[ex, ey], [ex - 26, ey + 18]], c.finLine, 1.2);
    return;
  }
  const finStyle = { 'patas-rana': { fin: '#6cc04a', finDark: '#4a9a32', finLine: '#2f6a1f' }, 'patas-flamenco': { fin: '#ff8fb8', finDark: '#e66a9a', finLine: '#a8416b' }, 'patas-fuego': { fin: '#ff9a3c', finDark: '#e0501f', finLine: '#8f2c10' } }[gear.fins] || c;
  ctx.strokeStyle = c.legFar; ctx.lineWidth = 18; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, 21); ctx.lineTo(-36, 44 + kick); ctx.lineTo(-64, 43 + kick); ctx.stroke();
  ctx.strokeStyle = c.legNear; ctx.lineWidth = 17;
  ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(-2, 64 - kick); ctx.lineTo(-35, 77 - kick); ctx.stroke();
  if (skin.pattern?.type === 'bones') for (const pts of [[[-8, 25], [-34, 44 + kick]], [[8, 26], [-1, 60 - kick]]]) line(ctx, pts, skin.pattern.color, 2.5);
  if (skin.pattern?.type === 'stripes') for (const pts of [[[-24, 30 + kick * .5], [-22, 40 + kick * .8]], [[2, 44 - kick * .5], [-6, 50 - kick * .8]]]) line(ctx, pts, skin.pattern.color, 5);
  // Wide rubber fins, with grooves and a bright tip.
  for (const [fx, fy, rotation] of [[-63, 43 + kick, -.2], [-34, 78 - kick, .2]]) {
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(rotation);
    polygon(ctx, [[6, -10], [-17, -13], [-42, -22], [-47, 4], [-14, 12], [5, 8]], finStyle.fin);
    polygon(ctx, [[-38, -19], [-47, 4], [-39, 6], [-32, -17]], finStyle.finDark);
    line(ctx, [[-10, -3], [-34, -10]], finStyle.finLine, 1.5);
    line(ctx, [[-10, 3], [-36, 0]], finStyle.finLine, 1.5);
    if (gear.fins === 'patas-rana') for (const [tx, ty] of [[-46, -16], [-50, -6], [-47, 4]]) ellipse(ctx, tx, ty, 6, 5, finStyle.fin);
    if (gear.fins === 'patas-fuego') polygon(ctx, [[-44, -10], [-58, -2], [-48, 0], [-56, 10], [-42, 4]], '#ffd34f');
    ctx.restore();
  }
}
function drawTankAndPack(ctx, gear, time) {
  // Cylinder, valve and straps, tucked behind the shoulder.
  const tank = ctx.createLinearGradient(-43, 0, -18, 0);
  tank.addColorStop(0, '#558f9d'); tank.addColorStop(.45, '#c0e5df'); tank.addColorStop(1, '#6ea7b0');
  rounded(ctx, -42, -40, 25, 67, 11, tank);
  rounded(ctx, -40, -17, 22, 7, 2, '#295366'); rounded(ctx, -40, 6, 22, 7, 2, '#295366');
  rounded(ctx, -35, -47, 12, 9, 3, '#ffe0a2');
  if (gear.back === 'caparazon') {
    ellipse(ctx, -30, -6, 22, 38, '#6b8f3a'); ellipse(ctx, -30, -6, 18, 33, '#8fb04a');
    for (const [hx, hy] of [[-30, -26], [-30, -6], [-30, 14], [-40, -16], [-20, -16], [-40, 4], [-20, 4]]) ellipse(ctx, hx, hy, 5, 6, '#6b8f3a');
  }
  if (gear.back === 'cohete') {
    const flame = 14 + Math.sin(time * 25) * 5;
    for (const rx of [-50, -32]) {
      polygon(ctx, [[rx + 4, 26], [rx + 7, 26 + flame], [rx + 10, 26]], '#ffd34f');
      polygon(ctx, [[rx + 5.5, 26], [rx + 7, 26 + flame * .6], [rx + 8.5, 26]], '#fff4c2');
      rounded(ctx, rx, -34, 14, 60, 6, '#e64b4b');
      polygon(ctx, [[rx, -30], [rx + 7, -48], [rx + 14, -30]], '#f1f1e6');
      ellipse(ctx, rx + 7, -12, 4, 4, '#9be3ff');
    }
  }
}
function drawHead(ctx, skin, gear, c, pose, time) {
  // Neoprene hood and face visible through oversized goggles.
  ellipse(ctx, 10, -47, 27, 28, c.hood); ellipse(ctx, 20, -46, 20, 21, '#edb18b');
  if (skin.extra === 'sharkHood') {
    for (let i = 0; i < 9; i++) {
      const a = .35 + i * .3;
      const tip = [20 + Math.cos(a) * 14, -46 + Math.sin(a) * 15];
      polygon(ctx, [[20 + Math.cos(a - .14) * 20, -46 + Math.sin(a - .14) * 21], tip, [20 + Math.cos(a + .14) * 20, -46 + Math.sin(a + .14) * 21]], '#fdfdf7');
    }
  }
  if (skin.extra === 'pumpkin') for (const rx of [-4, 8]) { ctx.strokeStyle = skin.pattern.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, -72); ctx.quadraticCurveTo(rx - 8, -48, rx, -24); ctx.stroke(); }
  line(ctx, [[-12, -49], [6, -49]], c.band, 7);
  const hat = gear.head;
  if (!hat) {
    if (skin.extra === 'bandana') {
      polygon(ctx, [[-15, -62], [28, -72], [34, -62], [-12, -50]], '#d9534f');
      polygon(ctx, [[-15, -56], [-34, -48], [-30, -41], [-13, -47]], '#d9534f');
      for (const dot of [-4, 8, 19]) ellipse(ctx, dot, -62, 1.6, 1.6, '#fff1d5');
    }
    if (skin.extra === 'crown') {
      polygon(ctx, [[-6, -70], [-8, -92], [3, -82], [11, -97], [19, -82], [30, -92], [28, -70]], '#ffd34f');
      line(ctx, [[-6, -73], [28, -73]], '#c99a2a', 3);
      for (const [gx, gy, color] of [[11, -80, '#ef8f83'], [-1, -76, '#8dd8bd'], [23, -76, '#8dd8bd']]) ellipse(ctx, gx, gy, 2.4, 2.4, color);
    }
    if (skin.extra === 'antennae') {
      const sway = Math.sin(time * 3) * 3;
      for (const [bx, tx] of [[2, -8], [16, 24]]) { ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx, -72); ctx.quadraticCurveTo(bx + (tx - bx) * .3, -86, tx + sway, -92); ctx.stroke(); ellipse(ctx, tx + sway, -93, 4, 4, '#1c1c26'); }
    }
    if (skin.extra === 'pumpkin') {
      rounded(ctx, 6, -86, 7, 14, 2, '#5a7a2a');
      ctx.save(); ctx.translate(16, -82); ctx.rotate(-.5); ellipse(ctx, 6, 0, 8, 4, '#6cc04a'); ctx.restore();
    }
  }
  if (hat === 'sombrero-copa') {
    rounded(ctx, -16, -78, 52, 8, 4, '#1c1c26'); rounded(ctx, -5, -114, 30, 40, 4, '#26263a');
    rounded(ctx, -5, -86, 30, 8, 1, '#d9534f');
  }
  if (hat === 'sombrero-vaquero') {
    polygon(ctx, [[-4, -74], [-1, -100], [8, -94], [16, -100], [24, -74]], '#bf7e4a');
    ctx.fillStyle = '#a86a3c'; ctx.beginPath(); ctx.moveTo(-32, -66); ctx.quadraticCurveTo(-8, -86, 10, -74);
    ctx.quadraticCurveTo(30, -86, 52, -66); ctx.quadraticCurveTo(10, -60, -32, -66); ctx.fill();
    line(ctx, [[-2, -78], [22, -78]], '#6e4222', 3);
  }
  if (hat === 'gorro-cumple') {
    polygon(ctx, [[-6, -72], [10, -116], [26, -72]], '#ef8f83');
    for (const [x1, y1, x2, y2] of [[-1, -86, 21, -90], [3, -100, 17, -103]]) line(ctx, [[x1, y1], [x2, y2]], '#fff1d5', 3);
    ellipse(ctx, 10, -117, 5, 5, '#ffd34f');
  }
  if (hat === 'maceta') {
    polygon(ctx, [[-4, -88], [24, -88], [20, -68], [0, -68]], '#c56b45'); rounded(ctx, -6, -92, 32, 6, 2, '#d98258');
    line(ctx, [[10, -92], [10, -112]], '#5fae52', 3); ellipse(ctx, 4, -102, 6, 3, '#5fae52');
    for (let i = 0; i < 5; i++) ellipse(ctx, 10 + Math.cos(i * 1.256) * 7, -118 + Math.sin(i * 1.256) * 7, 4.5, 4.5, '#ff8fb8');
    ellipse(ctx, 10, -118, 4, 4, '#ffd34f');
  }
  if (hat === 'sombrero-bruja') {
    ctx.fillStyle = '#3b2457'; ctx.beginPath(); ctx.moveTo(-8, -74); ctx.lineTo(4, -112);
    ctx.quadraticCurveTo(8, -134, 30, -132); ctx.quadraticCurveTo(14, -124, 16, -110); ctx.lineTo(30, -74); ctx.closePath(); ctx.fill();
    ellipse(ctx, 11, -73, 34, 7, '#2a1940');
    rounded(ctx, -5, -84, 33, 7, 1, '#ff9a3c'); rounded(ctx, 7, -85, 9, 9, 1, '#ffd34f'); rounded(ctx, 9.5, -82.5, 4, 4, 1, '#ff9a3c');
  }
  const mask = { 'mascara-sol': ['#1c1c26', '#4a4f58', '#2a2d34', '#0e1114'], 'mascara-corazon': ['#e86a92', '#ffe3ec', '#ffb0c9', '#f27aa3'], 'mascara-robot': ['#6b7a8a', '#d6ffd0', '#7fe39a', '#2f9f58'] }[gear.mask] || [c.frame, '#cbfaf1', '#7bc7d0', '#347c99'];
  rounded(ctx, 2, -63, 44, 28, 11, mask[0]);
  const glass = ctx.createLinearGradient(7, -59, 38, -34);
  glass.addColorStop(0, mask[1]); glass.addColorStop(.4, mask[2]); glass.addColorStop(1, mask[3]);
  rounded(ctx, 7, -59, 34, 20, 7, glass);
  line(ctx, [[23, -59], [23, -40]], '#f5d483', 2);
  if (gear.mask === 'mascara-corazon') {
    for (const hx of [16, 31]) { ctx.fillStyle = '#d9366b'; ctx.beginPath(); ctx.moveTo(hx, -43); ctx.bezierCurveTo(hx - 11, -52, hx - 5, -58, hx, -52); ctx.bezierCurveTo(hx + 5, -58, hx + 11, -52, hx, -43); ctx.fill(); }
  } else if (gear.mask === 'mascara-robot') {
    for (const y of [-55, -50, -45]) line(ctx, [[10, y], [38, y]], '#2f9f58', 1);
    const scan = 13 + mod(time * 12, 22);
    rounded(ctx, scan, -52, 8, 4, 1, '#1d6b3a');
  } else if (gear.mask !== 'mascara-sol') {
    drawEyes(ctx, pose, time);
  }
  line(ctx, [[11, -55], [18, -55]], '#f3fff6', 2);
}
function drawEyes(ctx, pose, time) {
  const look = Math.max(-1, Math.min(1, pose.look || 0)) * 2;
  const eyes = [18 + look, 30 + look];
  if (pose.hurt > .4) {
    for (const ex of eyes) { line(ctx, [[ex - 2.5, -51.5], [ex + 2.5, -46.5]], '#164858', 1.6); line(ctx, [[ex - 2.5, -46.5], [ex + 2.5, -51.5]], '#164858', 1.6); }
  } else if (pose.cheer > 0) {
    for (const ex of eyes) { ctx.strokeStyle = '#164858'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(ex, -47.5, 2.8, Math.PI + .3, -.3); ctx.stroke(); }
  } else if (mod(time + 1.3, 3.7) < .13) {
    for (const ex of eyes) line(ctx, [[ex - 2.5, -49], [ex + 2.5, -49]], '#164858', 1.6);
  } else {
    const wide = pose.worried ? 1.3 : 1;
    for (const ex of eyes) ellipse(ctx, ex, -49, 2 * wide, 2.5 * wide, '#164858');
  }
}

// pose: { type 0..1 (typing nudge), cheer 0..1 (jump), flip (cheer with a full turn),
//         hurt 0..1 (just hit), worried (low oxygen), look -1..1 (eyes toward a target) }
export function drawDiver(ctx, x, y, scale, time = 0, depth = 0, skinId = 'clasico', gear = {}, pose = {}) {
  const skin = skinById(skinId), c = skin.palette;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  drawTrail(ctx, gear.trail, time);
  ctx.save();
  const cheer = Math.max(0, Math.min(1, pose.cheer || 0)), hurt = Math.max(0, Math.min(1, pose.hurt || 0));
  const lift = -Math.sin(Math.PI * cheer) * 16;
  let spin = pose.flip ? cheer * TAU : Math.sin(cheer * TAU) * .18;
  const shake = Math.sin(time * 70) * 5 * hurt;
  spin -= .25 * hurt;
  ctx.translate(shake, lift); ctx.translate(0, -10); ctx.rotate(-.12 + spin); ctx.translate(0, 10);
  // Soft light, not a bright cone behind the words.
  const beam = ctx.createLinearGradient(53, 5, 190, 45);
  beam.addColorStop(0, depth > 120 ? '#e8f8c223' : '#e8f8c214'); beam.addColorStop(1, '#e8f8c200');
  polygon(ctx, [[53, 3], [198, -15], [185, 73]], beam);
  const kick = Math.sin(time * (pose.worried ? 3.4 : 2)) * 7;
  drawBack(ctx, skin, gear, c, time);
  drawLegs(ctx, skin, gear, c, kick, time);
  drawTankAndPack(ctx, gear, time);
  const suit = ctx.createLinearGradient(-20, 0, 25, 0);
  suit.addColorStop(0, c.suit0); suit.addColorStop(.6, c.suit1); suit.addColorStop(1, c.suit2);
  ellipse(ctx, 0, -3, 24, 39, suit);
  drawPattern(ctx, skin.pattern);
  polygon(ctx, [[-18, -27], [-9, -36], [10, -35], [20, -24], [13, -15], [-10, -16]], c.collar);
  line(ctx, [[-9, -13], [-7, 24]], '#72b6bc', 2);
  line(ctx, [[-20, 15], [19, 15]], '#0d293b', 6);
  rounded(ctx, -3, 11, 10, 9, 2, '#d0e4d9');
  if (skin.extra === 'cape') star(ctx, 2, -2, 9, 4, '#ffd34f');
  if (skin.extra === 'skull') { ellipse(ctx, 2, -4, 8, 7, '#f1f1e6'); ellipse(ctx, -1, -5, 2, 2.4, '#16161e'); ellipse(ctx, 5, -5, 2, 2.4, '#16161e'); rounded(ctx, -1, 1, 6, 3, 1, '#f1f1e6'); }
  line(ctx, [[11, -15], [13, 5]], '#0d293b', 4);
  ellipse(ctx, 14, 2, 6, 7, '#edf6e4'); ellipse(ctx, 14, 2, 3, 4, '#548c91');
  line(ctx, [[14, 2], [16, -1]], '#ef987f', 1.5);
  if (gear.hand === 'guitarra') {
    ctx.save(); ctx.translate(18, 16); ctx.rotate(-.75);
    line(ctx, [[18, 0], [66, 0]], '#6a3f26', 6); rounded(ctx, 62, -6, 14, 12, 3, '#3b2417');
    ellipse(ctx, -9, 0, 19, 15, '#c9843f'); ellipse(ctx, 11, 0, 13, 10, '#c9843f');
    ellipse(ctx, 0, 0, 7, 7, '#3b2417'); rounded(ctx, -22, -3, 8, 6, 2, '#3b2417');
    for (const y of [-2, 0, 2]) line(ctx, [[-14, y], [64, y]], '#f3e8c6', .8);
    ctx.restore();
  }
  // Forward arm, gloved hand and torch. Typing nudges the hand.
  const nudge = Math.max(0, Math.min(1, pose.type || 0));
  const hx = 58 + nudge * 3, hy = 3 - nudge * 5;
  ctx.strokeStyle = c.arm; ctx.lineWidth = 12; ctx.beginPath();
  ctx.moveTo(15, -18); ctx.lineTo(36, 9 - nudge * 3); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.save(); ctx.translate(hx - 58, hy - 3);
  ellipse(ctx, 56, 3, 8, 6, c.glove);
  rounded(ctx, 53, -2, 18, 9, 3, '#0d2e40'); ellipse(ctx, 71, 2, 3, 5, '#d4f3bf');
  if (gear.hand === 'pato') {
    ellipse(ctx, 66, -4, 12, 9, '#ffd34f'); ellipse(ctx, 74, -16, 7, 7, '#ffd34f');
    polygon(ctx, [[79, -17], [88, -14], [79, -12]], '#ef8f43'); ellipse(ctx, 75, -18, 1.4, 1.4, '#1c1c26');
    polygon(ctx, [[56, -6], [50, -10], [55, -1]], '#ffd34f');
  }
  if (gear.hand === 'tridente') {
    line(ctx, [[48, 52], [66, -92]], '#d9b24a', 4);
    line(ctx, [[54, -88], [78, -92]], '#d9b24a', 4);
    for (const [px, py] of [[55, -88], [66, -92], [78, -92]]) polygon(ctx, [[px - 3, py], [px, py - 18], [px + 3, py]], '#f3d77a');
  }
  ctx.restore();
  drawHead(ctx, skin, gear, c, pose, time);
  rounded(ctx, 26, -34, 14, 10, 4, '#13394c');
  ctx.strokeStyle = '#0e2b3c'; ctx.lineWidth = 5; ctx.beginPath();
  ctx.moveTo(32, -29); ctx.bezierCurveTo(54, -13, 18, -1, -26, -39); ctx.stroke();
  // Small bubbles escape from the regulator; more of them when worried or hit. Frozen when time is frozen.
  const bubbles = pose.worried || hurt > 0 ? 7 : 4;
  for (let i = 0; i < bubbles; i++) {
    const rise = mod(time * (pose.worried ? 30 : 18) + i * 16, 63);
    ctx.strokeStyle = '#d0f6eb88'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(43 + Math.sin(i + time) * 4, -35 - rise, 2 + i % 2, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  drawPet(ctx, gear.pet, -100, -78 + Math.sin(time * 1.8) * 7, time);
  ctx.restore();
}

// ----- Sea creatures that carry words -----
// They face left (toward a diver on their left) unless `flip` is set.
export const CREATURE_LOOK = {
  shark: { body: '#91c9d0', fin: '#8fc8cf', tail: '#76bac3', belly: '#c9e6e3', line: '#458492' },
  golden: { body: '#f1c453', fin: '#ffd977', tail: '#d9a531', belly: '#fff1c2', line: '#a8873a' },
  hammer: { body: '#a3a9cf', fin: '#b3b8da', tail: '#8a90bd', belly: '#dfe1f2', line: '#5d6391' },
  puffer: { body: '#f5d36b', fin: '#f0b84a', tail: '#f0b84a', belly: '#fff3c4', line: '#b5852c' },
  whale: { body: '#5d8fd6', fin: '#4d7cc0', tail: '#4d7cc0', belly: '#cfe0f5', line: '#2f5a99' }
};
// options: { flip, fleeing, progress 0..1, flinch seconds left, time, costume ('halloween'), id }
export function drawCreature(ctx, kind, x, y, scale, options = {}) {
  const { flip = false, fleeing = false, progress = 0, flinch = 0, time = 0, costume = null, id = 0 } = options;
  const look = CREATURE_LOOK[kind] || CREATURE_LOOK.shark;
  const angry = !fleeing && progress > .6 && kind !== 'whale';
  ctx.save(); ctx.translate(x + (flinch > 0 ? Math.sin(flinch * 80) * 4 : 0), y); ctx.scale(scale, scale);
  if (flip) ctx.scale(-1, 1);
  const tailSwing = Math.sin(time * (fleeing ? 14 : 6) + id) * .18;
  if (kind === 'puffer') {
    const puff = 1 + (flinch > 0 ? .15 : 0) + Math.sin(time * 2 + id) * .03;
    ctx.save(); ctx.translate(30, 0); ctx.rotate(tailSwing); polygon(ctx, [[0, 0], [22, -16], [22, 16]], look.tail); ctx.restore();
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, r = 34 * puff;
      polygon(ctx, [[Math.cos(a - .12) * r, Math.sin(a - .12) * r], [Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)], [Math.cos(a + .12) * r, Math.sin(a + .12) * r]], look.line);
    }
    ellipse(ctx, 0, 0, 34 * puff, 32 * puff, look.body); ellipse(ctx, 0, 12, 26 * puff, 14, look.belly);
    for (const [sx, sy] of [[8, -16], [20, -4], [-2, -24], [14, 10]]) ellipse(ctx, sx, sy, 3, 3, '#d9a04a');
    ellipse(ctx, -14, -8, 9, 10, '#fff'); ellipse(ctx, -16 - (fleeing ? -2 : 0), -7, fleeing ? 2.5 : 4.5, fleeing ? 2.5 : 5, '#153e50');
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 2; ctx.beginPath();
    if (angry) { ctx.moveTo(-24, -20); ctx.lineTo(-8, -15); } ctx.stroke();
    ellipse(ctx, -30, 6, 4, fleeing ? 5 : 3, '#b5552c');
    polygon(ctx, [[2, 4], [16, 16], [10, -2]], look.fin);
  } else if (kind === 'whale') {
    ctx.save(); ctx.translate(110, -6); ctx.rotate(tailSwing * .8);
    polygon(ctx, [[0, 0], [30, -30], [24, -2], [34, 22]], look.tail); ctx.restore();
    ctx.fillStyle = look.body; ctx.beginPath(); ctx.moveTo(-90, 0);
    ctx.bezierCurveTo(-90, -52, 30, -58, 112, -10); ctx.bezierCurveTo(60, 40, -60, 52, -90, 0); ctx.fill();
    ctx.fillStyle = look.belly; ctx.beginPath(); ctx.moveTo(-86, 10); ctx.bezierCurveTo(-50, 36, 20, 34, 60, 18); ctx.bezierCurveTo(10, 22, -50, 18, -86, 10); ctx.fill();
    for (let i = 0; i < 4; i++) line(ctx, [[-70 + i * 12, 16 + i], [-40 + i * 12, 22 + i]], look.line, 1.2);
    polygon(ctx, [[-10, 18], [8, 44], [20, 18]], look.fin);
    ellipse(ctx, -58, -12, 6, 7, '#fff'); ellipse(ctx, -59, -11, 3, 4, '#153e50');
    ellipse(ctx, -64, 6, 7, 4, '#ff9fb588');
    ctx.strokeStyle = '#1f3f6e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-74, 0, 10, .3, 1.5); ctx.stroke();
    // A friendly spout, frozen when time is frozen.
    for (let i = 0; i < 4; i++) { const rise = mod(time * 30 + i * 9, 36); ellipse(ctx, -30 + Math.sin(i * 2) * 6, -50 - rise, 3, 3, '#d9f6ffcc'); }
  } else {
    ctx.save(); ctx.translate(45, 0); ctx.rotate(tailSwing);
    polygon(ctx, [[0, 0], [55, -37], [42, 0], [55, 34]], look.tail); ctx.restore();
    polygon(ctx, [[-12, -23], [12, -66], [26, -22]], look.fin);
    ellipse(ctx, 0, 0, 71, 32, look.body); ellipse(ctx, -10, 13, 52, 13, look.belly);
    polygon(ctx, [[8, 10], [33, 49], [40, 16]], look.fin);
    if (kind === 'hammer') {
      rounded(ctx, -84, -30, 18, 60, 9, look.body);
      for (const ey of [-24, 24]) { ellipse(ctx, -78, ey, 5, 5, '#fff'); ellipse(ctx, -79, ey, 2.4, 2.4, '#153e50'); }
    } else {
      ellipse(ctx, -44, -8, fleeing ? 7 : 5, fleeing ? 7 : 5, fleeing ? '#fff' : '#153e50');
      ellipse(ctx, -45, -9, fleeing ? 2.4 : 1.6, fleeing ? 2.4 : 1.6, fleeing ? '#153e50' : '#fff');
      if (flinch > 0 && !fleeing) line(ctx, [[-49, -8], [-39, -8]], '#153e50', 2.4);
    }
    ctx.strokeStyle = look.line; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-15 + i * 7, -6); ctx.quadraticCurveTo(-21 + i * 7, 3, -15 + i * 7, 10); ctx.stroke(); }
    if (angry) {
      line(ctx, [[-52, -18], [-38, -13]], '#153e50', 3);
      ctx.beginPath(); ctx.moveTo(-60, 8); ctx.lineTo(-36, 10); ctx.stroke();
      for (let t = 0; t < 4; t++) polygon(ctx, [[-58 + t * 6, 8.2], [-55 + t * 6, 13], [-52 + t * 6, 8.6]], '#fff');
    } else if (fleeing) {
      ctx.beginPath(); ctx.arc(-50, 10, 5, 0, TAU); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-48, 7, 9, .15, 1.6); ctx.stroke();
    }
    if (kind === 'golden') for (let i = 0; i < 4; i++) {
      const twinkle = .5 + Math.sin(time * 5 + i * 1.7) * .5;
      star(ctx, -40 + i * 28, -30 + (i % 2) * 50, 4 + twinkle * 4, 1.5, '#fff8d1', 4);
    }
  }
  if (costume === 'halloween' && kind !== 'whale') {
    const top = kind === 'puffer' ? -40 : -26, hx = kind === 'puffer' ? -4 : -24;
    if (id % 2 === 0) {
      ellipse(ctx, hx, top, 26, 6, '#2a1940');
      polygon(ctx, [[hx - 16, top], [hx + 4, top - 44], [hx + 16, top]], '#3b2457');
      rounded(ctx, hx - 14, top - 9, 29, 6, 1, '#ff9a3c');
    } else {
      polygon(ctx, [[hx - 30, top + 34], [hx - 26, top + 44], [hx - 22, top + 34]], '#fff');
      ctx.save(); ctx.globalAlpha = .9;
      ellipse(ctx, hx + 6, top - 6, 13, 11, '#ff8a2c');
      for (const ex of [hx + 1, hx + 11]) polygon(ctx, [[ex - 3, top - 6], [ex, top - 11], [ex + 3, top - 6]], '#ffe27a');
      rounded(ctx, hx + 4, top - 20, 4, 6, 1, '#5a7a2a');
      ctx.restore();
    }
  }
  ctx.restore();
}

export const REEF_LAYERS = [
  { z: .16, parallax: .32, opacity: .3, scale: .52, rock: '#4b94a4', coral: '#63b3b2', weed: '#68b2ad' },
  { z: .45, parallax: .75, opacity: .65, scale: .85, rock: '#165e72', coral: '#c68398', weed: '#3fa6a0' },
  { z: .9, parallax: 1.5, opacity: 1, scale: 1.15, rock: '#123e55', coral: '#ed9c85', weed: '#66bda1' }
];
export function layerOffset(depth, layer) { return depth * layer.parallax; }
function coral(ctx, x, y, scale, color, variant, time) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const sway = Math.sin(time + variant) * 2;
  if (variant % 3 === 0) {
    // Branching staghorn coral.
    for (const [dx, dy] of [[-24, -45], [19, -64], [-8, -78], [32, -35]]) {
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(0, 3); ctx.quadraticCurveTo(sway, -22, dx, dy); ctx.stroke();
      line(ctx, [[dx, dy + 9], [dx - 9, dy - 3]], color, 4);
      line(ctx, [[dx, dy + 4], [dx + 8, dy - 9]], color, 3);
      ellipse(ctx, dx + 8, dy - 9, 2, 2, '#fff1d540');
    }
  } else if (variant % 3 === 1) {
    // Rounded tube sponges.
    for (let i = 0; i < 3; i++) {
      const h = 28 + i * 13, dx = (i - 1) * 15;
      rounded(ctx, dx - 7, -h, 14, h + 5, 7, color);
      ellipse(ctx, dx, -h + 4, 5, 3, '#243e5966');
      line(ctx, [[dx - 4, -h + 12], [dx - 4, -4]], '#fff1d530', 1);
    }
  } else {
    // Sea fan, a quiet silhouette behind the action.
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-50, -38, -41, -80, -3, -65);
    ctx.bezierCurveTo(29, -97, 50, -49, 0, 4); ctx.fill();
    for (const dx of [-27, -13, 3, 17, 29]) line(ctx, [[0, 2], [dx, -58 + Math.abs(dx) * .3]], '#c5ece52b', 1);
  }
  ctx.restore();
}
function reefLayer(ctx, width, height, depth, time, layer, foreground) {
  const tile = height + 180;
  const shift = mod(layerOffset(depth, layer), tile);
  const edge = Math.min(width * .15, 120);
  ctx.save(); ctx.globalAlpha = layer.opacity;
  for (const baseline of [height + 20 - shift, height + 20 - shift + tile]) {
    if (foreground) {
      // Only bottom corners are foreground: never cover the typing lanes.
      for (const side of [0, 1]) {
        const x = side ? width + 20 : -20;
        ellipse(ctx, x, height + 20, edge, 53, layer.rock);
        const nearY = height + 23 - mod(layerOffset(depth, layer), 70) * .18;
        coral(ctx, side ? width - 9 : 9, nearY, .72, layer.coral, side, time);
      }
      break;
    }
    for (let i = 0; i < 7; i++) {
      const x = width * i / 6;
      const hump = 30 + i % 3 * 13;
      ellipse(ctx, x, baseline + 10, width / 6 + 10, hump, layer.rock);
      const scale = layer.scale * Math.min(1, width / 720);
      coral(ctx, x + (i % 2 ? 18 : -15), baseline - 6, scale, layer.coral, i, time);
      // Sea grass shares the same depth plane as its rock.
      ctx.strokeStyle = layer.weed; ctx.lineWidth = 3 * scale; ctx.lineCap = 'round';
      for (let blade = 0; blade < 3; blade++) {
        ctx.beginPath(); ctx.moveTo(x + 30 + blade * 5, baseline);
        ctx.bezierCurveTo(x + 14, baseline - 23, x + 43 + Math.sin(time + i) * 4, baseline - 38, x + 29 + blade * 8, baseline - 50 - blade * 8); ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function fish(ctx, x, y, scale, color, direction, variant, time) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * direction, scale);
  const tail = Math.sin(time * 2 + variant) * 3;
  polygon(ctx, [[-10, 0], [-25, -12 + tail], [-25, 12 + tail]], color);
  ellipse(ctx, 0, 0, 17, 10, color);
  polygon(ctx, [[-4, -6], [1, -15], [8, -7]], color);
  ellipse(ctx, 4, 4, 9, 4, '#ffffff18');
  if (variant % 2) {
    ctx.strokeStyle = '#f0f6dc88'; ctx.lineWidth = 3;
    for (const stripe of [-6, 1]) { ctx.beginPath(); ctx.moveTo(stripe, -8); ctx.lineTo(stripe - 1, 7); ctx.stroke(); }
  }
  ellipse(ctx, 11, -2, 2, 2, '#153d51'); ellipse(ctx, 11, -3, .7, .7, '#fff6e5');
  ctx.restore();
}
function drawFishSchools(ctx, width, height, depth, time) {
  const schools = [
    { z: .18, y: .3, speed: 9, scale: .35, color: '#94c9cd', count: 5, dir: 1 },
    { z: .48, y: .7, speed: 15, scale: .65, color: '#e9bc6e', count: 3, dir: -1 },
    { z: .6, y: .86, speed: 11, scale: .55, color: '#e29587', count: 2, dir: 1 }
  ];
  for (const school of schools) {
    ctx.save(); ctx.globalAlpha = .25 + school.z * .55;
    const anchor = mod(time * school.speed * school.dir + width * school.z, width + 180) - 90;
    for (let i = 0; i < school.count; i++) {
      const x = mod(anchor + i * 36 * school.dir + 70, width + 140) - 70;
      const y = mod(height * school.y - depth * school.z * .8 + Math.sin(time + i) * 4, height + 70);
      fish(ctx, x, y + i % 2 * 13, school.scale * Math.min(1, width / 650), school.color, school.dir, i, time);
    }
    ctx.restore();
  }
}

// Halloween: glowing jack-o'-lanterns on the reef and a few ghostly jellyfish.
function pumpkin(ctx, x, y, size, time, seed) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  const glow = .55 + Math.sin(time * 3 + seed) * .2;
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, glow * .35)); ellipse(ctx, 0, -2, 34, 28, '#ffb347'); ctx.restore();
  ellipse(ctx, 0, 0, 22, 17, '#e8742a');
  for (const rx of [-9, 0, 9]) ellipse(ctx, rx, 0, 6, 16, '#f28a3a');
  rounded(ctx, -2, -22, 5, 8, 2, '#4f6b2a');
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, glow + .3));
  for (const ex of [-8, 8]) polygon(ctx, [[ex - 4, -2], [ex, -8], [ex + 4, -2]], '#ffe27a');
  polygon(ctx, [[-10, 5], [-5, 9], [0, 5], [5, 9], [10, 5], [6, 11], [-6, 11]], '#ffe27a');
  ctx.restore(); ctx.restore();
}
function ghostJellies(ctx, width, height, depth, time) {
  for (let i = 0; i < 3; i++) {
    const x = mod(width * (.2 + i * .3) + Math.sin(time * .3 + i) * 30, width);
    const y = mod(height * (.25 + i * .22) - time * (4 + i) - depth * .3, height + 60) - 30;
    ctx.save(); ctx.globalAlpha = .28; ctx.translate(x, y);
    ctx.fillStyle = '#efeaff'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 13, 0, Math.PI, 0); ctx.fill();
    for (let t = 0; t < 4; t++) line(ctx, [[-9 + t * 6, 0], [-9 + t * 6 + Math.sin(time * 2 + t + i) * 4, 22]], '#efeaff', 2);
    ellipse(ctx, -5, -4, 2, 2.5, '#2a2340'); ellipse(ctx, 5, -4, 2, 2.5, '#2a2340');
    ctx.restore();
  }
}
export function drawOceanBackdrop(ctx, width, height, depth, time, theme = null) {
  const deep = Math.min(1, Math.max(0, depth / 240));
  const blend = (a, b) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * deep)).join(',')})`;
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, blend([12, 135, 150], [9, 51, 78]));
  water.addColorStop(.55, blend([10, 92, 116], [9, 36, 65]));
  water.addColorStop(1, blend([7, 61, 82], [6, 24, 45]));
  ctx.fillStyle = water; ctx.fillRect(0, 0, width, height);
  // Light shafts and soft distant water haze give an atmospheric z-depth cue.
  ctx.save(); ctx.globalAlpha = 1 - deep * .6;
  for (let i = 0; i < 4; i++) {
    const x = width * (.12 + i * .25) + Math.sin(time * .12) * 8;
    const ray = ctx.createLinearGradient(x, 0, x - 60, height);
    ray.addColorStop(0, '#c6f5df12'); ray.addColorStop(1, '#c6f5df00');
    polygon(ctx, [[x, 0], [x + width * .1, 0], [x - width * .13, height]], ray);
  }
  ctx.restore();
  reefLayer(ctx, width, height, depth, time, REEF_LAYERS[0], false);
  const fog = ctx.createLinearGradient(0, 0, width, 0);
  fog.addColorStop(0, '#60bbc30a'); fog.addColorStop(.5, '#60bbc320'); fog.addColorStop(1, '#60bbc30a');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, width, height);
  drawFishSchools(ctx, width, height, depth, time);
  if (theme === 'halloween') ghostJellies(ctx, width, height, depth, time);
  reefLayer(ctx, width, height, depth, time, REEF_LAYERS[1], false);
  if (theme === 'halloween') {
    ctx.fillStyle = '#3a1f5a1c'; ctx.fillRect(0, 0, width, height);
    const tile = height + 180, shift = mod(layerOffset(depth, REEF_LAYERS[1]), tile);
    for (const baseline of [height + 20 - shift, height + 20 - shift + tile]) {
      for (let i = 1; i < 7; i += 2) pumpkin(ctx, width * i / 6 + 26, baseline - 14, Math.min(1, width / 720) * .8, time, i);
    }
  }
  for (let i = 0; i < 18; i++) {
    const z = i % 3 / 3 + .2;
    const x = (i * 173 + 51) % width;
    const y = mod(i * 67 - time * (6 + z * 10) - depth * z, height);
    ctx.strokeStyle = '#bcece333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 1 + z * 2, 0, TAU); ctx.stroke();
  }
}
export function drawOceanForeground(ctx, width, height, depth, time) {
  reefLayer(ctx, width, height, depth, time, REEF_LAYERS[2], true);
}

export function drawTreasure(ctx, x, y, scale, opened = false) {
  // Accept the original boolean API as well as an opening progress in [0, 1].
  const progress = Math.max(0, Math.min(1, Number(opened)));
  const lift = 1 - Math.pow(1 - progress, 3);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 0, 17, 45, 10, '#082d4288');
  if (progress > 0) {
    ctx.save(); ctx.globalAlpha = progress;
    const glow = ctx.createLinearGradient(0, -115, 0, 12);
    glow.addColorStop(0, '#ffdf7a00'); glow.addColorStop(1, '#ffdf7a99');
    polygon(ctx, [[-26, 0], [-74, -115], [74, -115], [26, 0]], glow);
    ctx.restore();
  }
  // A hinged lid: its front rises while the back stays attached to the chest.
  ctx.save(); ctx.translate(0, -13); ctx.rotate(-lift * .48);
  rounded(ctx, -32, -15 - lift * 30, 64, 23, 7, '#bd8550');
  line(ctx, [[-26, -8 - lift * 30], [26, -8 - lift * 30]], '#e4ab69', 2);
  for (const strap of [-23, 17]) rounded(ctx, strap, -13 - lift * 30, 6, 19, 1, '#ffd473');
  ctx.restore();
  rounded(ctx, -30, -12, 60, 32, 5, '#94623f');
  line(ctx, [[-26, 2], [26, 2]], '#6a483a', 2);
  line(ctx, [[-26, 11], [26, 11]], '#6a483a', 2);
  for (const strap of [-23, 17]) rounded(ctx, strap, -11, 6, 29, 1, '#ffd473');
  if (progress > 0) {
    ellipse(ctx, 0, -10, 25, 5 * lift, '#382c36');
    ctx.save(); ctx.globalAlpha = progress;
    for (let i = 0; i < 9; i++) {
      const cx = -20 + i * 5;
      const cy = -13 - Math.sin(i * 2.4) * 3 - lift * 6;
      ellipse(ctx, cx, cy, 5, 3, '#ffdc72');
      line(ctx, [[cx - 2, cy], [cx + 2, cy]], '#fff2b7', 1);
    }
    for (let i = 0; i < 7; i++) {
      const travel = Math.max(0, (progress - .2) / .8);
      const sx = Math.sin(i * 2.7) * (15 + travel * 40);
      const sy = -22 - travel * (28 + i * 10);
      const radius = 2 + Math.sin(progress * Math.PI) * 2;
      line(ctx, [[sx - radius, sy], [sx + radius, sy]], '#fff5c9', 2);
      line(ctx, [[sx, sy - radius], [sx, sy + radius]], '#fff5c9', 2);
    }
    ctx.restore();
  }
  rounded(ctx, -5, -9, 10, 12, 2, '#ffe094');
  ellipse(ctx, 0, -4, 1.5, 2, '#76512f');
  ctx.restore();
}

export function drawShipwreck(ctx, x, y, scale, time = 0, opened = false, treasureOffset = { x: 142, y: 14 }) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(-.13);
  ellipse(ctx, -7, 37, 176, 25, '#082d4277');
  // Broken keel and weathered planks make this unmistakably a wreck.
  ctx.fillStyle = '#526b66'; ctx.beginPath(); ctx.moveTo(-163, -37);
  ctx.lineTo(-144, -26); ctx.lineTo(-137, -47); ctx.lineTo(-122, -25);
  ctx.lineTo(-87, -25); ctx.lineTo(-72, -43); ctx.lineTo(-61, -25);
  ctx.lineTo(152, -25); ctx.quadraticCurveTo(112, 47, 41, 47);
  ctx.lineTo(-64, 38); ctx.quadraticCurveTo(-133, 28, -163, -37); ctx.fill();
  for (let i = 0; i < 4; i++) line(ctx, [[-130 + i * 8, -14 + i * 12], [127 - i * 12, -14 + i * 12]], '#2c514f', 3);
  for (const rib of [-95, -44, 10, 63, 110]) line(ctx, [[rib, -19], [rib - 6, 32]], '#82907b', 5);
  // A leaning, snapped mast and a ragged sail.
  line(ctx, [[-7, -26], [-30, -157]], '#657c6d', 8);
  line(ctx, [[-31, -141], [51, -150]], '#657c6d', 5);
  polygon(ctx, [[-28, -139], [44, -142], [37, -111], [18, -104], [25, -92], [-16, -82]], '#91afa477');
  line(ctx, [[-34, -146], [-92, -27]], '#799688', 2);
  // Cabin windows remain, but one panel has collapsed.
  polygon(ctx, [[-107, -27], [-105, -79], [-58, -76], [-47, -27]], '#657c6d');
  polygon(ctx, [[-98, -65], [-80, -63], [-77, -42], [-98, -44]], '#163f50');
  polygon(ctx, [[-72, -61], [-57, -61], [-53, -41], [-71, -42]], '#163f50');
  for (const hole of [36, 79]) ellipse(ctx, hole, -5, 10, 10, '#193e47');
  // Barnacles and algae connect the ship to the reef.
  for (let i = 0; i < 9; i++) ellipse(ctx, -103 + i * 24, 19 + i % 3 * 6, 3, 3, '#a4b59866');
  for (const root of [-125, -65, 121]) {
    ctx.strokeStyle = '#63a69b'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(root, 24); ctx.bezierCurveTo(root - 14, 2, root + 10 + Math.sin(time) * 3, -12, root - 4, -26); ctx.stroke();
  }
  ctx.restore();
  drawTreasure(ctx, x + treasureOffset.x * scale, y + treasureOffset.y * scale, scale * .8, opened);
}

export function drawOctopus(ctx, x, y, scale, time = 0, boss = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const calm = Boolean(boss.defeated);
  const quiet = (boss.maxHp || 8) - (boss.hp ?? 8);
  const charging = boss.charging && !calm;
  const strike = !calm && boss.attackTime > 0 ? Math.sin(Math.min(1, boss.attackTime / .6) * Math.PI) : 0;
  const ink = calm ? '#79aaa9' : boss.hitTime > 0 ? '#ffd4b5' : '#d47f80';
  const shade = calm ? '#477e8d' : '#874d72';
  const target = boss.target || { x: -200, y: 65 };
  // Eight distinct arms, back to front. Sampled ribbons taper without joint seams.
  const tips = [[-115, 14], [92, 6], [-94, 100], [113, 76], [-58, 124], [63, 132], [-132, 65], [26, 110]];
  for (let i = 0; i < tips.length; i++) {
    const side = tips[i][0] < 0 ? -1 : 1;
    const curled = i < quiet;
    const attacking = i === 6 && !calm;
    let [endX, endY] = tips[i];
    if (curled || calm) { endX *= .68; endY *= .8; }
    endY += Math.sin(time * 1.7 + i) * (charging ? 2 : 5);
    if (attacking) {
      endX += (target.x - endX) * strike;
      endY += (target.y - endY) * strike;
      if (charging) { endX += 24; endY -= 30; }
    }
    const p0 = [side * (18 + i % 3 * 10), 29 + i % 2 * 9];
    const p1 = [side * (58 + i % 3 * 16), 51 + i % 3 * 14];
    const p2 = [endX + side * (curled ? 33 : 46), endY + (i % 2 ? -38 : 42)];
    const point = t => p0.map((_, axis) => (1-t)**3*p0[axis] + 3*(1-t)**2*t*p1[axis] + 3*(1-t)*t*t*p2[axis] + t**3*[endX, endY][axis]);
    const upper = [], lower = [];
    for (let step = 0; step <= 24; step++) {
      const t = step / 24, a = point(t), b = point(Math.min(1, t + .01));
      const prev = step === 24 ? point(.99) : a;
      const dx = b[0] - prev[0], dy = b[1] - prev[1], length = Math.hypot(dx, dy) || 1;
      const radius = 14 * (1 - t) + 2;
      upper.push([a[0] - dy / length * radius, a[1] + dx / length * radius]);
      lower.push([a[0] + dy / length * radius, a[1] - dx / length * radius]);
    }
    polygon(ctx, [...upper, ...lower.reverse()], shade);
    const armColor = attacking && charging ? '#ffbf7d' : curled ? '#79aaa9' : ink;
    ctx.strokeStyle = armColor; ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...p1, ...p2, endX, endY); ctx.stroke();
    for (let cup = 0; cup < 8; cup++) {
      const t = .2 + cup * .095, [cx, cy] = point(t), r = 4.2 * (1 - t * .6);
      ellipse(ctx, cx, cy + 5, r + 1, r, shade);
      ellipse(ctx, cx, cy + 4, r, r * .75, '#ffe0b6');
      ellipse(ctx, cx, cy + 4, r * .4, r * .35, '#ba7f88');
    }
  }
  // A pear-shaped mantle, not a circle: heavy forehead and a narrow arm skirt.
  const head = ctx.createLinearGradient(-42, -83, 45, 52);
  head.addColorStop(0, calm ? '#a3cdc1' : '#f6b18d'); head.addColorStop(.55, ink); head.addColorStop(1, shade);
  ctx.fillStyle = head; ctx.beginPath(); ctx.moveTo(-43, 28);
  ctx.bezierCurveTo(-75, -15, -63, -87, -15, -91);
  ctx.bezierCurveTo(44, -105, 78, -37, 51, 16);
  ctx.bezierCurveTo(43, 40, 13, 50, -9, 43);
  ctx.bezierCurveTo(-27, 47, -41, 37, -43, 28); ctx.fill();
  ellipse(ctx, -24, -62, 19, 10, '#ffe3b947');
  for (const [sx, sy, r] of [[27,-62,6],[40,-45,4],[31,-79,3],[-44,-37,4],[48,-22,3]]) {
    ellipse(ctx, sx, sy, r, r * .7, '#9e57734d');
  }
  // Eyes look toward the diver. Brows change from focused to friendly at victory.
  for (const eye of [-25, 17]) {
    ellipse(ctx, eye, -3, 15, calm ? 16 : 13, '#fff0d6');
    ellipse(ctx, eye - (calm ? 0 : 4), -1, 6, 8, '#163e51');
    ellipse(ctx, eye - 6, -5, 2, 2.5, '#fff');
  }
  line(ctx, [[-42,-24], [-30,-26], [-12,-17]], shade, 5);
  line(ctx, [[3,-17], [20,-25], [32,-22]], shade, 5);
  ellipse(ctx, -41, 15, 8, 4, '#f4af9266'); ellipse(ctx, 32, 15, 8, 4, '#f4af9266');
  ctx.strokeStyle = '#633c58'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(-14, 22); ctx.quadraticCurveTo(-4, calm ? 38 : 16, 7, 22); ctx.stroke();
  if (boss.theme === 'halloween') {
    // A witch hat, tilted on the mantle.
    ctx.save(); ctx.translate(4, -92); ctx.rotate(.18);
    ellipse(ctx, 0, 0, 52, 10, '#2a1940');
    ctx.fillStyle = '#3b2457'; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-8, -58);
    ctx.quadraticCurveTo(0, -84, 34, -80); ctx.quadraticCurveTo(10, -70, 12, -52); ctx.lineTo(28, -2); ctx.closePath(); ctx.fill();
    rounded(ctx, -24, -15, 50, 9, 2, '#ff9a3c'); rounded(ctx, -4, -17, 12, 13, 2, '#ffd34f'); rounded(ctx, -.5, -13.5, 5, 6, 1, '#ff9a3c');
    ctx.restore();
  }
  // Static cues remain legible with reduced motion and while paused.
  if (charging) {
    for (let i = 0; i < 3; i++) line(ctx, [[-75-i*13, -43+i*16], [-84-i*13, -43+i*16]], '#ffdb89', 3);
  }
  ctx.restore();
}
