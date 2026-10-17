import React from 'react';
import { Scan } from 'lucide-react';
import { useDiseno3G as useRediseno2 } from '../../rediseno2/fundacion/useDiseno3G';
import { IndicadorLecturaR2 } from '../../rediseno2/tickets/PiezasEscaner';

/**
 * Componente que muestra un indicador visual cuando se está escaneando con la pistola
 */
const BarcodeScannerIndicator = ({ isScanning }) => {
  const d3 = useRediseno2(); // Rediseño 2: encendido, el aviso común de lectura (mismo momento en que aparece)
  if (!isScanning) return null;
  if (d3) return <IndicadorLecturaR2 />;

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
