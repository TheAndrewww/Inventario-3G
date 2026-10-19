// Solo el diseño nuevo (decisión del dueño, 16-oct-2026) · deja Diseño 3G encendido en esta página, sin recargar.
// Corre al cargar el paquete (main.jsx lo importa justo después de diseno-3g.js, antes de que se pinte React) y en cada
// cambio de ruta (RutaDiseno3G.jsx).
//
// El paquete, al cargar, todavía lee un «actual» guardado en el navegador y quitaría el atributo: esto lo vuelve a poner
// en la misma vuelta (G3.encender pone también el tema y pide la letra). La dirección ya llega sin ?diseno (index.html).
// No pide nada al servidor.
//
// Lo guardado en el navegador (localStorage['diseno-3g']) se deja como estaba: G3.encender guarda «3g», así que se
// regresa al valor de antes. Así, si hubiera que regresar a la versión de antes (Instant Rollback de Vercel o revertir
// este cambio), cada persona ve lo que veía antes de publicar y no el diseño encendido para todos.
import { esRutaTvClasica } from '../tv-clasico/rutasTvClasica.js';

const CLAVE_DISENO = 'diseno-3g';

export function forzarDiseno3G() {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  // TV clásica (19-oct-2026): TV de producción y calendario público sin el diseño nuevo
  if (typeof window !== 'undefined' && esRutaTvClasica(window.location?.pathname)) {
    raiz.removeAttribute('data-diseno');
    return;
  }
  if (raiz.getAttribute('data-diseno') === '3g') return;
  const api = typeof window !== 'undefined' ? window.G3 : undefined;
  if (!api || typeof api.encender !== 'function') {
    raiz.setAttribute('data-diseno', '3g');
    return;
  }
  let antes = null;
  try { antes = window.localStorage.getItem(CLAVE_DISENO); } catch { /* sin almacenamiento */ }
  api.encender({ recargar: false });
  try {
    if (antes === null) window.localStorage.removeItem(CLAVE_DISENO);
    else window.localStorage.setItem(CLAVE_DISENO, antes);
  } catch { /* sin almacenamiento: no hay nada que regresar */ }
}

// Al cargar este archivo (main.jsx lo importa justo después del paquete).
forzarDiseno3G();
