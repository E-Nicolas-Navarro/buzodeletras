import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js', 'engine.js', 'visuals.js', 'skins.js']) await copyFile(file, `dist/${file}`);
console.log('Sitio estático generado en dist/');
