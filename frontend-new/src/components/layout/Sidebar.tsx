import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, History, BarChart3, User, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePedido } from '../../context/PedidoContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { carrito } = usePedido();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`${isOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-700 rounded-lg flex items-center justify-center text-white font-bold">
              3G
            </div>
            <div>
              <h1 className="font-bold text-gray-900">ERP 3G</h1>
              <p className="text-xs text-gray-500">Inventario v1.0</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => navigate('/inventario')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/inventario') ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Package size={20} />
          {isOpen && <span className="font-medium">Inventario</span>}
        </button>

        <button
          onClick={() => navigate('/pedido')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
            isActive('/pedido') ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <ShoppingCart size={20} />
          {isOpen && <span className="font-medium">Pedido Actual</span>}
          {carrito.length > 0 && (
            <span className="absolute top-2 left-8 bg-red-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {carrito.length}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/historial')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/historial') ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <History size={20} />
          {isOpen && <span className="font-medium">Historial</span>}
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <BarChart3 size={20} />
          {isOpen && <span className="font-medium">Reportes</span>}
        </button>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/perfil')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/perfil') ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <User size={20} />
          {isOpen && user && (
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{user.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{user.rol}</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
