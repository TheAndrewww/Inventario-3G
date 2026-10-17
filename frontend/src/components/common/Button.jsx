// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React from 'react';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import { Boton } from '../../rediseno2/fundacion/piezas/Boton';

// Rediseño 2: encendido, el botón de la fundación con el nivel equivalente (mismas props, mismo onClick).
const NIVEL_R2 = { primary: 'principal', secondary: 'contorno', danger: 'peligro', ghost: 'fantasma' };
const TAMANO_R2 = { sm: 'chico', md: 'normal', lg: 'grande' };

const Button = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  icon: Icon,
  fullWidth = false,
  size = 'md'
}) => {
  const d3 = useDiseno3G();
  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
    return (
      <Boton nivel={NIVEL_R2[variant] || 'contorno'} tamano={TAMANO_R2[size] || 'normal'} tipo={type} alHacer={onClick}
        deshabilitado={disabled} icono={Icon} anchoCompleto={fullWidth} className={className || undefined}>
        {children}
      </Boton>
    );
  }
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-red-700 text-white hover:bg-red-800 focus:ring-red-700',
    secondary: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
    danger: 'border-2 border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-600',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : 20} />}
      {children}
    </button>
  );
};

export default Button;
