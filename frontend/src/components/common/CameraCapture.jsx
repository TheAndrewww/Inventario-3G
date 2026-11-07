import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCw } from 'lucide-react';
import { Modal } from './index';
import { Boton } from '../../rediseno2/fundacion/piezas/Boton';

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Tomar fotografía" size="lg">
      <div className="r2-camara">
        {error && (
          <div className="r2-error-carga" role="alert">
            <div className="r2-error-cuerpo">
              <p className="r2-error-titulo">No se pudo abrir la cámara</p>
              <p className="r2-error-texto">Revisa que el navegador tenga permiso para usarla.</p>
              <p className="r2-error-motivo">{error}</p>
            </div>
          </div>
        )}
        <div className="r2-camara-visor">
          {!capturedImage ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted />
              <button type="button" onClick={toggleCamera} className="r2-boton-icono r2-boton-icono--grande r2-camara-girar" aria-label="Cambiar de cámara" title="Cambiar de cámara">
                <RotateCw size={22} aria-hidden="true" />
              </button>
            </>
          ) : (
            <img src={capturedImage} alt="Foto tomada" />
          )}
        </div>
        <canvas ref={canvasRef} hidden />
        <div className="r2-camara-acciones">
          <Boton nivel="fantasma" alHacer={handleClose}>Cancelar</Boton>
          {!capturedImage ? (
            <Boton nivel="principal" icono={Camera} alHacer={handleCapture} deshabilitado={!stream} motivo="La cámara todavía no está lista">Tomar foto</Boton>
          ) : (
            <>
              <Boton nivel="contorno" alHacer={handleRetake}>Tomar otra</Boton>
              <Boton nivel="principal" icono={Check} alHacer={handleConfirm}>Usar esta foto</Boton>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CameraCapture;
