import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCw } from 'lucide-react';
import { Modal } from './index';

const CameraCapture = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' o 'environment'

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Ajustar canvas al tamaño del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar el frame actual del video en el canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convertir a imagen
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageDataUrl);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      // Convertir dataURL a File
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
          handleClose();
        });
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onClose();
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tomar Fotografía" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Área de la cámara */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Botón para cambiar cámara (solo en móviles) */}
              <button
                onClick={toggleCamera}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full transition-colors"
                title="Cambiar cámara"
              >
                <RotateCw size={24} />
              </button>
            </>
          ) : (
            <img
              src={capturedImage}
              alt="Captura"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Canvas oculto para capturar la imagen */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {!capturedImage ? (
            <button
              onClick={handleCapture}
              disabled={!stream}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera size={20} />
              Capturar Foto
            </button>
          ) : (
            <>
              <button
                onClick={handleRetake}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Tomar Otra
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Check size={20} />
                Usar Foto
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CameraCapture;
