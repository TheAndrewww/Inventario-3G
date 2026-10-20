// Rediseño 2 · menú del armazón encendido (DISENO-v2 §3.1).
// Las RUTAS y los PERMISOS no cambian: salen de ALL_MENU_ITEMS (components/layout/Sidebar.jsx) por medio de menuPlanta.js
// (rielParaRol, pestanasDeSeccion), igual que hoy. Aquí solo se acomoda:
//  - Compras pasa a ser UNA sola entrada del riel (como «Tickets de material») y sus pantallas son pestañas del encabezado.
//    Con una sola pestaña visible para el rol, la entrada lleva directo y no se pintan pestañas.
//  - Grupos de una sola entrada (Compras, Calendario) se pintan sin título de grupo.
//  - Barra inferior del celular por rol (4 destinos que más usa ese rol + «Más»); solo destinos que el rol ya ve.
//  - Personalizar menú: mismas claves g3-riel-ocultos:<id>, g3-riel-orden:<id> y g3-riel-suborden:<id>:compras.
//    La primera vez, heredarAjustesDelMenu (menuPlanta.js) copia a esas claves lo que el usuario ya tenía en el menú de
//    siempre (paneles ocultos, orden y orden de las pestañas de Compras); el armazón lo llama igual que el marco anterior.
import { ShoppingBag, Package, ClipboardList, CalendarDays, Factory, UserRound, Flag, ArrowUpDown, PackageCheck, AlertCircle, FileText, Truck } from 'lucide-react';
import { rutaInicialPorRol } from '../../../components/layout/Sidebar';
import {
  rielParaRol, pestanasDeSeccion, seccionDeRuta, SECCIONES, TITULOS,
  claveOcultosG3, claveOrdenG3, guardarSubOrdenG3, EVENTO_SUBORDEN_G3, heredarAjustesDelMenu,
} from '../../../diseno-3g/menuPlanta';

export { claveOcultosG3, claveOrdenG3, guardarSubOrdenG3, EVENTO_SUBORDEN_G3, heredarAjustesDelMenu, SECCIONES, seccionDeRuta };

// Nombre corto de cada pantalla cuando es pestaña de su sección (el encabezado ya dice la sección)
const PESTANA = {
  '/pedido': 'Orden de salida',
  '/pedidos-pendientes': 'Tickets pendientes',
  '/historial': 'Historial',
  '/solicitudes-compra': 'Solicitudes',
  '/ordenes-compra': 'Órdenes de compra',
  '/recepcion-mercancia': 'Recepción',
  '/stock-bajo': 'Stock bajo',
  '/proveedores': 'Proveedores',
};

/** Nombre claro de la pantalla (barra del celular). */
export const tituloDeRutaR2 = (ruta) => TITULOS[ruta] || (ruta?.startsWith('/produccion/avisos') ? 'Avisos a Producción' : 'Planta');

/** Pestañas de la sección de esa ruta para el rol, con el orden guardado del usuario: [{ruta, texto, activa}]. */
export function pestanasDeRuta(ruta, rol, userId) {
  const seccion = seccionDeRuta(ruta);
  if (!seccion) return { seccion: null, titulo: null, pestanas: [] };
  const lista = pestanasDeSeccion(seccion, rol, userId).map((p) => ({ ruta: p.path, texto: PESTANA[p.path] || p.etiqueta, activa: p.path === ruta }));
  return { seccion, titulo: SECCIONES[seccion].titulo, pestanas: lista };
}

/** Riel del rol: grupos [{id, titulo, mostrarTitulo, items:[{clave, etiqueta, icono, destino, rutas, oculto, subitems?}]}]. */
// Submenú del riel (19-oct-2026, a pedido del usuario): las pantallas de una sección con pestañas también salen en el riel,
// debajo de su entrada; las que el usuario ocultó no salen.
const subitemsDe = (seccion, rol, userId, ocultos) => pestanasDeSeccion(seccion, rol, userId)
  .map((p) => ({ clave: p.path, destino: p.path, etiqueta: PESTANA[p.path] || p.etiqueta, oculto: ocultos.has(p.path) }));

