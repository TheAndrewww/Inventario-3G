/* Diseño 3G v1.0.0 — preset de Tailwind 3 (Planta/Inventario con React + Vite; también sirve en Next.js).
   Uso en tailwind.config.js:
     presets: [require('./public/diseno-3g/puentes/tailwind-preset.cjs')],   // o la ruta donde copiaste el paquete
   Qué agrega:
   1. Variante g3:  →  solo aplica con el interruptor encendido.  Ej.: className="bg-red-600 g3:bg-g3-primario g3:rounded-full"
      Para un elemento nuevo que solo existe con Diseño 3G: className="hidden g3:flex" (o la clase g3-si de diseno-3g.css).
      Se compila a  :root[data-diseno="3g"] .g3\:bg-g3-primario { … }  (gana a la clase de siempre sin importar el orden).
      Con el interruptor apagado esa clase no hace nada: la pantalla se ve igual que hoy.
   2. Colores g3-* que leen los tokens de diseno-3g.css: bg-g3-superficie, text-g3-tinta-2, border-g3-linea, bg-g3-ok-suave…
      (Son var(--g3-…): no aceptan opacidad con /50. Para un tinte usa los tokens *-suave o *-tinte.)
   3. font-g3-titulo / font-g3-texto, rounded-g3-ch|md|gr|hoja, shadow-g3-1|2|3.
   No cambia ninguna clase existente (no toca gray, red, etc.). */
const plugin = require('tailwindcss/plugin');

const tokens = [
  'fondo', 'superficie', 'contenedor', 'contenedor-alto', 'tinta', 'tinta-2', 'tinta-3', 'linea', 'linea-fuerte', 'linea-campo',
  'hover', 'presionado', 'primario', 'primario-hover', 'sobre-primario', 'primario-suave', 'sobre-primario-suave', 'primario-tinte',
  'rojo-3g', 'ok', 'ok-suave', 'aviso', 'aviso-suave', 'mal', 'mal-suave', 'mal-hover', 'sobre-mal', 'neutro', 'neutro-suave',
  'info', 'info-suave', 'instalacion', 'instalacion-suave', 'mantenimiento', 'mantenimiento-suave', 'garantia', 'garantia-suave',
  'vidrio', 'vidrio-fuerte', 'velo',
];
const colores = {};
for (const t of tokens) colores[`g3-${t}`] = `var(--g3-${t})`;

module.exports = {
  theme: {
    extend: {
      colors: colores,
      fontFamily: {
        'g3-titulo': 'var(--g3-f-titulo)',
        'g3-texto': 'var(--g3-f-texto)',
        'g3-mono': 'var(--g3-f-mono)',
      },
      borderRadius: {
        'g3-ch': 'var(--g3-r-ch)',
        'g3-md': 'var(--g3-r-md)',
        'g3-gr': 'var(--g3-r-gr)',
        'g3-hoja': 'var(--g3-r-hoja)',
      },
      boxShadow: {
        'g3-1': 'var(--g3-sombra-1)',
        'g3-2': 'var(--g3-sombra-2)',
        'g3-3': 'var(--g3-sombra-3)',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('g3', ':root[data-diseno="3g"] &');
    }),
  ],
};
