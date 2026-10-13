// Diver outfits. Palettes only: every skin shares the same drawing code.
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
    palette: { ...CLASSIC, legFar: '#8a6420', legNear: '#b88a2e', arm: '#b88a2e', suit0: '#9a6f22', suit1: '#f1c453', suit2: '#b88a2e', collar: '#fff1c2', hood: '#8a6420', band: '#fff1c2', frame: '#ffe9a0', fin: '#fff1c2', finDark: '#e5cf8c', finLine: '#a8873a', glove: '#fff1c2' } }
];
// Accessories are separate from outfits: one per slot, mixed with any skin.
export const SLOTS = [
  { id: 'mask', title: 'Máscaras' }, { id: 'fins', title: 'Patas de rana' },
  { id: 'head', title: 'Sombreros' }, { id: 'hand', title: 'En mano' }
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
  { id: 'tridente', slot: 'hand', name: 'Tridente', blurb: 'Rey del océano.', price: { coins: 0, gems: 8 } }
];
export const accessoryById = id => ACCESSORIES.find(item => item.id === id);
const CATALOG = [...SKINS, ...ACCESSORIES];
export const skinById = id => SKINS.find(skin => skin.id === id) || SKINS[0];

export const emptyWallet = () => ({ coins: 0, gems: 0, owned: ['clasico'], equipped: 'clasico', gear: { mask: null, fins: null, head: null, hand: null } });
// Accepts whatever came out of localStorage and returns a safe wallet.
export function sanitizeWallet(raw) {
  const wallet = emptyWallet();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return wallet;
  const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  wallet.coins = count(raw.coins); wallet.gems = count(raw.gems);
  if (Array.isArray(raw.owned)) wallet.owned = [...new Set(['clasico', ...raw.owned.filter(id => CATALOG.some(item => item.id === id))])];
  wallet.equipped = SKINS.some(skin => skin.id === raw.equipped) && wallet.owned.includes(raw.equipped) ? raw.equipped : 'clasico';
  for (const { id: slot } of SLOTS) {
    const id = raw.gear?.[slot], item = accessoryById(id);
    if (item?.slot === slot && wallet.owned.includes(id)) wallet.gear[slot] = id;
  }
  return wallet;
}
export function canAfford(wallet, skin) { return wallet.coins >= skin.price.coins && wallet.gems >= skin.price.gems; }
// Returns true when the skin was bought; owned skins are never charged twice.
export function buySkin(wallet, id) {
  const skin = CATALOG.find(item => item.id === id);
  if (!skin || wallet.owned.includes(id) || !canAfford(wallet, skin)) return false;
  wallet.coins -= skin.price.coins; wallet.gems -= skin.price.gems; wallet.owned.push(id);
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
