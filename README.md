# Buzo de letras

Juego de mecanografía en español para chicos: escribí las palabras de los tiburones para que se alejen del buzo. El buzo salta al agua y se queda en el centro: llegan tiburones de ambos lados y cada palabra lo lleva más profundo. Tras completar 24 palabras llegás al naufragio a 240 metros: superá las ocho frases de Otto para abrir el tesoro. Al quedarse sin oxígeno termina la expedición. Sitio estático, sin cuentas ni anuncios. El modo solo no usa servicios externos; el modo de a dos usa PeerJS (ver más abajo).

## Pantallas

- **Inicio y resultados** son «menús»: la escena ocupa todo el alto disponible y el teclado guía se oculta hasta que empieza la inmersión, así nada necesita barras de desplazamiento internas. Los resultados muestran a la izquierda lo que pasó (estrellas, cifras y botones) y a la derecha «Lo que ganaste»; en el celular van en una columna y se recorren con el scroll de la página.
- **Tienda, Acuario, Misiones, Mi progreso, Mis palabras, Ayuda, De a dos y Panel para adultos** se abren como pantallas completas con una barra superior (título y «← Volver»), en lugar de ventanas flotantes.

## Mundos y guardianes

Cinco mundos en orden de aprendizaje. Cada uno termina en una batalla de ocho frases contra su guardián:

| Mundo | Letras | Guardián |
|---|---|---|
| 1 · Fila central | A S D F G H J K L Ñ | Otto, el pulpo |
| 2 · Fila de arriba | Fila de arriba + fila central | Don Pinza, el cangrejo (calmás sus 8 patas) |
| 3 · Fila de abajo | Todas, con palabras llenas de Z X C V B N M | La Reina Medusa (sus tentáculos dan chispas) |
| 4 · Palabras del mar | Todo el teclado, palabras cortas | Otto |
| 5 · Todo el teclado | Palabras largas con tildes y Ñ | Otto |

El progreso (estrellas y récords) se guarda por mundo (`centro`, `arriba`, `abajo`, `laguna`, `mar`). Las partidas guardadas con la versión de tres niveles se convierten solas, también al restaurar un respaldo viejo.

### Álbum de letras

Cada tecla de las tres filas es un **pez** (27 en total). Se rescata al escribir esa letra bien 15 veces mientras los últimos 20 intentos tengan al menos 85 % de aciertos. Cada pez nuevo da 20 monedas; cada fila completa, 3 gemas; el álbum completo, 10 gemas. El álbum detecta las letras que más cuestan (las de menor puntería reciente) y las muestra como «¡Practicala!»: en la próxima inmersión hasta la mitad del mazo son palabras con esas letras. Se guarda en este navegador (`buzo-album-v1`) y viaja en el código de respaldo; los códigos viejos sin álbum restauran uno vacío.

### Código de familia (progreso en línea)

En «Mi progreso», «Crear mi código de familia» guarda el progreso en internet bajo un código como `ORCA-4821-SOL` (palabra del mar, número, otra palabra): sin cuenta, email ni datos personales. En otro dispositivo, «Usar un código que ya tengo» lo carga (muestra antes qué se reemplaza). Desde ahí se guarda solo después de cada partida, compra o cambio, y al abrir el juego se trae lo más nuevo.

- **Choques:** cada guardado indica sobre qué versión se hizo. Si otro dispositivo guardó en el medio, no se pisa nada: «Mi progreso» (con punto rojo) pregunta si usar lo guardado en internet o lo de este dispositivo.
- **Servidor:** la función `api/progress.js` (Vercel Functions) guarda el mismo código de respaldo de `save.js` en Upstash Redis (`buzo:familia:<código>`, se renueva por 400 días con cada guardado), con un script Lua atómico y un límite de 40 pedidos por minuto por IP para que no se puedan probar códigos al azar. Producción usa sus propias claves; las previsualizaciones y las pruebas locales usan `buzo:<entorno>:familia:`.
- **Local:** `vercel env pull` deja las credenciales en `.env.local` y `npm run dev` también sirve `/api/progress` (con las claves de desarrollo). Sin `.env.local` el juego funciona igual; solo el código de familia avisa que no está disponible.

### Panel para adultos

