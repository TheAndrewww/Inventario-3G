import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';

/**
 * Componente que carga imágenes que requieren autenticación
 * Convierte la imagen a data URL para poder mostrarla
 */
const AuthenticatedImage = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  placeholderText = 'Cargando...',
  ...props
}) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const d3 = useDiseno3G();

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // Obtener la imagen con autenticación
        const response = await api.get(src, {
          responseType: 'blob'
        });

        // Convertir blob a data URL
        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'image/png' });
        const url = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        setDataUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar imagen autenticada:', err);
        setError(true);
        setLoading(false);
      }
    };

    if (src) {
      loadImage();
    }
  }, [src]);

  // Rediseño 2: encendido, el hueco de la foto con la forma real (sin texto gris) y el error con su ícono y su motivo.
  // La petición es la misma de siempre.
  if (d3 && loading) {
    return <div className={`${placeholderClassName || className || 'r2-foto-hueco'} r2-foto-cargando`} role="status" aria-label={placeholderText || 'Cargando foto'} />;
  }
  if (d3 && (error || !dataUrl)) {
    return (
      <div className={`${placeholderClassName || className || 'r2-foto-hueco'} r2-foto-error`} role="img" aria-label="No se pudo cargar la foto" title="No se pudo cargar la foto">
        <ImageOff size={16} aria-hidden="true" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={placeholderClassName || className || 'w-32 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400'}>
        <ImageIcon size={16} className="mr-1" />
        {placeholderText}
      </div>
    );
  }

  if (error || !dataUrl) {
    return (
      <div className={placeholderClassName || className || 'w-32 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-red-400'}>
        <ImageIcon size={16} className="mr-1" />
        Error
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={className}
      {...props}
    />
  );
};

export default AuthenticatedImage;
