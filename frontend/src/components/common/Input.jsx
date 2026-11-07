import React from 'react';
import { Campo, Entrada } from '../../rediseno2/fundacion/piezas/Campos';

const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  icon: Icon,
  className = '',
  uppercase = true // Por defecto convertir a mayúsculas
}) => {
  // Tipos de input que NO deben convertirse a mayúsculas
  const noUppercaseTypes = ['email', 'password', 'number', 'tel', 'url', 'date', 'time', 'datetime-local'];

  // Determinar si debe aplicar mayúsculas
  const shouldUppercase = uppercase && type === 'text' && !noUppercaseTypes.includes(type);

  // Manejar el cambio con conversión a mayúsculas si aplica
  const handleChange = (e) => {
    if (shouldUppercase) {
      const upperValue = e.target.value.toUpperCase();
      // Crear nuevo evento con el valor en mayúsculas
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: upperValue,
          name: e.target.name
        }
      };
      onChange(newEvent);
    } else {
      onChange(e);
    }
  };

  return (
    <Campo etiqueta={label} error={error} requerido={required} id={name} icono={Icon} className={className || undefined}>
      <Entrada id={name} name={name} type={type} value={value} onChange={handleChange} placeholder={placeholder}
        required={required} disabled={disabled} />
    </Campo>
  );
};

export default Input;
