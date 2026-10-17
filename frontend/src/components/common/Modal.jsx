// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import { Dialogo } from '../../rediseno2/fundacion/piezas/Dialogo';
import { ZonaHeredada } from '../../rediseno2/fundacion/piezas/Miniatura';

const Modal = ({ isOpen, onClose, title, children, size = 'md', closeOnBackdropClick = true }) => {
  const d3 = useDiseno3G(); // Rediseño 2: encendido, el diálogo centrado de la fundación (mismo título, mismos hijos)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
    return (
      <Dialogo abierto titulo={title} tamano={size} alCerrar={onClose} cerrarConVelo={closeOnBackdropClick}>
        {/* El contenido de un Modal es marcado de siempre: se ve como hoy encendido (zona heredada), también dentro de una vista nueva */}
        <ZonaHeredada>{children}</ZonaHeredada>
      </Dialogo>
    );
  }

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-lg sm:rounded-xl ${sizes[size]} w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
