import React from 'react';
import { Package, ShoppingCart, History, User, Menu, BarChart3, ClipboardList, Truck, CheckSquare, Users, UserCog, FileText, Wrench, PackagePlus, Calendar, Wand2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, toggleSidebar, isMobile, onNavigate }) => {
  const location = useLocation();
  const { user } = useAuth();

  // Definir todas las opciones del menú con sus roles permitidos
  const allMenuItems = [
    {
      path: '/inventario',
      icon: Package,
      label: 'Inventario',
      roles: ['administrador', 'diseñador', 'almacen', 'ventas']
    },
    {
      path: '/entrada-inventario',
      icon: PackagePlus,
      label: 'Entrada Inventario',
      roles: ['administrador', 'almacen', 'ventas']
    },
    {
      path: '/procesamiento-masivo',
      icon: Wand2,
      label: 'Procesamiento IA',
      roles: ['administrador', 'almacen', 'encargado']
    },
    {
      path: '/pedido',
      icon: ShoppingCart,
      label: 'Pedido Actual',
      roles: ['administrador', 'diseñador', 'almacen']
    },
    {
      path: '/pedidos-pendientes',
      icon: ClipboardList,
      label: 'Pedidos Pendientes',
      roles: ['administrador', 'almacen']
    },
    {
      path: '/monitor-pedidos',
      icon: BarChart3,
      label: 'Monitor Pedidos',
      roles: ['administrador', 'almacen', 'encargado']
    },
    {
      path: '/recibir-pedidos',
      icon: CheckSquare,
      label: 'Recibir Pedidos',
      roles: ['administrador', 'encargado']
    },
    {
      path: '/equipos',
      icon: Users,
      label: 'Equipos',
      roles: ['administrador', 'encargado']
    },
    {
      path: '/usuarios',
      icon: UserCog,
      label: 'Usuarios',
      roles: ['administrador']
    },
    {
      path: '/ordenes-compra',
      icon: FileText,
      label: 'Órdenes de Compra',
      roles: ['administrador', 'diseñador', 'ventas', 'compras']
    },
    {
      path: '/renta-herramientas',
      icon: Wrench,
      label: 'Renta Herramientas',
      roles: ['administrador', 'encargado']
    },
    {
      path: '/calendario',
      icon: Calendar,
      label: 'Calendario',
      roles: ['administrador', 'diseñador', 'almacen', 'ventas', 'compras', 'encargado']
    },
    {
      path: '/historial',
      icon: History,
      label: 'Historial',
      roles: ['administrador', 'diseñador']
    },
    {
      path: '/proveedores',
      icon: Truck,
      label: 'Proveedores',
      roles: ['administrador', 'compras', 'encargado']
    },
    {
      path: '/reportes',
      icon: BarChart3,
      label: 'Reportes',
      roles: ['administrador', 'encargado']
    },
  ];

  // Filtrar los items del menú según el rol del usuario
  const menuItems = allMenuItems.filter(item =>
    item.roles.includes(user?.rol)
  );

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
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-red-50 text-red-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <Link
          to="/perfil"
          onClick={onNavigate}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            location.pathname === '/perfil'
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
