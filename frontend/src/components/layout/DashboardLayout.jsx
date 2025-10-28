import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { QrCode, Bell, Settings } from 'lucide-react';
import { Modal } from '../common';
import QRScanner from '../scanner/QRScanner';
import articulosService from '../../services/articulos.service';
import { usePedido } from '../../context/PedidoContext';
import toast from 'react-hot-toast';

const DashboardLayoutContent = ({ children }) => {
  const location = useLocation();
  const [showScanner, setShowScanner] = useState(false);
  const { agregarArticulo } = usePedido();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/inventario':
        return 'Inventario';
      case '/pedido':
        return 'Pedido Actual';
      case '/historial':
        return 'Historial de Movimientos';
      case '/perfil':
        return 'Mi Perfil';
      case '/reportes':
        return 'Reportes';
      default:
        return 'Dashboard';
    }
  };

  const handleScanQR = async (qrData) => {
    try {
      const response = await articulosService.getById(qrData.id);
      const articulo = response.success && response.data?.articulo
        ? response.data.articulo
        : response;

      agregarArticulo(articulo, 1, '');
      toast.success(`"${articulo.nombre}" agregado al pedido`);
      setShowScanner(false);
    } catch (error) {
      console.error('Error al agregar artículo desde QR:', error);
      toast.error('Error al obtener el artículo');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              <QrCode size={20} />
              <span className="font-medium">Escanear QR</span>
            </button>

            <button className="p-2 hover:bg-gray-100 rounded-lg relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
            </button>

            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Modal Scanner */}
      <Modal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Escanear Código QR"
        size="md"
      >
        <QRScanner
          isOpen={showScanner}
          onScan={handleScanQR}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </div>
  );
};

const DashboardLayout = ({ children }) => {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
};

export default DashboardLayout;
