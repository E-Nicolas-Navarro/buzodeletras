// Diver outfits. Every skin shares the same drawing code: a palette, plus an optional
// suit pattern and an `extra` piece (hood, tail, cape…) drawn by visuals.js.
// `event` items are sold only while that season is on (see events.js) and cost candy.
const CLASSIC = {
  legFar: '#11334a', legNear: '#214c60', arm: '#214c60',
  suit0: '#12344a', suit1: '#29576b', suit2: '#163f50',
  collar: '#f5c75f', hood: '#173b50', band: '#ffdb70', frame: '#ffd572',
  fin: '#ffc85b', finDark: '#efab42', finLine: '#bb8b35', glove: '#f4c465'
};
export const SKINS = [
  { id: 'clasico', name: 'Buzo clásico', blurb: 'El traje de siempre.', price: { coins: 0, gems: 0 }, palette: CLASSIC },
  { id: 'coral', name: 'Buzo coral', blurb: 'Rosa como el arrecife.', price: { coins: 200, gems: 0 },
    palette: { ...CLASSIC, legFar: '#6b2b44', legNear: '#8f3d58', arm: '#8f3d58', suit0: '#7a3049', suit1: '#c4607a', suit2: '#8f3d58', collar: '#ffe0a2', hood: '#6b2b44', band: '#ffc9b5', frame: '#ffb5a0', fin: '#7bd7c4', finDark: '#4fb8a5', finLine: '#2f8a7b', glove: '#ffd9c4' } },
  { id: 'pirata', name: 'Buzo pirata', blurb: 'Pañuelo rojo y rumbo al tesoro.', price: { coins: 350, gems: 2 }, extra: 'bandana',
    palette: { ...CLASSIC, legFar: '#1c1c26', legNear: '#2e2e3d', arm: '#2e2e3d', suit0: '#22222e', suit1: '#454560', suit2: '#2e2e3d', collar: '#e8e1cf', hood: '#22222e', band: '#d9534f', frame: '#c9a24b', fin: '#d9534f', finDark: '#a93a38', finLine: '#6e2323', glove: '#e8e1cf' } },
  { id: 'astronauta', name: 'Buzo astronauta', blurb: 'Blanco brillante, como en el espacio.', price: { coins: 400, gems: 4 },
    palette: { ...CLASSIC, legFar: '#aab9c4', legNear: '#d3dde3', arm: '#d3dde3', suit0: '#c3d0d8', suit1: '#f3f7f9', suit2: '#d3dde3', collar: '#ef8f83', hood: '#aab9c4', band: '#ef8f83', frame: '#e5edf1', fin: '#ef8f83', finDark: '#cf6f63', finLine: '#9a4b43', glove: '#ef8f83' } },
  { id: 'aurora', name: 'Buzo aurora', blurb: 'Colores de luces del norte.', price: { coins: 500, gems: 6 },
    palette: { ...CLASSIC, legFar: '#3a2a6b', legNear: '#5a45a8', arm: '#5a45a8', suit0: '#3f2e78', suit1: '#7e66d6', suit2: '#5a45a8', collar: '#8dd8bd', hood: '#3a2a6b', band: '#8dd8bd', frame: '#b79cff', fin: '#8dd8bd', finDark: '#5fb89c', finLine: '#2f7d68', glove: '#cdbdff' } },
  { id: 'dorado', name: 'Buzo dorado', blurb: 'Con corona. Solo para campeones.', price: { coins: 0, gems: 12 }, extra: 'crown',
    palette: { ...CLASSIC, legFar: '#8a6420', legNear: '#b88a2e', arm: '#b88a2e', suit0: '#9a6f22', suit1: '#f1c453', suit2: '#b88a2e', collar: '#fff1c2', hood: '#8a6420', band: '#fff1c2', frame: '#ffe9a0', fin: '#fff1c2', finDark: '#e5cf8c', finLine: '#a8873a', glove: '#fff1c2' } },
  { id: 'abeja', name: 'Buzo abeja', blurb: 'Bzzz… rayas y antenas.', price: { coins: 300, gems: 1 }, extra: 'antennae', pattern: { type: 'stripes', color: '#1c1c26' },
    palette: { ...CLASSIC, legFar: '#1c1c26', legNear: '#2e2e3d', arm: '#e9b52f', suit0: '#d9a21f', suit1: '#ffd34f', suit2: '#e9b52f', collar: '#fff1c2', hood: '#1c1c26', band: '#ffd34f', frame: '#ffd34f', fin: '#1c1c26', finDark: '#0e0e14', finLine: '#ffd34f', glove: '#1c1c26' } },
  { id: 'dino', name: 'Buzo dinosaurio', blurb: 'Púas en la espalda. ¡Grrr!', price: { coins: 400, gems: 2 }, extra: 'spikes', pattern: { type: 'spots', color: '#3f8a3a' },
    palette: { ...CLASSIC, legFar: '#3f7a35', legNear: '#5aa04a', arm: '#5aa04a', suit0: '#4a8e3e', suit1: '#7cc45f', suit2: '#5aa04a', collar: '#f5e27a', hood: '#3f7a35', band: '#f5e27a', frame: '#f5e27a', fin: '#f5a04a', finDark: '#d97f2c', finLine: '#8a4d17', glove: '#9ad67a' } },
  { id: 'tiburon', name: 'Buzo tiburón', blurb: 'Capucha con dientes y aleta.', price: { coins: 450, gems: 3 }, extra: 'sharkHood',
    palette: { ...CLASSIC, legFar: '#4f6f80', legNear: '#6f93a5', arm: '#6f93a5', suit0: '#5a7d8f', suit1: '#9cc3d2', suit2: '#6f93a5', collar: '#f1f6f7', hood: '#6f93a5', band: '#f1f6f7', frame: '#d5e4ea', fin: '#6f93a5', finDark: '#4f6f80', finLine: '#2f4a58', glove: '#d5e4ea' } },
  { id: 'heroe', name: 'Súper buzo', blurb: 'Capa que flota y una estrella.', price: { coins: 450, gems: 3 }, extra: 'cape',
    palette: { ...CLASSIC, legFar: '#1f3f8f', legNear: '#2f56b8', arm: '#2f56b8', suit0: '#24489f', suit1: '#4a7ae0', suit2: '#2f56b8', collar: '#ffd34f', hood: '#1f3f8f', band: '#e64b4b', frame: '#e64b4b', fin: '#e64b4b', finDark: '#b83434', finLine: '#7a1f1f', glove: '#e64b4b', cape: '#e64b4b' } },
  { id: 'sirena', name: 'Buzo sirena', blurb: 'Cola con escamas en vez de patas.', price: { coins: 500, gems: 4 }, extra: 'tail', pattern: { type: 'scales', color: '#ffffff30' },
    palette: { ...CLASSIC, legFar: '#1f8a8a', legNear: '#2fb0a8', arm: '#7e66d6', suit0: '#5a45a8', suit1: '#9b85ea', suit2: '#7e66d6', collar: '#ffd1e8', hood: '#5a45a8', band: '#ffd1e8', frame: '#ffd1e8', fin: '#2fb0a8', finDark: '#1f8a8a', finLine: '#c8fff4', glove: '#ffd1e8' } },
  // Halloween: sold only during the season, paid with candy.
  { id: 'esqueleto', name: 'Buzo esqueleto', blurb: 'Huesitos que brillan en lo oscuro.', price: { candy: 60 }, event: 'halloween', extra: 'skull', pattern: { type: 'bones', color: '#f1f1e6' },
    palette: { ...CLASSIC, legFar: '#15151c', legNear: '#22222c', arm: '#22222c', suit0: '#16161e', suit1: '#30303e', suit2: '#22222c', collar: '#f1f1e6', hood: '#16161e', band: '#9cff8a', frame: '#9cff8a', fin: '#22222c', finDark: '#15151c', finLine: '#f1f1e6', glove: '#f1f1e6' } },
  { id: 'calabaza', name: 'Buzo calabaza', blurb: 'Naranja, con tallo y hojita.', price: { candy: 45 }, event: 'halloween', extra: 'pumpkin', pattern: { type: 'ridges', color: '#c9541f' },
    palette: { ...CLASSIC, legFar: '#2d5a2a', legNear: '#3f7a35', arm: '#ef7f2c', suit0: '#d9661f', suit1: '#ffa04a', suit2: '#ef7f2c', collar: '#5aa04a', hood: '#d9661f', band: '#5aa04a', frame: '#3f7a35', fin: '#3f7a35', finDark: '#2d5a2a', finLine: '#1b3a19', glove: '#5aa04a' } }
];
// Accessories are separate from outfits: one per slot, mixed with any skin.
export const SLOTS = [
  { id: 'mask', title: 'Máscaras' }, { id: 'fins', title: 'Patas de rana' },
  { id: 'head', title: 'Sombreros' }, { id: 'hand', title: 'En mano' },
  { id: 'back', title: 'Espalda' }, { id: 'pet', title: 'Mascotas' }, { id: 'trail', title: 'Estelas' }
];
export const ACCESSORIES = [
  { id: 'mascara-sol', slot: 'mask', name: 'Gafas de sol', blurb: 'Para bucear con onda.', price: { coins: 120, gems: 0 } },
  { id: 'mascara-corazon', slot: 'mask', name: 'Máscara corazón', blurb: 'Mira el mar con amor.', price: { coins: 180, gems: 0 } },
  { id: 'mascara-robot', slot: 'mask', name: 'Visor robot', blurb: 'Bip bip, océano detectado.', price: { coins: 250, gems: 2 } },
  { id: 'patas-rana', slot: 'fins', name: 'Patas de rana', blurb: 'Verdes, con dedos y todo.', price: { coins: 150, gems: 0 } },
  { id: 'patas-flamenco', slot: 'fins', name: 'Patas de flamenco', blurb: 'Rosa furioso.', price: { coins: 150, gems: 0 } },
  { id: 'patas-fuego', slot: 'fins', name: 'Patas de fuego', blurb: 'Naranja ardiente.', price: { coins: 220, gems: 2 } },
  { id: 'sombrero-copa', slot: 'head', name: 'Sombrero de copa', blurb: 'Muy elegante bajo el agua.', price: { coins: 200, gems: 0 } },
  { id: 'sombrero-vaquero', slot: 'head', name: 'Sombrero vaquero', blurb: 'Yiiija, tiburones.', price: { coins: 220, gems: 0 } },
  { id: 'gorro-cumple', slot: 'head', name: 'Gorro de cumple', blurb: '¡Fiesta en el fondo del mar!', price: { coins: 100, gems: 1 } },
  { id: 'maceta', slot: 'head', name: 'Maceta con flor', blurb: 'Un jardín en la cabeza.', price: { coins: 300, gems: 3 } },
  { id: 'guitarra', slot: 'hand', name: 'Guitarra', blurb: 'Concierto para peces.', price: { coins: 300, gems: 3 } },
  { id: 'pato', slot: 'hand', name: 'Patito de goma', blurb: 'Flota y no se hunde.', price: { coins: 120, gems: 1 } },
  { id: 'tridente', slot: 'hand', name: 'Tridente', blurb: 'Rey del océano.', price: { coins: 0, gems: 8 } },
  { id: 'helado', slot: 'hand', name: 'Helado', blurb: 'Dos bochas, no se derrite.', price: { coins: 110, gems: 0 } },
  { id: 'globo', slot: 'hand', name: 'Globo', blurb: 'Sube aunque estés abajo.', price: { coins: 140, gems: 0 } },
  { id: 'red-pesca', slot: 'hand', name: 'Red de pesca', blurb: 'Para atrapar letras.', price: { coins: 180, gems: 1 } },
  { id: 'varita', slot: 'hand', name: 'Varita mágica', blurb: 'Bibidi bubu burbujas.', price: { coins: 220, gems: 2 } },
  { id: 'espada-pirata', slot: 'hand', name: 'Espada pirata', blurb: '¡Al abordaje!', price: { coins: 260, gems: 2 } },
  { id: 'alas-mariposa', slot: 'back', name: 'Alas de mariposa', blurb: 'Aletean despacito.', price: { coins: 180, gems: 0 } },
  { id: 'caparazon', slot: 'back', name: 'Caparazón de tortuga', blurb: 'Tu casa a cuestas.', price: { coins: 220, gems: 1 } },
  { id: 'cohete', slot: 'back', name: 'Mochila cohete', blurb: '¡Turbo burbujas!', price: { coins: 320, gems: 3 } },
  { id: 'pez-payaso', slot: 'pet', name: 'Pez payaso', blurb: 'Te sigue a todos lados.', price: { coins: 150, gems: 0 } },
  { id: 'tortuga', slot: 'pet', name: 'Tortuguita', blurb: 'Lenta pero fiel.', price: { coins: 250, gems: 1 } },
  { id: 'medusa', slot: 'pet', name: 'Medusa', blurb: 'Brilla y no pica.', price: { coins: 220, gems: 2 } },
  { id: 'mini-otto', slot: 'pet', name: 'Mini Otto', blurb: 'El sobrino de Otto.', price: { coins: 0, gems: 6 } },
  { id: 'estela-corazones', slot: 'trail', name: 'Estela de corazones', blurb: 'Dejá amor a tu paso.', price: { coins: 150, gems: 0 } },
  { id: 'estela-estrellas', slot: 'trail', name: 'Estela de estrellas', blurb: 'Brillitos detrás tuyo.', price: { coins: 180, gems: 0 } },
  { id: 'estela-arcoiris', slot: 'trail', name: 'Estela arcoíris', blurb: 'Burbujas de todos los colores.', price: { coins: 220, gems: 2 } },
  { id: 'sombrero-bruja', slot: 'head', name: 'Sombrero de bruja', blurb: 'Con hebilla y todo.', price: { candy: 30 }, event: 'halloween' },
  { id: 'fantasmita', slot: 'pet', name: 'Fantasmita', blurb: 'Buuu… pero amigable.', price: { candy: 40 }, event: 'halloween' },
  { id: 'estela-murcielagos', slot: 'trail', name: 'Estela de murciélagos', blurb: 'Una bandada chiquita.', price: { candy: 35 }, event: 'halloween' }
];
export const accessoryById = id => ACCESSORIES.find(item => item.id === id);
const CATALOG = [...SKINS, ...ACCESSORIES];
export const skinById = id => SKINS.find(skin => skin.id === id) || SKINS[0];

