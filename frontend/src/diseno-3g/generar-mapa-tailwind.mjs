// Diseño 3G — genera planta-mapa-tailwind.css: re-pinta con los tokens --g3-* las clases de color de Tailwind
// que usa Planta (Inventario 3G), SOLO bajo html[data-diseno="3g"]. Con el interruptor apagado no aplica nada.
//   node src/diseno-3g/generar-mapa-tailwind.mjs        (desde frontend/; vuelve a correrlo si agregas colores nuevos)
//   node src/diseno-3g/generar-mapa-tailwind.mjs --tv   → planta-tv-mapa.css: el mismo mapa SOLO para las tarjetas de
//        producción (ProyectoTimeline y sus partes) dentro de .g3tv-mapa, bajo html[data-g3-tv] (pantallas de TV, ola 3).
// Lee las clases que de verdad aparecen en src/ (con sus variantes hover:, focus:, md:…) y escribe una regla por clase.
// Reglas de color (resumen):
//   gris → neutros (fondo, superficie, contenedor, tinta, líneas)       rojo 700-900 → azul acero (acción, era la marca)
//   rojo 50-600 y rosa → «mal» (errores, peligro)                       azul, cielo → «info» (claros) y acción (fuertes)
//   verde, esmeralda → «ok»       amarillo, ámbar, naranja → «aviso»    morado, violeta, índigo → lila (garantía)
//   turquesa, cian → mantenimiento.  Fondos fuertes llevan su color de texto (contraste en claro y oscuro).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, '..');
const TV = process.argv.includes('--tv');
const SALIDA = path.join(AQUI, TV ? 'planta-tv-mapa.css' : 'planta-mapa-tailwind.css');
// Prefijo de cada regla: el interruptor de siempre, o (TV) el atributo de las pantallas públicas + el contenedor del mapa.
const PREFIJO = TV ? ':root[data-g3-tv] .g3tv-mapa' : '[data-diseno="3g"]';

const archivos = [];
if (TV) {
  for (const f of ['components/produccion/ProyectoTimeline.jsx', 'components/produccion/TimelineHeader.jsx', 'components/produccion/TimelineStepper.jsx', 'components/produccion/constants.js']) archivos.push(path.join(SRC, f));
} else {
  (function recorrer(d) {
    for (const n of readdirSync(d)) {
      const p = path.join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'diseno-3g') recorrer(p); } else if (/\.(jsx?|tsx?)$/.test(n)) archivos.push(p);
    }
  })(SRC);
}

const FAMILIAS = 'red|rose|pink|gray|slate|zinc|neutral|stone|blue|sky|indigo|violet|purple|fuchsia|green|emerald|lime|teal|cyan|yellow|amber|orange';
const VARIANTES = 'hover|focus|focus-within|focus-visible|active|disabled|group-hover|placeholder|sm|md|lg|xl';
const RE = new RegExp(`(?<![\\w-])((?:(?:${VARIANTES}):)*)(bg|text|border|border-[lrtbxy]|ring|divide|from|via|to|placeholder)-(white|black|(?:${FAMILIAS})-(?:50|[1-9]00))(?![\\w-])`, 'g');
const clases = new Map();
for (const a of archivos) {
  const t = readFileSync(a, 'utf8');
  for (const m of t.matchAll(RE)) clases.set(m[0], { variantes: m[1] ? m[1].slice(0, -1).split(':') : [], util: m[2], color: m[3] });
}

// ---------- color de Tailwind → token ----------
const FUERTE = Symbol('fuerte');
function familia(nombre) {
  if (/^(gray|slate|zinc|neutral|stone)$/.test(nombre)) return 'gris';
  if (/^(red|rose|pink)$/.test(nombre)) return 'rojo';
  if (/^(blue|sky)$/.test(nombre)) return 'azul';
  if (/^(indigo|violet|purple|fuchsia)$/.test(nombre)) return 'lila';
  if (/^(green|emerald|lime)$/.test(nombre)) return 'verde';
  if (/^(teal|cyan)$/.test(nombre)) return 'turquesa';
  return 'ambar'; // yellow, amber, orange
}
const ESTADO = { rojo: 'mal', azul: 'info', lila: 'garantia', verde: 'ok', turquesa: 'mantenimiento', ambar: 'aviso' };
const mezcla = (tok, pct) => `color-mix(in srgb, var(--g3-${tok}) ${pct}%, transparent)`;