El enlace «Panel para adultos» del pie de página abre un resumen pensado para padres y docentes (no aparece en el menú del chico):

- **Esta semana contra la anterior:** minutos de práctica, velocidad (letras correctas por minuto de escritura, sin contar la bajada ni el frenesí), precisión y días con práctica.
- **Últimas 20 inmersiones:** dos gráficos chicos (velocidad y precisión, cada uno con su propio eje), con una línea vertical que sigue al puntero o a las flechas del teclado y un cuadro con el valor. Hay una vista de tabla con todas las cifras.
- **Errores por tecla:** el teclado coloreado según los últimos 20 intentos de cada letra (un solo tono, más oscuro = más errores).
- **Precisión por dedo** y **consejos** que salen de esos números.

La historia de partidas se guarda en `buzo-history-v1` (hasta 200 inmersiones; el código de respaldo lleva las últimas 60). Nada sale del navegador.

### Mis palabras

Desde la pantalla de inicio («✏️ Mis palabras») se guardan hasta 20 palabras propias: nombres, mascotas, amigos o cosas favoritas (solo letras, de 2 a 14, con tildes y Ñ). Aparecen en los tiburones con una ★ y hasta cuatro van al principio del mazo. Los mundos que usan todo el teclado las aceptan todas; los mundos de la fila central y de la fila de arriba solo las que se escriben con sus letras, para no romper la práctica de esas filas. Se pueden apagar sin borrarlas. Se guardan en `buzo-words-v1` y viajan en el respaldo.

### Acuario

El botón «Acuario» abre el acuario y el álbum: los peces rescatados nadan con su letra en el costado, y el acuario se decora con 10 objetos (algas, estrella de mar, burbujero, coral, farol, cofre, arena de colores, castillo, barquito hundido y una estatua de Otto que se paga con gemas). Cada decoración comprada se puede poner o guardar. Se guarda en `buzo-aquarium-v1` y viaja en el respaldo.

### Misiones del día, racha y medallas

- **Tres misiones por día** (botón «Misiones» del encabezado): una fácil (palabras, inmersiones o letras), una de habilidad (racha, precisión, guardián, tesoros o ganar sin tiburones) y una de exploración (una fila o un mundo). Se eligen con la fecha del dispositivo, avanzan con cada inmersión del día y pagan entre 30 y 70 monedas; las tres juntas dan 2 gemas más.
- **Racha:** días seguidos con al menos una misión cumplida. Da 1 gema a los 3 días y 3 gemas a los 7 (y cada 7 después). Se pierde si pasa un día entero sin misiones.
- **20 medallas** permanentes con premio propio: cada guardián, ganar sin un rasguño, rachas de 20 y 50 palabras, una partida perfecta, tesoros, ballena, tiburón dorado, peces del álbum, estrellas en los cinco mundos, ganar de a dos, una semana de racha y cinco objetos de la tienda.

Todo se calcula al terminar cada inmersión y aparece en los resultados. Se guarda en `buzo-missions-v1` y viaja en el código de respaldo.

### Teclado guía

El botón «Ocultar teclado guía» saca el teclado de referencia y las manos fantasma, y centra el panel donde se escribe. La elección se recuerda (`buzo-keyboard-v1`). Las manos fantasma son de «vidrio»: un contorno claro con relleno muy suave, así las letras se leen debajo; solo el dedo que tiene que tocar se pinta de su color.

### Frenesí del tesoro

