import React from 'react';
import { Cargando } from '../../rediseno2/fundacion/piezas/Estados';

const Loader = ({ size = 'md', fullScreen = false }) => {
  const forma = fullScreen || size === 'lg' ? 'tabla' : size === 'sm' ? 'texto' : 'lista';
  const esqueleto = <Cargando forma={forma} filas={size === 'sm' ? 1 : fullScreen ? 8 : 4} columnas={4} />;
  if (fullScreen) return <div className="r2-cargando-pantalla">{esqueleto}</div>;
  return <div className={`r2-cargando-bloque r2-cargando-bloque--${size}`}>{esqueleto}</div>;
};

export default Loader;
