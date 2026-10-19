// TV clásica (19-oct-2026): las pantallas de TV de producción y el calendario público se ven como antes del Diseño 3G
// (fondo blanco, logos, Tailwind de siempre). En estas rutas <html> va SIN data-diseno="3g": index.html lo quita antes
// del primer pintado y forzarDiseno3G() no lo vuelve a poner. La lista se repite en el guion de index.html.
export const RUTAS_TV_CLASICA = ['/produccion-tv', '/preparados-tv', '/manufactura-tv', '/herreria-tv', '/calendario-publico'];

export const esRutaTvClasica = (pathname) => RUTAS_TV_CLASICA.includes((pathname || '').replace(/\/+$/, '') || '/');
