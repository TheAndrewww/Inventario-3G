// Diseño 3G — menú de Planta (solo se usa con el interruptor encendido).
// Las RUTAS NO CAMBIAN (las ligas de WhatsApp y correo siguen sirviendo) y los PERMISOS salen del mismo
// ALL_MENU_ITEMS del menú de siempre (rolPuedeVer): aquí solo se agrupan, se renombran y se ordenan.
import {
  Package, ClipboardList, ArrowUpDown, ClipboardCheck, Inbox, Layers, PackageOpen, Wand2, AlertCircle, FileText,
  PackageCheck, AlertTriangle, Truck, Factory, Gauge, Flag, CalendarDays, Briefcase, Wrench, UserRound, UserCog,
  BarChart3, ShoppingCart, History, ShoppingBag,
} from 'lucide-react';
import { ALL_MENU_ITEMS, MENU_GRUPOS } from '../components/layout/Sidebar';

// Preferencias del riel en claves PROPIAS (prefijo g3-): lo que se personaliza con Diseño 3G no toca el menú de siempre
// (sidebar-hidden, sidebar-order y sidebar-suborder siguen siendo solo del menú de siempre).
export const claveOcultosG3 = (userId) => `g3-riel-ocultos:${userId ?? 'anon'}`;
export const claveOrdenG3 = (userId) => `g3-riel-orden:${userId ?? 'anon'}`;
const claveSubOrdenG3 = (userId, grupoId) => `g3-riel-suborden:${userId ?? 'anon'}:${grupoId}`;
export const EVENTO_SUBORDEN_G3 = 'g3-riel-suborden-cambio';
const leerSubOrdenG3 = (userId, grupoId) => {
  try { const v = JSON.parse(localStorage.getItem(claveSubOrdenG3(userId, grupoId))); return Array.isArray(v) ? v : null; } catch { return null; }
};
export const guardarSubOrdenG3 = (userId, grupoId, paths) => {
  try {
    if (paths) localStorage.setItem(claveSubOrdenG3(userId, grupoId), JSON.stringify(paths));
    else localStorage.removeItem(claveSubOrdenG3(userId, grupoId));
  } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENTO_SUBORDEN_G3));
};
// Pestañas de un grupo (Compras) que ve el rol, en el orden que el usuario puso en el riel (o el de fábrica).
// Misma regla que subPestanasGrupo del menú de siempre, pero con su propia clave.
const subPestanasG3 = (grupoId, rol, userId) => {
  const grupo = MENU_GRUPOS[grupoId];
  if (!grupo) return [];
  const saved = leerSubOrdenG3(userId, grupoId) || [];
  const orden = [...saved.filter((p) => grupo.orden.includes(p)), ...grupo.orden.filter((p) => !saved.includes(p))];
  return orden.map((path) => ALL_MENU_ITEMS.find((i) => i.path === path)).filter((item) => item && item.roles.includes(rol));
};

// Nombre claro de cada pantalla (barra superior, riel y pestañas)
export const TITULOS = {
  '/inventario': 'Inventario',
  '/pedido': 'Orden de salida',
  '/pedidos-pendientes': 'Tickets pendientes',
  '/historial': 'Historial de tickets',
  '/entradas-salidas': 'Entradas y salidas',
  '/conteo-ciclico': 'Conteo cíclico',
  '/solicitudes-cambio': 'Cambios por autorizar',
  '/rollos-membrana': 'Rollos de membrana',
  '/descontar-almacen': 'Descuento de almacén',
  '/procesamiento-masivo': 'Fotos de artículos con IA',
  '/solicitudes-compra': 'Solicitudes de compra',
  '/ordenes-compra': 'Órdenes de compra',
  '/recepcion-mercancia': 'Recepción de mercancía',
  '/stock-bajo': 'Stock bajo',
  '/proveedores': 'Proveedores',
  '/produccion': 'Tablero de producción',
  '/avance-produccion': 'Avance por área',
  '/control-campana': 'Campaña de control',
  '/calendario': 'Calendario de instalaciones',
  '/camionetas': 'Equipos',
  '/renta-herramientas': 'Herramientas de renta',
  '/mi-equipo': 'Mi equipo',
  '/usuarios': 'Usuarios',
  '/reportes': 'Reportes',
  '/perfil': 'Mi perfil',
};
export const tituloDeRuta = (ruta) => TITULOS[ruta] || 'Planta';

// Secciones con pestañas: varias pantallas (rutas de siempre) bajo un solo renglón del riel.
export const SECCIONES = {
  tickets: {
    titulo: 'Tickets de material',
    descripcion: 'Arma la orden de salida, surte los tickets pendientes y consulta el historial.',
    icono: ClipboardList,
    pestanas: [
      { path: '/pedido', etiqueta: 'Orden de salida', icono: ShoppingCart },
      { path: '/pedidos-pendientes', etiqueta: 'Tickets pendientes', icono: ClipboardList },
      { path: '/historial', etiqueta: 'Historial', icono: History },
    ],
  },
  compras: {
    titulo: 'Compras',
    descripcion: 'Solicitudes, órdenes de compra, recepción de mercancía, stock bajo y proveedores.',
    icono: ShoppingBag,
    // El orden lo pone cada usuario desde «Personalizar menú» del riel (clave propia g3-riel-suborden)
    pestanas: null,
  },
};

