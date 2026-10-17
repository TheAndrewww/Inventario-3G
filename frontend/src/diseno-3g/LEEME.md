# Diseño 3G en Planta (Inventario 3G)

## Solo el diseño nuevo (16-oct-2026)

Decisión del dueño: todos ven solo el Diseño 3G con el rediseño 2 y ya no hay forma de volver a lo viejo. Incluye las
pantallas públicas: las 4 TV de producción, la terminal de las áreas, Anuncios y el Calendario público.

- **Siempre encendido:** `index.html` trae `<html data-diseno="3g">` fijo y el guion de `<head>` lo vuelve a poner antes de
  cualquier CSS. `?diseno=actual` y `?diseno=3g` ya no cambian nada: el guion los quita de la dirección (sin tocar
  `history.state`) antes de que cargue el paquete, para que `diseno-3g.js` no guarde nada al leerlos.
- **Lo guardado en el navegador no se toca:** ni el guion ni la pantalla escriben `localStorage['diseno-3g']`. Si alguien
  tenía «actual» guardado, el paquete quitaría el atributo al cargar; `forzarDiseno3G.js` (importado en `main.jsx` justo
  después del paquete, y en cada cambio de ruta desde `RutaDiseno3G.jsx`) lo vuelve a poner en la misma vuelta y regresa
  lo guardado a su valor. Así, si hubiera que regresar a la versión de antes (Instant Rollback de Vercel o revertir el
  commit), cada persona ve lo que veía antes de publicar.
- **Sin parpadeo:** `useDiseno3G()` (este archivo y `rediseno2/fundacion/useDiseno3G.js`) devuelve siempre `true`, igual que
  `leerDiseno3G()`.
- **Sin interruptor:** el selector de apps (9 puntos) se monta con `interruptor: false` (`Riel.jsx`; también en
  `MarcoPlanta.jsx`, que ya no se usa). Ya no hay rutas sin diseño: `window.G3_RUTAS_SIN_DISENO` se quitó de `index.html`.
- **El tema** claro/oscuro/auto se sigue respetando (`localStorage['diseno-3g-tema']`), y las TV y la terminal aceptan
  `?tema=claro` u `?tema=oscuro` en la liga (solo esa carga).
- **El paquete no se tocó** (`diseno-3g.js` sigue igual que `Plataforma-3G/diseno-3g/`).
- **La terminal** sigue pidiendo el código del área una vez y lo recuerda (`localStorage['terminal3g-codigos']`, sin cambios).

### Borrar lo viejo (a partir del 24-oct-2026, en un commit aparte)

Todo lo que ya no se ve está marcado con `VIEJO: se borra a partir del 24-oct-2026`:

```bash
grep -rn "VIEJO: se borra" src index.html   # cada archivo, cada `if (d3)` / `if (g3)` con vista apagada y los archivos enteros
```

Orden sugerido:
1. En cada pantalla, quitar el `return` viejo que sigue a `if (d3) { … }` y las ramas con `d3`, `g3` o `g3Activo()` en
   false (en `dialogosG3.js` la rama sin Diseño 3G: `confirm()`/`alert()`/`prompt()` del navegador). Las ramas con `tv`
   (`useTvG3()`) en true son del diseño de TV de la ola 3 y también se van.
2. Los archivos enteros marcados: `MarcoPlanta.jsx`, `PiezasTv.jsx`, `tvG3.js` (cuando ya nadie lo importe),
   `planta-tv-3g.css` y `planta-tv-mapa.css` (y sus imports en `main.jsx`), `components/layout/Header.jsx`,
   `SubPestanasGrupo.jsx` y el componente `Sidebar` (sus exportaciones de arriba se quedan: el riel y las rutas salen de ahí).
3. Lo que quede sin usar (ESLint lo marca: imports, `useDiseno3G`, `CabG3`, `MasAcciones`…) y por último el CSS que solo
   servía a lo viejo (`.g3-si` de `index.html`, `planta-mapa-tailwind.css` si ya nada lo usa).

Antes de unir: `node --test test/*.test.mjs` en `frontend/`, `npm run build`, ESLint y una vuelta por cada pantalla.

## Cómo se encendía (hasta el 16-oct-2026)

Todo lo de esta carpeta vivía detrás del interruptor **Diseño 3G** (`<html data-diseno="3g">`). Apagado era lo normal.
Desde el 16-oct-2026 ya no aplica: ver «Solo el diseño nuevo».

## Archivos

