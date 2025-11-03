import React from 'react';

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
