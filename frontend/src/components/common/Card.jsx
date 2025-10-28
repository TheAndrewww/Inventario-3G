import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  footer,
  padding = 'default',
  className = '',
  headerAction,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };

  const paddingClass = paddingClasses[padding] || paddingClasses.default;

  return (
    <div
      className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className={`border-b border-gray-200 ${paddingClass} flex items-center justify-between`}>
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {headerAction && (
            <div>{headerAction}</div>
          )}
        </div>
      )}

      <div className={paddingClass}>
        {children}
      </div>

      {footer && (
        <div className={`border-t border-gray-200 ${paddingClass}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