Al vencer al guardián en modo desafío, durante 15 segundos el barco de la expedición tira monedas y gemas desde la superficie, sin apuro: tardan unos 8 segundos en llegar al fondo y hay como mucho cuatro a la vez. Se atrapan escribiendo su palabra: **puntos ×2** más un combo por cada atrapada seguida, y sin oxígeno en juego (lo que toca el fondo solo corta el combo). Paga 10 monedas por tesoro y hasta 2 gemas. En práctica no hay frenesí.

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
- **Manos guía:** debajo del mar está el teclado con dos manos fantasma semitransparentes. Cada dedo descansa en su tecla de la fila central, y el que hay que usar para la próxima letra se ilumina con su color y se estira hasta la tecla. Se apagan con **Manos guía: no** (queda guardado en el navegador) cuando ya no hacen falta.
- La palabra se escribe en el panel de abajo, letra por letra: verde si está bien, roja si está mal y amarilla la que sigue.
- Los tiburones entran alternadamente por izquierda y derecha. Elegí cualquiera escribiendo la primera letra de su palabra; después seguí esa palabra. También podés seleccionarlo con los botones debajo del mar. Si comparten primera letra, se elige el más cercano al buzo.
- Arrancás con un tiburón. Al completar 4, 8 y 12 palabras, la capacidad sube a 2, 3 y 4 simultáneos. Cada 6 palabras comienza una nueva oleada y se acercan más rápido. No hay mordidas ni violencia.
- Cada letra incorrecta consume **5% de oxígeno**. Retroceso no penaliza. Un tiburón que alcanza al buzo consume **22%** y se retira.
- Cada palabra completa suma **10 puntos por letra + bonus de racha**, recupera **3% de oxígeno** y baja **10 metros**. El oxígeno nunca supera 100%.
- Escape pausa. Cambiar de pestaña o salir de la ventana también pausa la partida, incluso durante el salto inicial.
- Las tildes del tercer nivel se escriben con la tecla de acento y luego la vocal; para Ü, con diéresis y U.

El juego orienta la técnica, pero no puede detectar qué dedos usa realmente. Un adulto puede acompañarlo al principio. Los récords de esta versión se ordenan por puntos y quedan solo en ese navegador y se distinguen por nivel y modo; no se sincronizan entre dispositivos. Si el navegador no permite guardarlos, el juego sigue funcionando.

## Tienda y recompensas

Al terminar un nivel se ganan **monedas de oro** y **gemas** (se guardan en este navegador). Con ellas se compran trajes y accesorios en la **Tienda** (botón del encabezado o de la pantalla de resultados).

- **Trajes:** además de los de colores, hay abeja (rayas y antenas), dinosaurio (púas), tiburón (capucha con dientes y aleta), súper buzo (capa que flota) y sirena (cola en vez de patas).
- **Accesorios por lugar:** máscaras, patas de rana, sombreros, en mano, **espalda** (alas de mariposa, caparazón, mochila cohete), **mascotas** que te acompañan (pez payaso, tortuguita, medusa, mini Otto) y **estelas** (corazones, estrellas, arcoíris).
- **Visitas sorpresa:** una **ballena amiga** por partida (desde la palabra 8) da 12 % de oxígeno y nunca choca; los **tiburones dorados** (hasta dos por partida) dan 1 gema aunque no termines el nivel.
- Las palabras cortas llegan como **peces globo**, las largas (7 letras o más) como **tiburones martillo**.

- Nivel completado: monedas según puntos y nivel, más 1 a 3 gemas.
- **Bonus de tiburones:** si ningún tiburón te toca, +120 monedas y +3 gemas; si te alcanzan 1 o 2, +50 monedas y +1 gema.
- **Letras casi perfectas** (95 % de precisión o más): +50 monedas.
- Si te quedás sin oxígeno ganás 3 monedas por palabra; en modo sin apuro, 2 por palabra. Sin gemas ni bonus.

## Eventos de temporada

Se activan solos según la fecha del dispositivo, sin servidor (`events.js`). **Halloween bajo el mar** va del 15 de octubre al 5 de noviembre:

- Calabazas que brillan en el arrecife, medusas fantasma, tiburones con sombrero de bruja o calabaza, y Otto con sombrero de bruja.
- Se suman palabras del tema (bruja, fantasma, calabaza…) en los mundos que usan todo el teclado (fila de abajo, palabras del mar y todo el teclado). Los mundos de la fila central y la fila de arriba conservan solo sus letras.
- Cada palabra da **caramelos** (+15 si ganás). Con caramelos se compran el buzo esqueleto, el buzo calabaza, el sombrero de bruja, el fantasmita y la estela de murciélagos, solo durante el evento. Lo que compraste queda para siempre.
- Para probarlo fuera de fecha: `?evento=halloween`. Para apagarlo: `?evento=no`.

## Guardar el progreso

Monedas, gemas, trajes, estrellas, récords y sonido se guardan en el navegador de cada dispositivo. El botón **Mi progreso** del encabezado permite:

