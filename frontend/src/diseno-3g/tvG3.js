// Tipo de trabajo para las tarjetas de producción (lo usa components/produccion/TimelineHeader.jsx).
// El diseño de TV de la ola 3 (html[data-g3-tv], useTvG3, aplicarTv) se borró el 7-nov-2026: las TV de producción van
// con la TV clásica (src/tv-clasico) y la terminal, anuncios y calendario con el rediseño 2.
// Tipo de trabajo con su nombre completo y su color (Instalación azul, Mantenimiento turquesa, Garantía lila).
// Cualquier otro valor sale tal cual, en gris (no se inventa nada).
export function tipoTv(tipo) {
  const t = String(tipo || '').toUpperCase().trim();
  if (!t) return null;
  if (t === 'MTO' || t === 'MANTENIMIENTO') return { texto: 'Mantenimiento', clase: 'g3tv-etq--mantenimiento' };
  if (t === 'GTIA' || t === 'GARANTIA' || t === 'GARANTÍA') return { texto: 'Garantía', clase: 'g3tv-etq--garantia' };
  if (t === 'INSTALACION' || t === 'INSTALACIÓN') return { texto: 'Instalación', clase: 'g3tv-etq--instalacion' };
  if (t === 'A' || t === 'B' || t === 'C') return { texto: `Tipo ${t}`, clase: '' };
  return { texto: String(tipo).trim(), clase: '' };
}
