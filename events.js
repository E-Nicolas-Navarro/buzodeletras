// Seasonal events, decided only by the device's date: no server involved.
// A season adds themed words, decorations and items sold for candy while it lasts.
export const EVENTS = [
  {
    id: 'halloween', name: 'Halloween bajo el mar', currency: 'caramelos',
    // From October 15 to November 5, inclusive (months are 1-based here).
    from: [10, 15], to: [11, 5],
    blurb: 'Calabazas en el arrecife, tiburones disfrazados y Otto con sombrero de bruja. Ganá caramelos con cada palabra.',
    words: [['bruja', 'gato', 'luna', 'miedo', 'dulce', 'capa', 'mago', 'búho'],
      ['calabaza', 'fantasma', 'murciélago', 'esqueleto', 'caramelo', 'disfraz', 'vampiro', 'telaraña', 'escoba', 'monstruo']]
  }
];
const dayOfYear = (month, day) => month * 100 + day;
export function eventOn(date = new Date()) {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  return EVENTS.find(event => {
    const from = dayOfYear(...event.from), to = dayOfYear(...event.to);
    return from <= to ? today >= from && today <= to : today >= from || today <= to;
  }) || null;
}
// `?evento=halloween` previews a season and `?evento=no` turns it off, handy for testing.
export function currentEvent(search = '', date = new Date()) {
  const forced = new URLSearchParams(search).get('evento');
  if (forced === 'no') return null;
  return EVENTS.find(event => event.id === forced) || eventOn(date);
}
// Level 1 trains home-row keys only, so seasonal words start at level 2.
export function eventWords(event, level) {
  if (!event || level === 0) return [];
  return event.words[level - 1] || [];
}