function fondo(color) {
  if (color === 'white') return { v: 'var(--g3-superficie)' };
  if (color === 'black') return null; // velos y fotos: se quedan negros
  const [n, s] = [color.replace(/-\d+$/, ''), +color.match(/\d+$/)[0]];
  const f = familia(n);
  if (f === 'gris') {
    if (s <= 50) return { v: 'var(--g3-fondo)' };
    if (s <= 100) return { v: 'var(--g3-contenedor)' };
    if (s <= 200) return { v: 'var(--g3-contenedor-alto)' };
    if (s <= 300) return { v: 'var(--g3-linea-fuerte)' };
    if (s <= 600) return { v: 'var(--g3-neutro)', fuerte: true };
    return { v: 'var(--g3-tinta)', fuerte: true };
  }
  if (f === 'rojo' && s >= 700) return { v: s >= 900 ? 'var(--g3-primario-hover)' : (s === 800 ? 'var(--g3-primario-hover)' : 'var(--g3-primario)'), fuerte: true };
  if (f === 'azul' && s >= 500) return { v: s >= 800 ? 'var(--g3-primario-hover)' : 'var(--g3-primario)', fuerte: true };
  const e = ESTADO[f];
  if (s <= 200) return { v: `var(--g3-${e}-suave)` };
  if (s <= 300) return { v: mezcla(e, 35) };
  return { v: `var(--g3-${e})`, fuerte: true };
}
function texto(color) {
  if (color === 'white') return 'var(--g3p-sobre-fuerte)';
  if (color === 'black') return 'var(--g3-tinta)';
  const [n, s] = [color.replace(/-\d+$/, ''), +color.match(/\d+$/)[0]];
  const f = familia(n);
  if (f === 'gris') {
    if (s >= 700) return 'var(--g3-tinta)';
    if (s >= 500) return 'var(--g3-tinta-2)';
    if (s >= 400) return 'var(--g3-tinta-3)';
    if (s >= 300) return 'var(--g3-linea-fuerte)';
    return 'var(--g3-linea)';
  }
  if (s <= 200) return `var(--g3-${ESTADO[f]}-suave)`; // texto claro sobre fondo fuerte (poco común)
  return `var(--g3-${ESTADO[f]})`;
}
function borde(color, util) {
  if (color === 'white') return 'var(--g3-superficie)';
  if (color === 'black') return 'var(--g3-tinta)';
  const [n, s] = [color.replace(/-\d+$/, ''), +color.match(/\d+$/)[0]];
  const f = familia(n);
  if (util === 'ring' && (f === 'rojo' || f === 'azul') && s >= 300) return 'var(--g3-primario)'; // anillos de foco
  if (f === 'gris') {
    if (s <= 200) return 'var(--g3-linea)';
    if (s <= 400) return 'var(--g3-linea-fuerte)';
    if (s <= 600) return 'var(--g3-linea-campo)';
    return 'var(--g3-tinta-2)';
  }
  if (f === 'rojo' && s >= 700) return 'var(--g3-primario)'; // contornos y subrayados de la marca → acción
  if (f === 'azul' && s >= 500) return 'var(--g3-primario)';
  const e = ESTADO[f];
  if (s <= 100) return mezcla(e, 20);
  if (s <= 300) return mezcla(e, 40);
  return `var(--g3-${e})`;
}

// ---------- selector con variantes ----------
const esc = (c) => c.replace(/[:/[\]().%]/g, (x) => '\\' + x);
const MEDIOS = { sm: 640, md: 768, lg: 1024, xl: 1280 };
function selector(clase, variantes, util) {
  let sel = '.' + esc(clase);
  let pre = '';
  for (const v of variantes) {
    if (v === 'hover') sel += ':hover';
    else if (v === 'focus') sel += ':focus';
    else if (v === 'focus-within') sel += ':focus-within';
    else if (v === 'focus-visible') sel += ':focus-visible';
    else if (v === 'active') sel += ':active';
    else if (v === 'disabled') sel += ':disabled';
    else if (v === 'group-hover') pre = '.group:hover ';
  }
  if (variantes.includes('placeholder') || util === 'placeholder') sel += '::placeholder';
  return `${PREFIJO} ${pre}${sel}`;
}
const medio = (variantes) => variantes.map((v) => MEDIOS[v]).find(Boolean);

