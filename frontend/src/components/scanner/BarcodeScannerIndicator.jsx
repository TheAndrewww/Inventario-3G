import React from 'react';
import { IndicadorLecturaR2 } from '../../rediseno2/tickets/PiezasEscaner';

/**
 * Componente que muestra un indicador visual cuando se está escaneando con la pistola
 */
const BarcodeScannerIndicator = ({ isScanning }) => {
  if (!isScanning) return null;
  return <IndicadorLecturaR2 />;
};

export default BarcodeScannerIndicator;