| Archivo | Origen | Qué es |
|---|---|---|
| `diseno-3g.css`, `diseno-3g.js`, `sistemas.json`, `puentes/tailwind-preset.cjs` | Copia sin cambios del paquete **Diseño 3G v1.1.0** (`Plataforma-3G/diseno-3g/`, 12-oct-2026; `puentes/` sigue igual que en v1.0.0). SHA-256 abajo. | Tokens, componentes `.g3-*`, interruptor, selector de apps, variante `g3:` de Tailwind. |
| `planta-mapa-tailwind.css` | **Generado** por `generar-mapa-tailwind.mjs` | Re-pinta con tokens las ~390 clases de color de Tailwind que usa Planta (gris → neutros, rojo de marca → azul acero, estados…). Si se agregan colores nuevos: `node src/diseno-3g/generar-mapa-tailwind.mjs` desde `frontend/`. |
| `planta-3g.css` | Propio de Planta | Armazón (riel, barra, pestañas, barra inferior), radios, sombras, tablas, formularios y modales de siempre bajo el interruptor. |
| `MarcoPlanta.jsx` | Propio | Armazón nuevo: riel por áreas, barra de vidrio con título, tema, avisos, selector de apps (con el interruptor) y perfil; pestañas de sección; barra inferior en celular. Lo usa `DashboardLayout` solo con el interruptor encendido. |
| `menuPlanta.js` | Propio | Grupos del riel (Almacén, Compras, Producción, Calendario, Herramientas y cuadrillas, Administración), títulos claros de cada pantalla y secciones con pestañas (Tickets de material, Compras). **Permisos y rutas salen de `ALL_MENU_ITEMS`** (`components/layout/Sidebar.jsx`); si se agrega una pantalla allí y no aquí, aparece en «Otros». |
| `useDiseno3G.js` | Propio | `useDiseno3G()` y `useTemaG3()` para React. |
| `RutaDiseno3G.jsx` | Propio (ola 2) | En cada cambio de ruta llama `forzarDiseno3G()` (lo monta `App.jsx`). Hasta el 16-oct-2026 llamaba `G3.aplicar()`. |
| `forzarDiseno3G.js` | Propio (16-oct-2026) | Deja el diseño encendido al cargar el paquete y en cada cambio de ruta, sin tocar lo guardado en el navegador. |
| `dialogosG3.js` | Propio (ola 2) | `g3Activo()`, `confirmarG3()`, `avisoG3()` y ayudas `etq()`, `siG3()`, `cx()` para no agregar nada al DOM con el interruptor apagado. |
| `CabG3.jsx` | Propio (ola 2) | Encabezado de pantalla del paquete (`g3-cab`): título en oración, para qué sirve y acciones. |
| `MasAcciones.jsx` | Propio (ola 2) | «Más acciones» de un renglón (`g3-menu`, con `position: fixed`): las opciones llaman al mismo manejador que el botón de siempre. |
| `tvG3.js` | Propio (ola 3) | Diseño 3G para las pantallas públicas (TV, terminal, anuncios, calendario público): `useTvG3()`, `aplicarTv()`, `RUTAS_TV` y `tipoTv()`. Se enciende **solo** con `?diseno=3g` en la liga de esa carga (ver abajo). |
| `PiezasTv.jsx` | Propio (ola 3) | Piezas de esas pantallas: barra de título, «En vivo», controles de zoom y giro (los mismos manejadores), «Cargando». |
| `planta-tv-3g.css` | Propio (ola 3) | Tokens (mismos valores del paquete, con más contraste) y estilos de TV, todo bajo `html[data-g3-tv]`. |
| `planta-tv-mapa.css` | **Generado** (`generar-mapa-tailwind.mjs --tv`) | El mapa de colores de Tailwind solo para las tarjetas de producción (`ProyectoTimeline`) dentro de `.g3tv-mapa`, bajo `html[data-g3-tv]`. |

SHA-256 de los archivos del paquete (para saber si ya hay versión nueva):

```
c28ef2683a9f835318addbf9b3c0419f6d898fb876383bed5fe2a2d4825270ef  diseno-3g.css
27b767ac4806205c27c5a84c390bad0c5248fbef6a820448c444fd67fd3d8e2f  diseno-3g.js
f4bac54ef921c330e501e35d6e5065c226f44586a896f84f0d22924fac9b8e54  sistemas.json
3030e48847509347cb1d99eed54e067c263a54fe4d0b4d5073278277e929469c  puentes/tailwind-preset.cjs
```

## Reglas para seguir trabajando

1. CSS nuevo, siempre bajo `[data-diseno="3g"]` (o la variante `g3:` de Tailwind).
2. Marcado nuevo **solo se monta encendido**: `const g3 = useDiseno3G()` y `{g3 ? <nuevo/> : <de siempre/>}` (o `{g3 && …}`).
   Apagado, el DOM tiene que quedar idéntico al de siempre (se prueba comparando el DOM contra HEAD). No uses `g3-si`/`g3-no`
   en JSX. Atributos nuevos (`data-etq`, `role`, `aria-*`) con `etq(g3, …)` / `siG3(g3, {…})`; clases nuevas con `cx(…, g3 && '…')`
   o con la variante `g3:` (que apagado no hace nada).
