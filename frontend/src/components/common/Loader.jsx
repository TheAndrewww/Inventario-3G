// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React from 'react';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import { Cargando } from '../../rediseno2/fundacion/piezas/Estados';

const Loader = ({ size = 'md', fullScreen = false }) => {
  const d3 = useDiseno3G();
  // Rediseño 2: encendido, esqueleto (sin rueda en medio). Chico: una línea; normal: lista corta; grande o pantalla completa: tabla.
  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
    const forma = fullScreen || size === 'lg' ? 'tabla' : size === 'sm' ? 'texto' : 'lista';
    const esqueleto = <Cargando forma={forma} filas={size === 'sm' ? 1 : fullScreen ? 8 : 4} columnas={4} />;
    if (fullScreen) return <div className="r2-cargando-pantalla">{esqueleto}</div>;
    return <div className={`r2-cargando-bloque r2-cargando-bloque--${size}`}>{esqueleto}</div>;
  }
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  const spinner = (
    <div className={`${sizes[size]} border-gray-200 border-t-red-700 rounded-full animate-spin`}></div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      {spinner}
    </div>
  );
};

export default Loader;
