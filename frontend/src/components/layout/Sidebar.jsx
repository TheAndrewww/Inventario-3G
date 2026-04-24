import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Package, ShoppingCart, History, User, Menu, BarChart3, ClipboardList, Truck, CheckSquare, Users, UserCog, FileText, Wrench, PackageCheck, Calendar, Wand2, Factory, Flag, ClipboardCheck, PackageOpen, Layers, Briefcase, GripVertical, RotateCcw, Check } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Definir todas las opciones del menú con sus roles permitidos.
// El array es el ORDEN POR DEFECTO. El usuario puede reordenar en la UI.
const ALL_MENU_ITEMS = [
  { path: '/inventario', icon: Package, label: 'Inventario', roles: ['administrador', 'diseñador', 'almacen', 'ventas'] },
  { path: '/recepcion-mercancia', icon: PackageCheck, label: 'Recepción Mercancía', roles: ['administrador', 'almacen'] },
  { path: '/procesamiento-masivo', icon: Wand2, label: 'Procesamiento IA', roles: ['administrador', 'encargado'] },
  { path: '/pedido', icon: ShoppingCart, label: 'Pedido Actual', roles: ['administrador', 'diseñador'] },
  { path: '/pedidos-pendientes', icon: ClipboardList, label: 'Pedidos Pendientes', roles: ['administrador', 'almacen'] },
  { path: '/monitor-pedidos', icon: BarChart3, label: 'Monitor Pedidos', roles: ['administrador', 'encargado'] },
  { path: '/camionetas', icon: Briefcase, label: 'Equipos', roles: ['administrador', 'encargado'] },
  { path: '/usuarios', icon: UserCog, label: 'Usuarios', roles: ['administrador'] },
  { path: '/ordenes-compra', icon: FileText, label: 'Órdenes de Compra', roles: ['administrador', 'diseñador', 'ventas', 'compras'] },
  { path: '/renta-herramientas', icon: Wrench, label: 'Renta Herramientas', roles: ['administrador', 'encargado', 'almacen'] },
  { path: '/calendario', icon: Calendar, label: 'Calendario', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'almacen'] },
  { path: '/mi-equipo', icon: User, label: 'Mi Equipo', roles: ['administrador', 'diseñador', 'ventas', 'encargado', 'operador'] },
  { path: '/produccion', icon: Factory, label: 'Dashboard Producción', roles: ['administrador', 'diseñador', 'encargado'] },
  { path: '/avance-produccion', icon: ClipboardCheck, label: 'Avance Producción', roles: ['administrador', 'almacen'] },
  { path: '/historial', icon: History, label: 'Historial', roles: ['administrador', 'diseñador'] },
  { path: '/proveedores', icon: Truck, label: 'Proveedores', roles: ['administrador', 'compras', 'encargado'] },
  { path: '/control-campana', icon: Flag, label: 'Control Campaña', roles: ['administrador', 'diseñador', 'encargado'] },
  { path: '/conteo-ciclico', icon: ClipboardCheck, label: 'Conteo Cíclico', roles: ['administrador', 'almacen', 'encargado'] },
  { path: '/descontar-almacen', icon: PackageOpen, label: 'Descuento Almacén', roles: ['administrador', 'encargado'] },
  { path: '/rollos-membrana', icon: Layers, label: 'Rollos Membrana', roles: ['administrador', 'encargado'] },
  { path: '/reportes', icon: BarChart3, label: 'Reportes', roles: ['administrador', 'encargado'] },
];

const storageKey = (userId) => `sidebar-order:${userId ?? 'anon'}`;

// Dado el array por defecto y un orden guardado (paths), devuelve items en
// orden preferido. Items nuevos (que no están en el saved) van al final.
const aplicarOrdenGuardado = (defaultItems, savedPaths) => {
  if (!Array.isArray(savedPaths) || savedPaths.length === 0) return defaultItems;
  const byPath = new Map(defaultItems.map(i => [i.path, i]));
  const ordenados = [];
  for (const p of savedPaths) {
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
  const itemsFiltrados = useMemo(
    () => ALL_MENU_ITEMS.filter(item => item.roles.includes(user?.rol)),
    [user?.rol]
  );

  const [menuItems, setMenuItems] = useState(itemsFiltrados);
  const [editMode, setEditMode] = useState(false);
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Cargar orden guardado al montar / cuando cambia el usuario
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(user?.id));
      const saved = raw ? JSON.parse(raw) : null;
      setMenuItems(aplicarOrdenGuardado(itemsFiltrados, saved));
    } catch {
      setMenuItems(itemsFiltrados);
    }
  }, [itemsFiltrados, user?.id]);

  const persistirOrden = (items) => {
    try {
      localStorage.setItem(storageKey(user?.id), JSON.stringify(items.map(i => i.path)));
    } catch { /* storage lleno o bloqueado — ignorar */ }
  };

  const resetOrden = () => {
    try { localStorage.removeItem(storageKey(user?.id)); } catch {}
    setMenuItems(itemsFiltrados);
  };

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

      {/* Barra de reordenar — solo visible con sidebar abierto */}
      {isOpen && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
          <button
            onClick={() => setEditMode(m => !m)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${editMode
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            title={editMode ? 'Terminar de reordenar' : 'Reordenar menú'}
          >
            {editMode ? <Check size={14} /> : <GripVertical size={14} />}
            {editMode ? 'Listo' : 'Reordenar'}
          </button>
          {editMode && (
            <button
              onClick={resetOrden}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              title="Restaurar orden original"
            >
              <RotateCcw size={14} />
              Restaurar
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isDragOver = editMode && dragOverIndex === index;

          const commonClasses = `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
            ? 'bg-red-50 text-red-700'
            : 'text-gray-700 hover:bg-gray-100'
            } ${editMode ? 'cursor-grab active:cursor-grabbing border border-dashed border-gray-300' : ''
            } ${isDragOver ? 'ring-2 ring-red-300' : ''}`;

          const content = (
            <>
              {editMode && isOpen && <GripVertical size={16} className="text-gray-400 shrink-0" />}
              <Icon size={20} />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </>
          );

          // En modo edición renderizamos un div arrastrable (no navegable)
          if (editMode) {
            return (
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
