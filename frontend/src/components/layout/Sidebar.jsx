import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePedido } from '../../context/PedidoContext';
import {
  Package,
  ShoppingCart,
  History,
  BarChart3,
  User,
  Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getTotalArticulos } = usePedido();

  const menuItems = [
    {
      id: 'inventario',
      label: 'Inventario',
      icon: Package,
      path: '/inventario',
    },
    {
      id: 'pedido',
      label: 'Pedido Actual',
      icon: ShoppingCart,
      path: '/pedido',
      badge: getTotalArticulos(),
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: History,
      path: '/historial',
    },
    {
      id: 'reportes',
      label: 'Reportes',
      icon: BarChart3,
      path: '/reportes',
      disabled: true,
    },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 256 : 80 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-white border-r border-gray-200 flex flex-col h-full"
    >
      {/* Logo y Toggle */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 bg-red-700 rounded-lg flex items-center justify-center text-white font-bold">
                3G
              </div>
              <div>
                <h1 className="font-bold text-gray-900">ERP 3G</h1>
                <p className="text-xs text-gray-500">Inventario v1.0</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && navigate(item.path)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                active
                  ? 'bg-red-50 text-red-700'
                  : item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge > 0 && (
                <span className="absolute top-2 left-8 bg-red-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Perfil de Usuario */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/perfil')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/perfil')
              ? 'bg-red-50 text-red-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <User size={20} />
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 text-left"
              >
                <p className="font-medium text-sm">{user?.nombre || 'Usuario'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.rol || 'Rol'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
