// TV clásica (19-oct-2026, a pedido del usuario): copia de la versión de ANTES del Diseño 3G (b411ea5^), fondo blanco y logos.
// No usar useDiseno3G aquí ni borrar con la limpieza de lo VIEJO del 24-oct. Ver tv-clasico/rutasTvClasica.js.
import React from 'react';

const Loader = ({ size = 'md', fullScreen = false }) => {
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