3. Las rutas no cambian (ligas de WhatsApp y correo). Los permisos por rol no se tocan: solo la forma del menú.
4. `confirm()` / `alert()`: con el interruptor encendido, `confirmarG3` / `avisoG3` (vista previa armada solo con datos que ya
   están en pantalla); apagado, el mismo `confirm()`/`alert()` de siempre. La petición de después es la misma y todo lo que se
   manda se calcula **antes** de abrir el diálogo. Nada de vistas previas que llamen al servidor.
   `prompt()` (ola 3): encendido, `pedirTextoG3({...})` abre un cajón con el campo y devuelve **lo mismo que `prompt()`** (el
   texto tal cual, aunque esté vacío, o `null` al regresar o con Esc); la validación de la pantalla sigue igual después.
   Excepción: el escáner con la cámara encendida conserva su `confirm()` nativo (detiene la lectura mientras pregunta).
5. Un solo botón principal por renglón; lo demás en `<MasAcciones>` (mismo manejador que el botón de siempre). Rojo = peligro:
   un botón destructivo con `bg-red-700/800` lleva `g3:!bg-g3-mal` (el mapa pinta el rojo 700–900 de marca como azul de acción).
6. Preferencias del diseño nuevo en claves `g3-…` de `localStorage` (riel: `g3-riel-ocultos:<id>`, `g3-riel-orden:<id>`,
   `g3-riel-suborden:<id>:compras`). Las `sidebar-*` son solo del menú de siempre.
7. Barras de acción fijas abajo: `g3:bottom-[var(--g3-espacio-inferior)]` para quedar encima de la barra inferior en celular,
   y el contenido deja ese espacio abajo.
8. `diseno-3g.js` está fuera de ESLint (`eslint.config.js`) porque es el paquete copiado tal cual.

## Diseño 3G v1.1.0 (12-oct-2026): qué cambió para este sistema

- **Direcciones:** el paquete ya no trae las direcciones internas (Operación, Entregas, Finanzas, Administrador del sitio):
  `url: null, sensible: true`. Sin dirección, el selector de apps dice «Ábrela desde Inicio 3G» y no es enlace.
  Se completan con `G3.configurar({ urls })` **solo desde un archivo servido con sesión** (DESIGN.md §14 del paquete).
  Nunca pongas direcciones internas en esta carpeta.
- **Fragmento de `<head>`:** ahora `<style>` + `<script>` (copiado igual en las páginas de este sistema): oculta `.g3-si`
  aunque `diseno-3g.css` no cargue y respeta `<html data-g3-excluir>` / `window.G3_RUTAS_SIN_DISENO`.
- **Movimiento reducido** solo afecta a los componentes `g3-*`; **barra inferior**: `--g3-espacio-inferior` y
  `g3-sobre-barra-inferior` para que las barras fijas del sistema queden encima; sesión en la barra con `g3-sesion`.
- **Planta es SPA con JS público:** no configura direcciones privadas (ni en el bundle ni en `public/`).
- El fragmento de `index.html` ya es el de v1.1.0 (con `<meta charset>` antes), con `window.G3_RUTAS_SIN_DISENO` (TV, terminal,
  anuncios, calendario público) justo antes, y `RutaDiseno3G` llama `G3.aplicar()` al cambiar de ruta (ola 2).

## Pantallas de TV y terminal (ola 3) — VIEJO, hasta el 16-oct-2026

> Ya no aplica: desde el 16-oct-2026 las TV, la terminal, Anuncios y el Calendario público llevan siempre el rediseño 2,
> con o sin `?diseno=3g` en la liga. Lo de abajo se queda como historia y se borra con lo demás a partir del 24-oct-2026.

Las pantallas públicas siguen fuera del interruptor guardado (`window.G3_RUTAS_SIN_DISENO`): en un equipo compartido la
preferencia de otra persona nunca las cambia. Su diseño para TV se enciende **solo si la liga de esa carga trae `?diseno=3g`**
(y `&tema=oscuro` para fondo oscuro). No se guarda ni se lee nada en `localStorage`; sin el parámetro, la pantalla es la de hoy.
Mismas consultas y misma frecuencia de actualización; sin interacción nueva (los botones de zoom, giro, actualizar, salir, ver
plano y «completado» son los de siempre).

| Pantalla | Liga con Diseño 3G (claro) | Oscuro |
|---|---|---|
| Panel de producción | `/produccion-tv?diseno=3g` | `/produccion-tv?diseno=3g&tema=oscuro` |
| Proyectos completados | `/preparados-tv?diseno=3g` | `…&tema=oscuro` |
| Manufactura | `/manufactura-tv?diseno=3g` | `…&tema=oscuro` |
| Herrería | `/herreria-tv?diseno=3g` | `…&tema=oscuro` |
| Terminal de un área | La liga que ya usa esa tableta, con `?diseno=3g` al final | `…&tema=oscuro` |
| Terminal con código | `/terminal?diseno=3g` (al entrar y salir conserva el parámetro) | `…&tema=oscuro` |
| Anuncios | `/anuncios?diseno=3g` | `…&tema=oscuro` |
| Calendario público | `/calendario-publico?diseno=3g` | `…&tema=oscuro` |

Para regresar una TV al diseño de siempre basta abrir la liga sin el parámetro.
