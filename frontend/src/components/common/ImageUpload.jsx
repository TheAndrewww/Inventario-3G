import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';
import { avisoG3 } from '../../diseno-3g/dialogosG3';

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
        avisoG3('Selecciona un archivo de imagen.', 'mal');
        return;
      }

      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        avisoG3('La imagen no debe pesar más de 5 MB.', 'mal');
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
      avisoG3('La imagen no debe pesar más de 5 MB.', 'mal');
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
      <div className="r2-subir-foto">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFileSelect} hidden disabled={disabled} />
        {preview ? (
          <div className="r2-subir-foto-vista">
            <img src={preview} alt="Foto elegida" />
            {!disabled && (
              <button type="button" onClick={handleRemove} className="r2-boton r2-boton--contorno r2-boton--chico r2-subir-foto-quitar">
                <X size={16} aria-hidden="true" /><span className="r2-boton-texto">Quitar foto</span>
              </button>
            )}
          </div>
        ) : (
          <div className="r2-subir-foto-opciones">
            <button type="button" onClick={handleFileClick} disabled={disabled} className="r2-subir-foto-opcion">
              <Upload size={22} aria-hidden="true" />
              <span className="r2-subir-foto-texto">Subir desde archivo<small>JPEG, PNG o WEBP, hasta 5 MB</small></span>
            </button>
            <button type="button" onClick={handleCameraClick} disabled={disabled} className="r2-subir-foto-opcion">
              <Camera size={22} aria-hidden="true" />
              <span className="r2-subir-foto-texto">Tomar fotografía<small>Con la cámara del equipo</small></span>
            </button>
          </div>
        )}
      </div>
      <CameraCapture isOpen={showCameraModal} onClose={() => setShowCameraModal(false)} onCapture={handleCameraCapture} />
    </>
  );
};

export default ImageUpload;
