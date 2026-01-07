import React from 'react';
import { Settings, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import NotificacionesDropdown from '../common/NotificacionesDropdown';

const Header = ({ toggleSidebar, isMobile }) => {
  const location = useLocation();

  const getTitleByPath = () => {
    const titles = {
      '/inventario': 'Inventario',
      '/pedido': 'Pedido Actual',
      '/pedidos-pendientes': 'Pedidos Pendientes',
      '/aprobacion-pedidos': 'Aprobar Pedidos',
      '/camionetas': 'Camionetas',
      '/usuarios': 'Usuarios',
      '/historial': 'Historial de Movimientos',
      '/perfil': 'Mi Perfil',
      '/proveedores': 'Proveedores',
      '/reportes': 'Reportes',
      '/ordenes-compra': 'Órdenes de Compra',
      '/entrada-inventario': 'Entrada Inventario',
      '/recibir-pedidos': 'Recibir Pedidos',
      '/renta-herramientas': 'Renta Herramientas'
    };
    return titles[location.pathname] || 'Dashboard';
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 md:gap-4">
        {/* Botón hamburguesa solo en móvil */}
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
        )}
        <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate">
          {getTitleByPath()}
        </h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <NotificacionesDropdown />

        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden md:block">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};

export default Header;
