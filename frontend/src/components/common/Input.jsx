import React from 'react';

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
