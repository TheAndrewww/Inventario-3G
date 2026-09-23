import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Package, ShoppingCart, History, User, Menu, BarChart3, ClipboardList, Truck, CheckSquare, Users, UserCog, FileText, Wrench, PackageCheck, Calendar, Wand2, Factory, Flag, ClipboardCheck, PackageOpen, Layers, Briefcase, GripVertical, RotateCcw, Check, Inbox, Eye, EyeOff, AlertTriangle, ArrowUpDown, ShoppingBag, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Definir todas las opciones del menú con sus roles permitidos.
// El array es el ORDEN POR DEFECTO. El usuario puede reordenar en la UI.
export const ALL_MENU_ITEMS = [
  { path: '/inventario', icon: Package, label: 'Inventario', roles: ['administrador', 'diseñador', 'almacen', 'ventas'] },
  { path: '/recepcion-mercancia', icon: PackageCheck, label: 'Recepción de Mercancía', roles: ['administrador', 'almacen'], grupo: 'compras' },
  { path: '/entradas-salidas', icon: ArrowUpDown, label: 'Entradas y Salidas', roles: ['administrador', 'almacen'] },
  { path: '/procesamiento-masivo', icon: Wand2, label: 'Procesamiento IA', roles: ['administrador'] },
  { path: '/pedido', icon: ShoppingCart, label: 'Orden de Salida', roles: ['administrador', 'diseñador'] },
  { path: '/pedidos-pendientes', icon: ClipboardList, label: 'Tickets Pendientes', roles: ['administrador', 'almacen'] },
  { path: '/camionetas', icon: Briefcase, label: 'Equipos', roles: ['administrador'] },
  { path: '/usuarios', icon: UserCog, label: 'Usuarios', roles: ['administrador'] },
  { path: '/solicitudes-cambio', icon: Inbox, label: 'Solicitudes', roles: ['administrador', 'almacen', 'compras'] },
  { path: '/ordenes-compra', icon: FileText, label: 'Órdenes de Compra', roles: ['administrador', 'diseñador', 'ventas', 'compras'], grupo: 'compras' },
  { path: '/solicitudes-compra', icon: AlertCircle, label: 'Solicitudes Pendientes', roles: ['administrador', 'diseñador', 'ventas', 'compras'], grupo: 'compras' },
  { path: '/calendario', icon: Calendar, label: 'Calendario', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'almacen'] },
  { path: '/mi-equipo', icon: User, label: 'Mi Equipo', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'operador'] },
  { path: '/produccion', icon: Factory, label: 'Dashboard Producción', roles: ['administrador', 'diseñador', 'almacen'] },
  { path: '/avance-produccion', icon: ClipboardCheck, label: 'Avance Producción', roles: ['administrador', 'almacen'] },
  { path: '/historial', icon: History, label: 'Historial', roles: ['administrador', 'diseñador'] },
  { path: '/proveedores', icon: Truck, label: 'Proveedores', roles: ['administrador', 'compras'], grupo: 'compras' },
  { path: '/control-campana', icon: Flag, label: 'Control Campaña', roles: ['administrador', 'diseñador', 'encargado', 'compras'] },
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