const reglasTexto = [], reglasBorde = [], reglasFondo = [];
const orden = [...clases.entries()].sort(([a], [b]) => a.localeCompare(b));
for (const [clase, { variantes, util, color }] of orden) {
  let cuerpo = null, destino = null;
  if (util === 'text' || util === 'placeholder' || variantes.includes('placeholder')) {
    cuerpo = `color: ${texto(color)};`; destino = reglasTexto;
  } else if (util === 'bg') {
    const f = fondo(color);
    if (!f) continue;
    cuerpo = `background-color: ${f.v};` + (f.fuerte ? ' color: var(--g3p-sobre-fuerte);' : '');
    destino = reglasFondo;
  } else if (util.startsWith('border')) {
    const lado = { 'border-l': 'left', 'border-r': 'right', 'border-t': 'top', 'border-b': 'bottom' }[util];
    const v = borde(color, util);
    cuerpo = lado ? `border-${lado}-color: ${v};` : util === 'border-x' ? `border-left-color: ${v}; border-right-color: ${v};` : util === 'border-y' ? `border-top-color: ${v}; border-bottom-color: ${v};` : `border-color: ${v};`;
    destino = reglasBorde;
  } else if (util === 'ring') {
    cuerpo = `--tw-ring-color: ${borde(color, 'ring')};`; destino = reglasBorde;
  } else if (util === 'divide') {
    const sel = selector(clase, variantes, util) + ' > :not([hidden]) ~ :not([hidden])';
    reglasBorde.push({ sel, cuerpo: `border-color: ${borde(color, util)};`, mq: medio(variantes) });
    continue;
  } else if (util === 'from' || util === 'via' || util === 'to') {
    const f = fondo(color);
    if (!f) continue;
    cuerpo = util === 'from'
      ? `--tw-gradient-from: ${f.v} var(--tw-gradient-from-position); --tw-gradient-to: transparent var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`
      : util === 'via'
        ? `--tw-gradient-to: transparent var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), ${f.v} var(--tw-gradient-via-position), var(--tw-gradient-to);`
        : `--tw-gradient-to: ${f.v} var(--tw-gradient-to-position);` + (f.fuerte ? ' color: var(--g3p-sobre-fuerte);' : '');
    destino = reglasFondo;
  }
  if (!cuerpo) continue;
  let sel = selector(clase, variantes, util);
  // Los velos (bg-black, bg-*-opacity) y lo que va encima de ellos no se tocan
  if (util === 'bg') sel += ':not([class*="bg-opacity-"])';
  destino.push({ sel, cuerpo, mq: medio(variantes) });
}

function css(reglas) {
  const base = reglas.filter((r) => !r.mq).map((r) => `${r.sel} { ${r.cuerpo} }`);
  const porMedio = {};
  for (const r of reglas.filter((r) => r.mq)) (porMedio[r.mq] ||= []).push(`  ${r.sel} { ${r.cuerpo} }`);
  return [...base, ...Object.entries(porMedio).sort(([a], [b]) => a - b).map(([px, rs]) => `@media (min-width: ${px}px) {\n${rs.join('\n')}\n}`)].join('\n');
}

const cabecera = TV ? `/* Diseño 3G para TV — planta-tv-mapa.css (GENERADO por generar-mapa-tailwind.mjs --tv; no lo edites a mano)
   Re-pinta con tokens --g3-* las ${clases.size} clases de color de Tailwind de las tarjetas de producción (ProyectoTimeline),
   solo dentro de .g3tv-mapa y bajo html[data-g3-tv] (las pantallas de TV con ?diseno=3g). Tokens en planta-tv-3g.css.
   Orden: textos → bordes → fondos (un fondo fuerte pone su propio color de texto para que siempre se lea). */
` : `/* Diseño 3G — planta-mapa-tailwind.css (GENERADO por generar-mapa-tailwind.mjs; no lo edites a mano)
   Re-pinta con tokens --g3-* las ${clases.size} clases de color de Tailwind que usa Planta, solo bajo html[data-diseno="3g"].
   Orden: textos → bordes → fondos (un fondo fuerte pone su propio color de texto para que siempre se lea). */
:root[data-diseno="3g"] { --g3p-sobre-fuerte: #ffffff; }
:root[data-diseno="3g"][data-g3-tema="oscuro"] { --g3p-sobre-fuerte: #111111; }
@media (prefers-color-scheme: dark) { :root[data-diseno="3g"][data-g3-tema="auto"] { --g3p-sobre-fuerte: #111111; } }
`;
const pie = TV ? '' : `
/* Texto blanco sobre velos y fotos (negro translúcido): se queda blanco en los dos temas */
[data-diseno="3g"] :is(.bg-black, [class*="bg-opacity-"], [class*="bg-black\\/"]) :is(.text-white, [class*="text-white"]),
[data-diseno="3g"] :is(.bg-black, [class*="bg-opacity-"], [class*="bg-black\\/"]):is(.text-white, [class*="text-white"]) { color: #ffffff; }
`;
writeFileSync(SALIDA, cabecera + '\n/* ---- Textos ---- */\n' + css(reglasTexto) + '\n\n/* ---- Bordes y anillos ---- */\n' + css(reglasBorde) + '\n\n/* ---- Fondos ---- */\n' + css(reglasFondo) + '\n' + pie);
console.log(`${path.basename(SALIDA)}: ${clases.size} clases (${reglasTexto.length} texto, ${reglasBorde.length} borde/anillo, ${reglasFondo.length} fondo)`);
