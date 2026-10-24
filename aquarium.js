// The aquarium: rescued album fish swim in it, and decorations bought with coins
// (or gems) can be placed or put away.
export const DECOR = [
  { id: 'algas', name: 'Algas que bailan', price: { coins: 40 }, x: .07, layer: 0 },
  { id: 'estrella', name: 'Estrella de mar', price: { coins: 40 }, x: .44, layer: 2 },
  { id: 'burbujero', name: 'Burbujero', price: { coins: 60 }, x: .33, layer: 1 },
  { id: 'coral', name: 'Coral rosa', price: { coins: 70 }, x: .86, layer: 1 },
  { id: 'farol', name: 'Farol submarino', price: { coins: 80 }, x: .95, layer: 1 },
  { id: 'cofre', name: 'Cofre del tesoro', price: { coins: 90 }, x: .62, layer: 2 },
  { id: 'arena', name: 'Arena de colores', price: { coins: 100 }, floor: true },
  { id: 'castillo', name: 'Castillo', price: { coins: 150 }, x: .2, layer: 0 },
  { id: 'barquito', name: 'Barquito hundido', price: { coins: 180 }, x: .74, layer: 0 },
  { id: 'mini-otto', name: 'Estatua de Otto', price: { gems: 3 }, x: .52, layer: 0 }
];
export const decorById = id => DECOR.find(item => item.id === id);
export const emptyAquarium = () => ({ owned: [], hidden: [] });
export function sanitizeAquarium(raw) {
  const clean = emptyAquarium();
  if (!raw || typeof raw !== 'object') return clean;
  const pick = list => DECOR.map(item => item.id).filter(id => Array.isArray(list) && list.includes(id));
  clean.owned = pick(raw.owned);
  clean.hidden = pick(raw.hidden).filter(id => clean.owned.includes(id));
  return clean;
}
export const canBuyDecor = (wallet, item) => (wallet.coins >= (item.price.coins || 0)) && (wallet.gems >= (item.price.gems || 0));
// Buying spends from the wallet and places the decoration right away.
export function buyDecor(aquarium, wallet, id) {
  const item = decorById(id);
  if (!item || aquarium.owned.includes(id) || !canBuyDecor(wallet, item)) return false;
  wallet.coins -= item.price.coins || 0; wallet.gems -= item.price.gems || 0;
  aquarium.owned = DECOR.map(entry => entry.id).filter(entry => entry === id || aquarium.owned.includes(entry));
  return true;
}
export function toggleDecor(aquarium, id) {
  if (!aquarium.owned.includes(id)) return false;
  aquarium.hidden = aquarium.hidden.includes(id) ? aquarium.hidden.filter(entry => entry !== id) : [...aquarium.hidden, id];
  return true;
}
export const shownDecor = aquarium => aquarium.owned.filter(id => !aquarium.hidden.includes(id));