const leerSubOrden = (userId, grupoId) => {
  try {
    const raw = localStorage.getItem(storageKeySub(userId, grupoId));
    const saved = raw ? JSON.parse(raw) : null;
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
};

export const guardarSubOrden = (userId, grupoId, paths) => {
  try {
    if (paths) localStorage.setItem(storageKeySub(userId, grupoId), JSON.stringify(paths));
    else localStorage.removeItem(storageKeySub(userId, grupoId));
  } catch { /* storage lleno o bloqueado — ignorar */ }
  window.dispatchEvent(new Event(EVENTO_SUBORDEN));
};

// Sub-pestañas del grupo que puede ver el rol, en el orden del usuario (o el de fábrica)
export const subPestanasGrupo = (grupoId, rol, userId) => {
  const grupo = MENU_GRUPOS[grupoId];
  if (!grupo) return [];
  const saved = leerSubOrden(userId, grupoId) || [];
  // Primero lo guardado, luego lo que falte (sub-pestañas nuevas) en su orden de fábrica
  const orden = [...saved.filter(p => grupo.orden.includes(p)), ...grupo.orden.filter(p => !saved.includes(p))];
  return orden
    .map(path => ALL_MENU_ITEMS.find(i => i.path === path))
    .filter(item => item && item.roles.includes(rol));
};

// Grupo al que pertenece una ruta (o null)
export const grupoDeRuta = (path) => ALL_MENU_ITEMS.find(i => i.path === path)?.grupo || null;

// Junta los items de un grupo en un solo renglón, en el lugar del primero que aparezca
const agruparItems = (items, rol, userId) => {
  const vistos = new Set();
  const resultado = [];
  for (const item of items) {
    if (!item.grupo) { resultado.push(item); continue; }
    if (vistos.has(item.grupo)) continue;
    vistos.add(item.grupo);
    const grupo = MENU_GRUPOS[item.grupo];
    resultado.push({ ...grupo, grupoId: item.grupo, children: subPestanasGrupo(item.grupo, rol, userId) });
  }
  return resultado;
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

const storageKey = (userId) => `sidebar-order:${userId ?? 'anon'}`;
const storageKeyHidden = (userId) => `sidebar-hidden:${userId ?? 'anon'}`;

// Dado el array por defecto y un orden guardado (paths), devuelve items en
// orden preferido. Items nuevos (que no están en el saved) van al final.
const aplicarOrdenGuardado = (defaultItems, savedPaths) => {
  if (!Array.isArray(savedPaths) || savedPaths.length === 0) return defaultItems;
  const byPath = new Map(defaultItems.map(i => [i.path, i]));
  const ordenados = [];
  // Órdenes guardados antes de existir los grupos traen la ruta de una sub-pestaña:
  // el grupo toma el lugar de la primera que aparezca.
  const deGrupo = new Map(defaultItems.filter(i => i.children).flatMap(g => g.children.map(c => [c.path, g.path])));
  for (const guardado of savedPaths) {
    const p = deGrupo.get(guardado) || guardado;
    if (byPath.has(p)) {
      ordenados.push(byPath.get(p));
      byPath.delete(p);
    }
  }
  // Los que quedan en byPath son nuevos o con orden no persistido → al final
  for (const i of byPath.values()) ordenados.push(i);
  return ordenados;
};

const Sidebar = ({ isOpen, toggleSidebar, isMobile, onNavigate }) => {
  const location = useLocation();
  const { user } = useAuth();

  // Filtrar por rol primero, y aplicar orden guardado
  // Sube cada vez que alguien reordena sub-pestañas, para recalcular el menú
  const [versionSubOrden, setVersionSubOrden] = useState(0);
  useEffect(() => {
    const alCambiar = () => setVersionSubOrden(v => v + 1);
    window.addEventListener(EVENTO_SUBORDEN, alCambiar);
    return () => window.removeEventListener(EVENTO_SUBORDEN, alCambiar);
  }, []);

  const itemsFiltrados = useMemo(
    () => agruparItems(ALL_MENU_ITEMS.filter(item => item.roles.includes(user?.rol)), user?.rol, user?.id),
    [user?.rol, user?.id, versionSubOrden]
  );

  // Arrastre de sub-pestañas dentro de su grupo (independiente del de los renglones)
  const subDragRef = useRef(null); // { grupoId, index }
  const [subDragOver, setSubDragOver] = useState(null); // `${grupoId}:${index}`

  const handleSubDrop = (e, grupo, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const origen = subDragRef.current;
    subDragRef.current = null;
    setSubDragOver(null);
    if (!origen || origen.grupoId !== grupo.grupoId || origen.index === dropIndex) return;
    const paths = grupo.children.map(c => c.path);
    const [movido] = paths.splice(origen.index, 1);
    paths.splice(dropIndex, 0, movido);
    // Se guardan también las que este rol no ve, al final, para no perderlas
    const resto = MENU_GRUPOS[grupo.grupoId].orden.filter(p => !paths.includes(p));
    guardarSubOrden(user?.id, grupo.grupoId, [...paths, ...resto]);
  };
  const navigate = useNavigate();
  // Grupos desplegados a mano (el del panel activo siempre se ve abierto)
  const [gruposAbiertos, setGruposAbiertos] = useState(new Set());
  const toggleGrupo = (path) => setGruposAbiertos(prev => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  const [menuItems, setMenuItems] = useState(itemsFiltrados);
  const [editMode, setEditMode] = useState(false);
  const [hiddenPaths, setHiddenPaths] = useState(new Set());
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Cargar orden y ocultos guardados al montar / cuando cambia el usuario
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(user?.id));
      const saved = raw ? JSON.parse(raw) : null;
      setMenuItems(aplicarOrdenGuardado(itemsFiltrados, saved));
    } catch {
      setMenuItems(itemsFiltrados);
    }
    try {
      const rawH = localStorage.getItem(storageKeyHidden(user?.id));
      const savedH = rawH ? JSON.parse(rawH) : [];
      setHiddenPaths(new Set(Array.isArray(savedH) ? savedH : []));
    } catch {
      setHiddenPaths(new Set());
    }
  }, [itemsFiltrados, user?.id]);

  const persistirOrden = (items) => {
    try {
      localStorage.setItem(storageKey(user?.id), JSON.stringify(items.map(i => i.path)));
    } catch { /* storage lleno o bloqueado — ignorar */ }
  };

  const persistirOcultos = (paths) => {
    try {
      localStorage.setItem(storageKeyHidden(user?.id), JSON.stringify([...paths]));
    } catch { /* ignorar */ }
  };

  const toggleOculto = (path) => {
    setHiddenPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      persistirOcultos(next);
      return next;
    });
  };

  const mostrarTodos = () => {
    try { localStorage.removeItem(storageKeyHidden(user?.id)); } catch {}
    setHiddenPaths(new Set());
  };

  const resetOrden = () => {
    try { localStorage.removeItem(storageKey(user?.id)); } catch {}
    Object.keys(MENU_GRUPOS).forEach(grupoId => guardarSubOrden(user?.id, grupoId, null));
    setMenuItems(itemsFiltrados);
  };

  // Items que se renderizan en la nav: en modo edición se ven todos (con los
  // ocultos en gris); fuera de edición se filtran los ocultos.
  const itemsParaRender = editMode
    ? menuItems
    : menuItems.filter(i => !hiddenPaths.has(i.path));

  const handleDragStart = (e, index) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // En algunos navegadores se requiere setData para activar el drag
    try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === dropIndex) return;

    setMenuItems(prev => {
      const copia = [...prev];
      const [movido] = copia.splice(dragIndex, 1);
      copia.splice(dropIndex, 0, movido);
      persistirOrden(copia);
      return copia;
    });
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div
      className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
        ${isOpen ? 'w-64' : isMobile ? '-translate-x-full' : 'w-20'}
        bg-white border-r border-gray-200 transition-all duration-300 flex flex-col
        ${isMobile ? 'transform' : ''}
      `}
    >
      {/* Header del Sidebar */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {isOpen && (
          <div className="flex items-center gap-2">
            <img
              src="https://res.cloudinary.com/dd93jrilg/image/upload/v1762289946/logo-page_qhpoey.png"
              alt="Logo 3G"
              className="w-10 h-10 object-contain rounded-lg"
            />
            <div>
              <h1 className="font-bold text-gray-900">ERP 3G</h1>
              <p className="text-xs text-gray-500">Inventario v1.0</p>
            </div>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isOpen ? 'Colapsar' : 'Expandir'}
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      {/* Barra de personalización (reordenar + ocultar) — solo con sidebar abierto */}
      {isOpen && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setEditMode(m => !m)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${editMode
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            title={editMode ? 'Terminar de personalizar' : 'Personalizar menú (reordenar y ocultar)'}
          >
            {editMode ? <Check size={14} /> : <GripVertical size={14} />}
            {editMode ? 'Listo' : 'Personalizar'}
          </button>
          {editMode && (
            <div className="flex items-center gap-1">
              {hiddenPaths.size > 0 && (
                <button
                  onClick={mostrarTodos}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  title="Mostrar todos los paneles"
                >
                  <Eye size={14} />
                  Mostrar todos
                </button>
              )}
              <button
                onClick={resetOrden}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                title="Restaurar orden original"
              >
                <RotateCcw size={14} />
                Orden
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {itemsParaRender.map((item, index) => {
          const Icon = item.icon;
          const grupoActivo = !!item.children?.some(c => c.path === location.pathname);
          const isActive = location.pathname === item.path || grupoActivo;
          const isDragOver = editMode && dragOverIndex === index;
          const isHidden = hiddenPaths.has(item.path);

          const commonClasses = `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
            ? 'bg-red-50 text-red-700'
            : 'text-gray-700 hover:bg-gray-100'
            } ${editMode ? 'cursor-grab active:cursor-grabbing border border-dashed border-gray-300' : ''
            } ${isDragOver ? 'ring-2 ring-red-300' : ''
            } ${isHidden ? 'opacity-50' : ''}`;

          const content = (
            <>
              {editMode && isOpen && <GripVertical size={16} className="text-gray-400 shrink-0" />}
              <Icon size={20} />
              {isOpen && <span className={`font-medium flex-1 ${isHidden ? 'line-through' : ''}`}>{item.label}</span>}
              {editMode && isOpen && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleOculto(item.path); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-1 rounded ${isHidden ? 'text-gray-400 hover:bg-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                  title={isHidden ? 'Mostrar este panel' : 'Ocultar este panel'}
                  draggable={false}
                >
                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </>
          );

          // En modo edición renderizamos un div arrastrable (no navegable)
          if (editMode) {
            const renglon = (
              <div
                key={item.path}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={commonClasses}
              >
                {content}
              </div>
            );
            if (!item.children || !isOpen) return renglon;

            // Grupo: además del renglón, sus sub-pestañas se reordenan arrastrando
            return (
              <div key={item.path}>
                {renglon}
                <div className="mt-1 ml-5 pl-3 border-l-2 border-red-100 space-y-1">
                  {item.children.map((child, subIndex) => {
                    const ChildIcon = child.icon;
                    const marca = `${item.grupoId}:${subIndex}`;
                    return (
                      <div
                        key={child.path}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          subDragRef.current = { grupoId: item.grupoId, index: subIndex };
                          e.dataTransfer.effectAllowed = 'move';
                          try { e.dataTransfer.setData('text/plain', child.path); } catch {}
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (subDragOver !== marca) setSubDragOver(marca);
                        }}
                        onDrop={(e) => handleSubDrop(e, item, subIndex)}
                        onDragEnd={(e) => { e.stopPropagation(); subDragRef.current = null; setSubDragOver(null); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 cursor-grab active:cursor-grabbing border border-dashed border-gray-300 ${subDragOver === marca ? 'ring-2 ring-red-300' : ''}`}
                      >
                        <GripVertical size={14} className="text-gray-400 shrink-0" />
                        <ChildIcon size={16} />
                        <span>{child.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (item.children) {
            const abierto = grupoActivo || gruposAbiertos.has(item.path);
            return (
              <div key={item.path}>
                <button
                  type="button"
                  onClick={() => {
                    // Colapsado no hay dónde desplegar: se va directo a la primera sub-pestaña
                    if (!isOpen) {
                      if (item.children[0]) navigate(item.children[0].path);
                      return;
                    }
                    toggleGrupo(item.path);
                  }}
                  className={commonClasses}
                  title={isOpen ? undefined : item.label}
                >
                  {content}
                  {isOpen && (abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                </button>
                {isOpen && abierto && (
                  <div className="mt-1 ml-5 pl-3 border-l-2 border-red-100 space-y-1">
                    {item.children.map(child => {
                      const ChildIcon = child.icon;
                      const childActive = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={onNavigate}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${childActive
                            ? 'bg-red-50 text-red-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          <ChildIcon size={16} />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={commonClasses}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <Link
          to="/perfil"
          onClick={onNavigate}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/perfil'
            ? 'bg-red-50 text-red-700'
            : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
          <User size={20} />
          {isOpen && (
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Usuario</p>
              <p className="text-xs text-gray-500">Ver perfil</p>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
