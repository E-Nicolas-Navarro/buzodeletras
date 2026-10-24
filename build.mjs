import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js', 'engine.js', 'visuals.js', 'skins.js', 'net.js', 'save.js', 'events.js', 'hands.js', 'album.js', 'missions.js', 'words.js', 'aquarium.js']) await copyFile(file, `dist/${file}`);
console.log('Sitio estático generado en dist/');
