// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React from 'react';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
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
  const d3 = useDiseno3G();
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

  // Rediseño 2: encendido, campo de la fundación (etiqueta arriba, error abajo). La MISMA conversión a mayúsculas del valor
  // (handleChange); solo el texto de ejemplo deja de verse en mayúsculas.
  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
    return (
      <Campo etiqueta={label} error={error} requerido={required} id={name} icono={Icon} className={className || undefined}>
        <Entrada id={name} name={name} type={type} value={value} onChange={handleChange} placeholder={placeholder}
          required={required} disabled={disabled} />
      </Campo>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Icon size={20} />
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={shouldUppercase ? { textTransform: 'uppercase' } : {}}
          className={`
            w-full px-4 py-3 border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500' : 'border-gray-300'}
          `}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;