const ICONOS_COMPRAS = {
  '/solicitudes-compra': AlertCircle, '/ordenes-compra': FileText, '/recepcion-mercancia': PackageCheck,
  '/stock-bajo': AlertTriangle, '/proveedores': Truck,
};

// Pestañas visibles de una sección para el rol (y el usuario, por el orden guardado)
export const pestanasDeSeccion = (id, rol, userId) => {
  if (id === 'compras') {
    return subPestanasG3('compras', rol, userId).map((i) => ({ path: i.path, etiqueta: TITULOS[i.path] || i.label, icono: ICONOS_COMPRAS[i.path] || i.icon }));
  }
  return (SECCIONES[id]?.pestanas || []).filter((p) => ALL_MENU_ITEMS.some((i) => i.path === p.path && i.roles.includes(rol)));
};

export const seccionDeRuta = (ruta) => {
  if (SECCIONES.tickets.pestanas.some((p) => p.path === ruta)) return 'tickets';
  if (ALL_MENU_ITEMS.find((i) => i.path === ruta)?.grupo === 'compras') return 'compras';
  return null;
};

// Riel agrupado como en la maqueta. Cada renglón es una ruta del menú de siempre o una sección con pestañas.
export const GRUPOS_RIEL = [
  { id: 'almacen', titulo: 'Almacén', items: [
    { path: '/inventario', icono: Package },
    { seccion: 'tickets', path: 'tickets', etiqueta: 'Tickets de material', icono: ClipboardList },
    { path: '/entradas-salidas', icono: ArrowUpDown },
    { path: '/conteo-ciclico', icono: ClipboardCheck },
    { path: '/solicitudes-cambio', icono: Inbox },
    { path: '/rollos-membrana', icono: Layers },
    { path: '/descontar-almacen', icono: PackageOpen },
    { path: '/procesamiento-masivo', icono: Wand2 },
  ] },
  { id: 'compras', titulo: 'Compras', items: [
    { path: '/solicitudes-compra', icono: AlertCircle },
    { path: '/ordenes-compra', icono: FileText },
    { path: '/recepcion-mercancia', icono: PackageCheck },
    { path: '/stock-bajo', icono: AlertTriangle },
    { path: '/proveedores', icono: Truck },
  ] },
  { id: 'produccion', titulo: 'Producción', items: [
    { path: '/produccion', icono: Factory },
    { path: '/avance-produccion', icono: Gauge },
  ] },
  { id: 'calendario', titulo: 'Calendario', items: [
    { path: '/calendario', icono: CalendarDays },
  ] },
  { id: 'herramientas', titulo: 'Herramientas y cuadrillas', items: [
    { path: '/camionetas', icono: Briefcase },
    { path: '/renta-herramientas', icono: Wrench },
    { path: '/mi-equipo', icono: UserRound },
  ] },
  { id: 'administracion', titulo: 'Administración', items: [
    { path: '/usuarios', icono: UserCog },
    { path: '/reportes', icono: BarChart3 },
    // A12.2 · PLA-11: Control de campaña pasa de Producción a Administración (mismos roles y misma ruta)
    { path: '/control-campana', icono: Flag },
  ] },
];
// B6 · PLA-11: el rol ventas ya no ve «Órdenes de compra» ni «Solicitudes de compra». Los permisos de este riel salen
// de ALL_MENU_ITEMS (Sidebar.jsx), así que el cambio de roles de allí aplica igual al menú de siempre y a este.

// Riel para un rol: solo lo que el rol ve hoy (mismos permisos), sin los paneles que el usuario ocultó.
export const rielParaRol = (rol, userId, ocultos = new Set()) => GRUPOS_RIEL.map((g) => ({
  ...g,
  items: g.items.map((it) => {
    if (it.seccion) {
      const pestanas = pestanasDeSeccion(it.seccion, rol, userId);
      if (!pestanas.length) return null;
      return { ...it, clave: it.seccion, destino: pestanas[0].path, rutas: pestanas.map((p) => p.path), oculto: ocultos.has(it.seccion) || pestanas.every((p) => ocultos.has(p.path)) };
    }
    const base = ALL_MENU_ITEMS.find((i) => i.path === it.path);
    if (!base || !base.roles.includes(rol)) return null;
    return { ...it, clave: it.path, destino: it.path, rutas: [it.path], etiqueta: TITULOS[it.path] || base.label, oculto: ocultos.has(it.path) };
  }).filter(Boolean),
})).concat(otrosParaRol(rol, ocultos)).filter((g) => g.items.length);

// Red de seguridad: si mañana se agrega una pantalla a ALL_MENU_ITEMS y no se pone en GRUPOS_RIEL, aparece en «Otros»
// (nunca se queda sin ruta con Diseño 3G).
const enRiel = () => new Set(GRUPOS_RIEL.flatMap((g) => g.items.flatMap((it) => (it.seccion ? SECCIONES[it.seccion].pestanas?.map((p) => p.path) || [] : [it.path]))));
function otrosParaRol(rol, ocultos) {
  const ya = enRiel();
  const items = ALL_MENU_ITEMS.filter((i) => !ya.has(i.path) && i.grupo !== 'compras' && i.roles.includes(rol))
    .map((i) => ({ path: i.path, clave: i.path, destino: i.path, rutas: [i.path], etiqueta: TITULOS[i.path] || i.label, icono: i.icon, oculto: ocultos.has(i.path) }));
  return [{ id: 'otros', titulo: 'Otros', items }];
}