export function rielR2(rol, userId, ocultos = new Set()) {
  const grupos = rielParaRol(rol, userId, ocultos);
  return grupos.map((g) => {
    if (g.id !== 'compras') {
      return {
        ...g,
        mostrarTitulo: g.items.length > 1 && g.id !== 'calendario',
        items: g.items.map((it) => (it.seccion ? { ...it, subitems: subitemsDe(it.seccion, rol, userId, ocultos) } : it)),
      };
    }
    const pestanas = pestanasDeSeccion('compras', rol, userId);
    if (!pestanas.length) return null;
    const oculto = ocultos.has('compras') || pestanas.every((p) => ocultos.has(p.path));
    return {
      ...g,
      mostrarTitulo: false,
      items: [{
        clave: 'compras', seccion: 'compras', etiqueta: 'Compras', icono: ShoppingBag,
        destino: pestanas[0].path, rutas: pestanas.map((p) => p.path), oculto,
        subitems: subitemsDe('compras', rol, userId, ocultos),
      }],
    };
  }).filter(Boolean).filter((g) => g.items.length);
}

/** Área de la ruta para la barra superior de escritorio («Almacén», «Compras», «Producción»…). */
export function areaDeRuta(grupos, ruta) {
  for (const g of grupos) {
    if (g.items.some((it) => it.rutas.includes(ruta))) return g.id === 'otros' ? tituloDeRutaR2(ruta) : g.titulo;
  }
  if (ruta === '/perfil') return 'Mi perfil';
  return tituloDeRutaR2(ruta);
}

// Barra inferior por rol (tabla de §3.1). Cada destino: clave del riel o ruta, texto de una palabra.
const INFERIOR = {
  administrador: [['/produccion', 'Producción', Factory], ['compras', 'Compras', ShoppingBag], ['/inventario', 'Inventario', Package], ['/calendario', 'Calendario', CalendarDays]],
  'diseñador': [['tickets:/pedido', 'Tickets', ClipboardList], ['/inventario', 'Inventario', Package], ['/produccion', 'Producción', Factory], ['/calendario', 'Calendario', CalendarDays]],
  almacen: [['tickets:/pedidos-pendientes', 'Tickets', ClipboardList], ['/inventario', 'Inventario', Package], ['/entradas-salidas', 'Entradas', ArrowUpDown], ['compras:/recepcion-mercancia', 'Recepción', PackageCheck]],
  compras: [['compras:/solicitudes-compra', 'Solicitudes', AlertCircle], ['compras:/ordenes-compra', 'Órdenes', FileText], ['compras:/recepcion-mercancia', 'Recepción', PackageCheck], ['compras:/proveedores', 'Proveedores', Truck]],
  encargado: [['/calendario', 'Calendario', CalendarDays], ['/mi-equipo', 'Equipo', UserRound], ['/control-campana', 'Campaña', Flag], ['compras:/proveedores', 'Proveedores', Truck]],
  ventas: [['/inventario', 'Inventario', Package], ['/calendario', 'Calendario', CalendarDays], ['/mi-equipo', 'Equipo', UserRound]],
  operador: [['/mi-equipo', 'Equipo', UserRound]],
};
const RUTAS_PRODUCCION = ['/produccion', '/avance-produccion', '/produccion/avisos'];

/** Destinos de la barra inferior del rol (solo los que el rol ya ve): [{clave, texto, icono, destino, rutas}]. */
export function inferiorR2(rol, grupos) {
  const todos = grupos.flatMap((g) => g.items);
  const porClave = (c) => todos.find((it) => it.clave === c);
  return (INFERIOR[rol] || []).map(([clave, texto, icono]) => {
    if (clave.includes(':')) {
      // Una pantalla dentro de una sección (tickets o compras): solo si el rol la ve como pestaña
      const [seccion, ruta] = clave.split(':');
      const it = porClave(seccion);
      if (!it || !it.rutas.includes(ruta)) return null;
      // Si el destino es la sección entera (Tickets), cuenta como activa en todas sus pestañas
      const rutas = seccion === 'tickets' ? it.rutas : [ruta];
      return { clave, texto, icono, destino: ruta, rutas };
    }
    if (clave === 'compras') {
      const it = porClave('compras');
      return it ? { clave, texto, icono, destino: it.destino, rutas: it.rutas } : null;
    }
    const it = porClave(clave);
    if (!it) return null;
    const rutas = clave === '/produccion' ? todos.filter((x) => RUTAS_PRODUCCION.includes(x.clave)).flatMap((x) => x.rutas) : it.rutas;
    return { clave, texto, icono, destino: it.destino, rutas };
  }).filter(Boolean).slice(0, 4);
}

/** A dónde lleva el logo: el inicio del rol (no /inventario). */
export const inicioDeRol = (rol) => rutaInicialPorRol(rol);