- **Copiar el código** (o **descargarlo como archivo**) para guardarlo, por ejemplo mandándotelo por mensaje.
- **Recuperarlo** pegando el código o eligiendo el archivo, en el mismo navegador tras borrar datos o en otro dispositivo. Antes de reemplazar se muestra qué contiene el código y qué se perdería.
- Un punto rojo avisa si hay progreso y no hay respaldo de los últimos 7 días.
- El juego pide al navegador **almacenamiento persistente** para que no borre los datos por falta de espacio; el navegador decide si lo concede.

El código lleva una suma de control que detecta errores de copiado, pero no impide editarlo a propósito: es un juego sin cuentas ni servidor. Los datos de `localhost` y de la dirección publicada son distintos.

## Jugar de a dos (cooperativo)

Dos personas pueden jugar cada una en su dispositivo. En la pantalla de inicio, una elige **Jugar con un amigo → Crear una sala** y comparte el código de 4 letras o el **link de invitación** (`…/?sala=ABCD`, se abre con el código ya cargado); la otra elige **Entrar**. La sala admite solo dos personas.

- **Cada uno elige su propio nivel**: por ejemplo, un adulto en el nivel 3 y un chico en el nivel 1, en la misma partida. El anfitrión elige el modo sin apuro y empieza.
- **Si se corta la conexión**, la partida se congela con un aviso y el invitado vuelve a llamar solo durante 30 segundos. Si vuelve, siguen donde estaban; si no, se vuelve al inicio. Un latido cada 2 s detecta cortes silenciosos. Salir de la sala avisa al otro al instante.
- El **oxígeno lo decide el anfitrión**: el invitado numera sus cambios y el anfitrión confirma cuáles aplicó, así una sincronización atrasada no deshace nada.

