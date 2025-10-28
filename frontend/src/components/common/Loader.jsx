import React from 'react';
import { Loader2 } from 'lucide-react';

const Loader = ({ size = 'md', text, fullScreen = false }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const sizeClass = sizes[size] || sizes.md;

  const LoaderContent = () => (
    <div className="flex flex-col items-center justify-center">
      <Loader2 className={`${sizeClass} animate-spin text-blue-600`} />
      {text && (
        <p className="mt-4 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <LoaderContent />
      </div>
    );
  }

  return <LoaderContent />;
};

export default Loader;
