import React from 'react';
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
  return (
    <Boton nivel={NIVEL_R2[variant] || 'contorno'} tamano={TAMANO_R2[size] || 'normal'} tipo={type} alHacer={onClick}
      deshabilitado={disabled} icono={Icon} anchoCompleto={fullWidth} className={className || undefined}>
      {children}
    </Boton>
  );
};

export default Button;
