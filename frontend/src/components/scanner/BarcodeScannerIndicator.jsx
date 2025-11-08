import React from 'react';
import { Scan } from 'lucide-react';

/**
 * Componente que muestra un indicador visual cuando se está escaneando con la pistola
 */
const BarcodeScannerIndicator = ({ isScanning }) => {
  if (!isScanning) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse">
        <Scan className="animate-bounce" size={24} />
        <div>
          <p className="font-bold text-sm">Escaneando código...</p>
          <p className="text-xs opacity-90">Pistola detectada</p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerIndicator;
