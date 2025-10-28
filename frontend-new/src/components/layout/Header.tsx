import React from 'react';
import { useLocation } from 'react-router-dom';
import { QrCode, Bell, Settings } from 'lucide-react';

interface HeaderProps {
  onScannerOpen: () => void;
}

const Header: React.FC<HeaderProps> = ({ onScannerOpen }) => {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case '/inventario':
        return 'Inventario';
      case '/pedido':
        return 'Pedido Actual';
      case '/historial':
        return 'Historial de Movimientos';
      case '/perfil':
        return 'Mi Perfil';
      default:
        return 'ERP 3G';
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onScannerOpen}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
        >
          <QrCode size={20} />
          <span className="font-medium">Escanear QR</span>
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};

export default Header;
