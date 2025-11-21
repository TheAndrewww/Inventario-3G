import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';

const ImageUpload = ({ currentImage, onImageSelect, onImageRemove, disabled = false }) => {
  const [preview, setPreview] = useState(currentImage || null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const fileInputRef = useRef(null);

  // Actualizar preview cuando cambie currentImage (para modo edición)
  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];

    if (file) {
      // Validar tipo
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen');
        return;
      }

      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no debe superar 5MB');
        return;
      }

      // Crear previsualización
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Marcar que es un archivo subido (NO procesar con Nano Banana)
      const fileWithMetadata = Object.assign(file, {
        isFromCamera: false
      });

      // Notificar al componente padre
      if (onImageSelect) {
        onImageSelect(fileWithMetadata);
      }
    }
  };

  const handleCameraCapture = (file) => {
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar 5MB');
      return;
    }

    // Crear previsualización
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Marcar que es una foto de cámara (PROCESAR con Nano Banana)
    const fileWithMetadata = Object.assign(file, {
      isFromCamera: true
    });

    // Notificar al componente padre
    if (onImageSelect) {
      onImageSelect(fileWithMetadata);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onImageRemove) {
      onImageRemove();
    }
  };

  const handleFileClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleCameraClick = () => {
    if (!disabled) {
      setShowCameraModal(true);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {/* Input para seleccionar archivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="w-full space-y-2">
          {/* Botón para subir archivo */}
          <button
            type="button"
            onClick={handleFileClick}
            disabled={disabled}
            className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">Subir desde archivo</p>
              <p className="text-xs text-gray-400">JPEG, PNG o WEBP (máx. 5MB)</p>
            </div>
          </button>

          {/* Botón para tomar foto */}
          <button
            type="button"
            onClick={handleCameraClick}
            disabled={disabled}
            className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Camera size={24} />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">Tomar fotografía</p>
              <p className="text-xs text-gray-400">Usar cámara del dispositivo</p>
            </div>
          </button>
        </div>
      )}
      </div>

      {/* Modal de captura de cámara */}
      <CameraCapture
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
};

export default ImageUpload;