export const priceOf = item => ({ coins: item.price.coins || 0, gems: item.price.gems || 0, candy: item.price.candy || 0 });
// An item is on sale when it is not seasonal, or its season is on now.
export const onSale = (item, event = null) => !item.event || item.event === event;
export const emptyWallet = () => ({ coins: 0, gems: 0, candy: 0, owned: ['clasico'], equipped: 'clasico', gear: Object.fromEntries(SLOTS.map(slot => [slot.id, null])) });
// Accepts whatever came out of localStorage and returns a safe wallet.
export function sanitizeWallet(raw) {
  const wallet = emptyWallet();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return wallet;
  const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  wallet.coins = count(raw.coins); wallet.gems = count(raw.gems); wallet.candy = count(raw.candy);
  if (Array.isArray(raw.owned)) wallet.owned = [...new Set(['clasico', ...raw.owned.filter(id => CATALOG.some(item => item.id === id))])];
  wallet.equipped = SKINS.some(skin => skin.id === raw.equipped) && wallet.owned.includes(raw.equipped) ? raw.equipped : 'clasico';
  for (const { id: slot } of SLOTS) {
    const id = raw.gear?.[slot], item = accessoryById(id);
    if (item?.slot === slot && wallet.owned.includes(id)) wallet.gear[slot] = id;
  }
  return wallet;
}
export function canAfford(wallet, item) {
  const price = priceOf(item);
  return wallet.coins >= price.coins && wallet.gems >= price.gems && (wallet.candy || 0) >= price.candy;
}
// Returns true when the item was bought; owned items are never charged twice.
// Seasonal items can only be bought while their event is on.
export function buySkin(wallet, id, event = null) {
  const item = CATALOG.find(entry => entry.id === id);
  if (!item || wallet.owned.includes(id) || !onSale(item, event) || !canAfford(wallet, item)) return false;
  const price = priceOf(item);
  wallet.coins -= price.coins; wallet.gems -= price.gems; wallet.candy = (wallet.candy || 0) - price.candy; wallet.owned.push(id);
  return true;
}
export function equipSkin(wallet, id) {
  if (!wallet.owned.includes(id) || !SKINS.some(skin => skin.id === id)) return false;
  wallet.equipped = id; return true;
}
// id = null takes the accessory off.
export function equipGear(wallet, slot, id) {
  if (id === null) { if (!(slot in wallet.gear)) return false; wallet.gear[slot] = null; return true; }
  const item = accessoryById(id);
  if (!item || item.slot !== slot || !wallet.owned.includes(id)) return false;
  wallet.gear[slot] = id; return true;
}
