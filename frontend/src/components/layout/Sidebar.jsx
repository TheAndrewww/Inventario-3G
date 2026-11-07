
import { Package, ShoppingCart, History, User, BarChart3, ClipboardList, Truck, CheckSquare, Users, UserCog, FileText, Wrench, PackageCheck, Calendar, Wand2, Factory, Flag, ClipboardCheck, PackageOpen, Layers, Briefcase, Inbox, AlertTriangle, ArrowUpDown, ShoppingBag, AlertCircle } from 'lucide-react';

// Definir todas las opciones del menú con sus roles permitidos.
// El array es el ORDEN POR DEFECTO. El usuario puede reordenar en la UI.
export const ALL_MENU_ITEMS = [
  { path: '/inventario', icon: Package, label: 'Inventario', roles: ['administrador', 'diseñador', 'almacen', 'ventas'] },
  { path: '/recepcion-mercancia', icon: PackageCheck, label: 'Recepción de Mercancía', roles: ['administrador', 'almacen'], grupo: 'compras' },
  { path: '/entradas-salidas', icon: ArrowUpDown, label: 'Entradas y Salidas', roles: ['administrador', 'almacen'] },
  { path: '/procesamiento-masivo', icon: Wand2, label: 'Procesamiento IA', roles: ['administrador'] },
  { path: '/pedido', icon: ShoppingCart, label: 'Orden de Salida', roles: ['administrador', 'diseñador'] },
  { path: '/pedidos-pendientes', icon: ClipboardList, label: 'Tickets Pendientes', roles: ['administrador', 'almacen'] },
  // 23-oct-2026: lo que los encargados piden a Almacén desde su tableta (llega por Operación)
  { path: '/pedidos-encargados', icon: Truck, label: 'Pedidos de encargados', roles: ['administrador', 'almacen'] },
  { path: '/camionetas', icon: Briefcase, label: 'Equipos', roles: ['administrador'] },
  { path: '/usuarios', icon: UserCog, label: 'Usuarios', roles: ['administrador'] },
  { path: '/solicitudes-cambio', icon: Inbox, label: 'Solicitudes', roles: ['administrador', 'almacen', 'compras'] },
  // B6 · PLA-11: sin el rol ventas (se publica después de DUE-20: el dueño revisa quién tiene ese rol). La ruta sigue igual; solo sale del menú.
  { path: '/ordenes-compra', icon: FileText, label: 'Órdenes de Compra', roles: ['administrador', 'diseñador', 'compras'], grupo: 'compras' },
  { path: '/solicitudes-compra', icon: AlertCircle, label: 'Solicitudes Pendientes', roles: ['administrador', 'diseñador', 'compras'], grupo: 'compras' },
  { path: '/calendario', icon: Calendar, label: 'Calendario', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'almacen'] },
  { path: '/mi-equipo', icon: User, label: 'Mi Equipo', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'operador'] },
  { path: '/produccion', icon: Factory, label: 'Dashboard Producción', roles: ['administrador', 'diseñador', 'almacen'] },
  { path: '/avance-produccion', icon: ClipboardCheck, label: 'Avance Producción', roles: ['administrador', 'almacen'] },
  { path: '/historial', icon: History, label: 'Historial', roles: ['administrador', 'diseñador'] },
  { path: '/proveedores', icon: Truck, label: 'Proveedores', roles: ['administrador', 'compras'], grupo: 'compras' },
  { path: '/control-campana', icon: Flag, label: 'Control Campaña', roles: ['administrador', 'diseñador', 'encargado', 'compras', 'almacen'] },
  { path: '/conteo-ciclico', icon: ClipboardCheck, label: 'Conteo Cíclico', roles: ['administrador', 'almacen'] },
  { path: '/descontar-almacen', icon: PackageOpen, label: 'Descuento Almacén', roles: ['administrador'] },
  { path: '/rollos-membrana', icon: Layers, label: 'Rollos Membrana', roles: ['administrador'] },
  { path: '/renta-herramientas', icon: Wrench, label: 'Renta Herramientas', roles: ['administrador'] },
  { path: '/reportes', icon: BarChart3, label: 'Reportes', roles: ['administrador'] },
  { path: '/stock-bajo', icon: AlertTriangle, label: 'Stock Bajo', roles: ['administrador'], grupo: 'compras' },
];

// Menús grandes que agrupan varias pantallas como sub-pestañas. Las rutas de cada
// pantalla NO cambian (las ligas de los avisos siguen sirviendo); solo se juntan
// bajo un solo renglón del menú. Este es el orden por defecto de las sub-pestañas;
// cada usuario lo puede cambiar arrastrando en "Personalizar".
export const MENU_GRUPOS = {
  compras: {
    path: '/compras',
    icon: ShoppingBag,
    label: 'Compras',
    orden: ['/solicitudes-compra', '/ordenes-compra', '/recepcion-mercancia', '/stock-bajo', '/proveedores']
  }
};

// Orden de sub-pestañas guardado por usuario (localStorage, igual que el menú)
const storageKeySub = (userId, grupoId) => `sidebar-suborder:${userId ?? 'anon'}:${grupoId}`;
// Aviso para que la barra de sub-pestañas se reacomode al instante
export const EVENTO_SUBORDEN = 'sidebar-suborden-cambio';

export const guardarSubOrden = (userId, grupoId, paths) => {
  try {
    if (paths) localStorage.setItem(storageKeySub(userId, grupoId), JSON.stringify(paths));
    else localStorage.removeItem(storageKeySub(userId, grupoId));
  } catch { /* storage lleno o bloqueado — ignorar */ }
  window.dispatchEvent(new Event(EVENTO_SUBORDEN));
};

// ¿El rol puede entrar a esta ruta del menú? Rutas fuera del menú: sí.
export const rolPuedeVer = (rol, path) => {
  const item = ALL_MENU_ITEMS.find(i => i.path === path);
  return !item || item.roles.includes(rol);
};

// Pantalla de inicio según el rol: Inventario si lo tiene; compras va a sus
// órdenes; el resto, a la primera vista de su menú (encargado → Calendario,
// operador → Mi Equipo). Antes todos caían en Inventario aunque no lo tuvieran.
export const rutaInicialPorRol = (rol) => {
  // Compras arrancaba en la vista de solicitudes; ahora es su propia sub-pestaña
  if (rol === 'compras') return '/solicitudes-compra';
  if (rolPuedeVer(rol, '/inventario')) return '/inventario';
  return ALL_MENU_ITEMS.find(i => i.roles.includes(rol))?.path || '/perfil';
};
