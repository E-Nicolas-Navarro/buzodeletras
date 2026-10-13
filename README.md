# Buzo de letras

Juego de mecanografía en español para chicos: escribí las palabras de los tiburones para que se alejen del buzo. El buzo salta al agua y se queda en el centro: llegan tiburones de ambos lados y cada palabra lo lleva más profundo. La misión termina al completar 24 palabras y llegar al tesoro a 240 metros, o al quedarse sin oxígeno. Sitio estático, sin dependencias, cuentas, anuncios ni servicios externos.

## Probar en tu computadora

Necesitás Node.js 22 o posterior. Desde esta carpeta:

```bash
npm run dev
```

Abrí **http://localhost:3000**. No hace falta instalar paquetes. Usá un teclado físico; el teclado de referencia tiene distribución española con Ñ. El juego también acepta entrada móvil, pero se aprende la posición de los dedos con un teclado físico.

## Publicar en Vercel

Desde esta misma carpeta, con tu cuenta de Vercel:

```bash
npx vercel login
npx vercel --prod
```

Elegí crear un proyecto nuevo si no tenés uno para este juego. `vercel.json` ya configura `npm run build` y la carpeta de salida `dist`. No hay variables de entorno ni base de datos. La opción `--prod` publica en producción: [documentación oficial de Vercel](https://vercel.com/docs/cli/deploy).

Otra opción: subir los archivos a un repositorio e importarlo desde Vercel, con preset **Other**, build **npm run build** y output **dist**. Configuración: [documentación oficial](https://vercel.com/docs/project-configuration).

## Acompañar las primeras partidas

- La opción predeterminada es **aventura con reto**. Para aprender las primeras letras sin presión, activá **Practicar sin apuro**: los tiburones no avanzan y no se pierde oxígeno.
- Colocá la mano izquierda en **A S D F**, la derecha en **J K L Ñ**, y los pulgares sobre la barra espaciadora.
- La tecla resaltada y la pista indican qué dedo usar. Volvé a la fila central después de cada letra.
- Corregí con Retroceso. No hace falta Enter. Mirá la palabra en lugar de las manos.
- Los tiburones entran alternadamente por izquierda y derecha. Elegí cualquiera escribiendo la primera letra de su palabra; después seguí esa palabra. También podés seleccionarlo con los botones debajo del mar. Si comparten primera letra, se elige el más cercano al buzo.
- Arrancás con un tiburón. Al completar 4, 8 y 12 palabras, la capacidad sube a 2, 3 y 4 simultáneos. Cada 6 palabras comienza una nueva oleada y se acercan más rápido. No hay mordidas ni violencia.
- Cada letra incorrecta consume **5% de oxígeno**. Retroceso no penaliza. Un tiburón que alcanza al buzo consume **22%** y se retira.
- Cada palabra completa suma **10 puntos por letra + bonus de racha**, recupera **3% de oxígeno** y baja **10 metros**. El oxígeno nunca supera 100%.
- Escape pausa. Cambiar de pestaña o salir de la ventana también pausa la partida, incluso durante el salto inicial.
- Las tildes del tercer nivel se escriben con la tecla de acento y luego la vocal; para Ü, con diéresis y U.

El juego orienta la técnica, pero no puede detectar qué dedos usa realmente. Un adulto puede acompañarlo al principio. Los récords de esta versión se ordenan por puntos y quedan solo en ese navegador y se distinguen por nivel y modo; no se sincronizan entre dispositivos. Si el navegador no permite guardarlos, el juego sigue funcionando.

## Diseño del océano

La escena usa **profundidad 2.5D en Canvas**, no un motor 3D. Las ilustraciones son código local, sin imágenes descargadas ni nuevas dependencias.

- **Barco:** casco curvo, cabina con ventanas, barandas, bandera, salvavidas, escalera y reflejo sobre el agua.
- **Buzo:** traje de neopreno, máscara, tanque con correas, regulador, manómetro, aletas y linterna con luz suave.
- **Arrecife:** rocas, coral ramificado, esponjas y abanicos marinos en tres planos. Los lejanos son más pequeños y difusos; los cercanos, más contrastados.
- **Profundidad:** cada plano se desplaza a distinta velocidad al bajar; el agua se oscurece y los rayos de luz se atenúan. Los corales de primer plano quedan en las esquinas para no tapar las palabras.
- **Peces:** tres pequeños cardúmenes decorativos con escala, color y velocidad distintos. No son enemigos ni afectan el oxígeno.

La pausa congela también peces, burbujas y movimiento del barco. La preferencia del sistema de movimiento reducido deja la decoración quieta y cambia de profundidad sin desplazamiento animado.

## Verificar y modificar

```bash
npm test
npm run build
```

Para ver los quince casos por separado con Node reciente: `node --test --test-isolation=none`.

| Archivo | Función |
| --- | --- |
| `index.html` | Pantallas, opciones y ayuda |
| `style.css` | Diseño adaptable, colores de dedos y movimiento reducido |
| `engine.js` | Reglas deterministas: tiburones, oleadas, objetivos, oxígeno, puntos y profundidad |
| `game.js` | Control de partida, composición de escena, sonidos y récords locales |
| `visuals.js` | Ilustraciones y capas 2.5D del barco, buzo, arrecifes y peces |
| `tests/` | Pruebas de reglas y controlador con DOM/Canvas simulados |
| `build.mjs` | Copia los cinco archivos públicos a `dist/` |
| `server.mjs` | Servidor local sin dependencias |

Para cambiar vocabulario o tiempo base de acercamiento, editá `LEVELS` en `engine.js`. Los costos y recuperación de oxígeno están en `OXYGEN`, y la meta en `MISSION_WORDS`. El estado de los tiburones vive en el motor, separado del dibujo; la pausa congela también sus posiciones y la aparición de nuevos enemigos.

### Estado de verificación

15 casos aprobados: salto inicial y pausa, misión de 24 palabras, errores/correcciones, Ñ/tildes, pérdida y recuperación de oxígeno, colisiones sin daño duplicado, hasta cuatro tiburones distintos en carriles separados, selección por primera letra, dificultad progresiva, puntuación/profundidad, ayuda, avance de nivel y almacenamiento bloqueado; rutas Canvas válidas, aislamiento del contexto, parallax, límites de dibujo y empaquetado de ilustraciones. Build estático verificado.

Se revisaron las ilustraciones aisladas en escritorio y pantalla chica mediante un replay de operaciones Canvas con Cairo. No es una captura de navegador. Este entorno no permitió abrir sockets locales ni ejecutar Chromium, por lo que **falta revisar la página completa y una partida en navegador real**. La conexión de Vercel CLI también falló; **no está publicado**. Antes de compartirlo, probalo con teclado físico en una computadora y revisá el diseño en una pantalla chica.

La unidad de esta revisión es el modo aventura con múltiples amenazas. Su límite de reversión es el motor/controlador, los indicadores e instrucciones en HTML/CSS, y las pruebas/documentación asociadas. La configuración de Vercel conserva el mismo preset; build y servidor local incluyen ahora el módulo de ilustraciones. Los récords nuevos usan `buzo-records-v2` para no mezclar puntos con las misiones anteriores de 12 palabras.

La revisión visual se puede revertir quitando `visuals.js` y sus importaciones/dibujos en `game.js`, junto con las entradas del módulo en build/servidor y sus pruebas. Las reglas de oxígeno, puntos, amenazas y progresión en `engine.js` no cambiaron.