- Comparten el **oxígeno**, el contador de **24 palabras** y los **8 tentáculos** de Otto. Cada uno ve a su compañero con su traje y accesorios, y puede mandar 👍 🎉 ❤️.
- Los tiburones de cada uno aparecen en su propia pantalla. Los ataques de Otto restan 9 % a cada uno (18 % en el modo solo) y no hay reserva de oxígeno en el naufragio.
- Los bonus de tiburones cuentan los de los dos, y ganar juntos suma 50 monedas y 1 gema extra. Cada uno cobra en su propio dispositivo.
- Las conexiones son directas (WebRTC) mediante [PeerJS](https://peerjs.com), cargado solo al abrir una sala, desde unpkg con versión fija y verificación de integridad. Para que se encuentren usa el servicio público gratuito de PeerJS: puede fallar o tener límites. En el juego solo viajan mensajes del juego (palabras escritas, oxígeno, avatar), y se validan al recibirlos. Si alguna red no permite conexión directa, puede no conectar.
- El modo solo no hace ninguna conexión de red.

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
| `hands.js` | Manos fantasma sobre el teclado de referencia |
| `familycode.js` | Formato y validación de los códigos de familia (compartido por la página y la función) |
| `cloud.js` | Lado de la página del código de familia: pedidos a `/api/progress` y estado de sincronización |
| `api/progress.js` | Función de Vercel: guarda y lee el progreso en Upstash Redis |
| `report.js` | Historia de partidas y cifras del panel para adultos |
| `words.js` | Palabras propias del jugador: validación y guardado |
| `aquarium.js` | Decoraciones del acuario: catálogo, compra y ubicación |
| `missions.js` | Misiones del día, racha de días y medallas |
| `album.js` | Álbum de letras: peces por tecla, rescate, premios y letras para practicar |
| `visuals.js` | Ilustraciones y capas 2.5D del barco, buzo (poses, trajes, mascotas, estelas), criaturas, arrecifes y peces |
| `skins.js` | Catálogo de trajes y accesorios, billetera y compras |
| `events.js` | Calendario de eventos de temporada |
| `net.js` | Salas de a dos por WebRTC, reconexión y validación de mensajes |
| `tests/` | Pruebas de reglas y controlador con DOM/Canvas simulados |
| `build.mjs` | Copia los cinco archivos públicos a `dist/` |
| `server.mjs` | Servidor local sin dependencias |

Para cambiar vocabulario o tiempo base de acercamiento, editá `LEVELS` en `engine.js`. Los costos y recuperación de oxígeno están en `OXYGEN`, y la meta en `MISSION_WORDS`. El estado de los tiburones vive en el motor, separado del dibujo; la pausa congela también sus posiciones y la aparición de nuevos enemigos.

### Estado de verificación

Cobertura automatizada: salto inicial y pausa, misión de 24 palabras, errores/correcciones, Ñ/tildes, pérdida y recuperación de oxígeno, colisiones sin daño duplicado, hasta cuatro tiburones distintos en carriles separados, selección por primera letra, dificultad progresiva, puntuación/profundidad, ayuda, avance de nivel y almacenamiento bloqueado; rutas Canvas válidas, aislamiento del contexto, parallax, límites de dibujo y empaquetado de ilustraciones. Build estático verificado.

Se revisaron las ilustraciones aisladas en escritorio y pantalla chica mediante un replay de operaciones Canvas con Cairo. No es una captura de navegador. Este entorno no permitió abrir sockets locales ni ejecutar Chromium, por lo que **falta revisar la página completa y una partida en navegador real**. La conexión de Vercel CLI también falló; **no está publicado**. Antes de compartirlo, probalo con teclado físico en una computadora y revisá el diseño en una pantalla chica.

La unidad de esta revisión es el modo aventura con múltiples amenazas. Su límite de reversión es el motor/controlador, los indicadores e instrucciones en HTML/CSS, y las pruebas/documentación asociadas. La configuración de Vercel conserva el mismo preset; build y servidor local incluyen ahora el módulo de ilustraciones. Los récords actuales usan `buzo-records-v4`: las frases y el nuevo ritmo de Otto no se comparan con los retos anteriores. Los récords viejos no se borran, pero no se muestran en esta versión.

La revisión visual se puede revertir quitando `visuals.js` y sus importaciones/dibujos en `game.js`, junto con las entradas del módulo en build/servidor y sus pruebas. La ilustración está separada de las reglas en `engine.js`.

### Celebración del tesoro

Al calmar a Otto, el cofre abre su tapa durante una celebración de tres segundos: aparecen monedas, luz dorada y destellos antes de los resultados. Se puede pausar con Escape o el botón de pausa; cambiar de pestaña también congela la escena. Con movimiento reducido, se muestra el cofre abierto y los resultados de inmediato. Otto tiene ocho brazos curvos con ventosas, manchas y una expresión amistosa al terminar.


### Oxígeno sobre el buzo y un Otto con más reto

- El oxígeno aparece sobre la cabeza del buzo, sigue su posición y conserva una lectura accesible del porcentaje. En práctica indica oxígeno ilimitado.
- Otto pide ocho frases de dos palabras del nivel elegido, incluyendo el espacio. Cada frase calma un tentáculo, recupera 3% de oxígeno y **reinicia su reloj**.
- Cada letra correcta nueva lo demora 0,3 s (sin pasar el intervalo completo; borrar y reescribir no suma). Ataca cada 9, 8 o 10 segundos según el nivel; con cuatro tentáculos restantes el intervalo baja al 70%. Si nadie escribe, sigue atacando. Cada golpe consume 18% y conserva lo que ya escribiste. El brazo ámbar anuncia el ataque durante el último segundo y medio.
- La nueva silueta coral tiene ocho brazos con ventosas y un brazo que se extiende hacia el buzo al atacar. Con movimiento reducido conserva el aviso estático, sin el movimiento de ataque. La práctica sigue sin ataques ni penalizaciones.

Verificación: `npm test` y `npm run build`. Revisión Chromium local a 1280 y 390 px: partida hasta Otto, acierto, daño de ataque, pausa/reanudación, oxígeno visible y ausencia de desborde horizontal. Capturas temporales en `/tmp/otto-1280.png` y `/tmp/otto-390.png`.

Límite de reversión: indicador del buzo en `index.html`, `style.css` y `game.js`; frases y reloj de Otto en `engine.js`/`game.js`; ilustración en `visuals.js`, con sus pruebas asociadas. No cambia el descenso ni las amenazas de tiburones. No se publicó esta revisión.
