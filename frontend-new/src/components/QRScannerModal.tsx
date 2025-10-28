import React from 'react';
import { Camera, QrCode, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface QRScannerModalProps {
  onClose: () => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose }) => {
  const activarCamara = () => {
    // TODO: Implement QR scanner using html5-qrcode
    toast.error('Escaner QR en desarrollo');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Escanear Codigo QR</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative aspect-square bg-gray-900 rounded-lg flex items-center justify-center mb-6">
          <QrCode size={120} className="text-gray-600" />
          <div className="absolute inset-4 border-4 border-red-700 rounded-lg">
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white"></div>
          </div>
        </div>

        <p className="text-center text-gray-600 mb-6">
          Apunta la camara al codigo QR del articulo para agregarlo automaticamente al pedido
        </p>

        <div className="flex gap-3">
          <button
            onClick={activarCamara}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800"
          >
            <Camera size={20} />
            Activar Camara
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
