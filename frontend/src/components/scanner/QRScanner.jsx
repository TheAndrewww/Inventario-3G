import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '../common';
import { Camera, XCircle, CheckCircle, AlertCircle } from 'lucide-react';

const QRScanner = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const onScanRef = useRef(onScan);

  // Mantener la referencia de onScan actualizada
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!isOpen) {
      // Limpiar el scanner cuando se cierra el modal
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current
          .clear()
          .catch((err) => console.error('Error clearing scanner:', err));
        scannerInstanceRef.current = null;
      }
      setScanResult(null);
      setError(null);
      return;
    }

    // Evitar inicialización múltiple
    if (scannerInstanceRef.current) {
      return;
    }

    // Inicializar el scanner
    const html5QrcodeScanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      /* verbose= */ false
    );

    const onScanSuccess = (decodedText, decodedResult) => {
      console.log('QR Code escaneado:', decodedText);

      try {
        // Intentar parsear el QR code como JSON
        const qrData = JSON.parse(decodedText);

        // Validar que sea un QR de artículo
        if (qrData.type !== 'articulo' || !qrData.id) {
          setError('El código QR no corresponde a un artículo válido');
          return;
        }

        // Mostrar resultado exitoso
        setScanResult({
          success: true,
          data: qrData,
        });

        // Detener el scanner
        html5QrcodeScanner
          .clear()
          .then(() => {
            scannerInstanceRef.current = null;
          })
          .catch((err) => console.error('Error clearing scanner:', err));

        // Llamar al callback después de un breve delay para que el usuario vea el mensaje
        setTimeout(() => {
          onScanRef.current(qrData);
          // El componente padre cerrará el modal
        }, 1000);

      } catch (err) {
        console.error('Error parsing QR data:', err);
        setError('El código QR no tiene el formato correcto');
        setScanResult({
          success: false,
          message: 'Formato de QR inválido',
        });
      }
    };

    const onScanError = (errorMessage) => {
      // No mostrar errores de escaneo continuo (son normales)
      // Solo errores importantes
      if (errorMessage.includes('NotFoundException')) {
        return;
      }
      console.warn('Error scanning:', errorMessage);
    };

    html5QrcodeScanner.render(onScanSuccess, onScanError);
    scannerInstanceRef.current = html5QrcodeScanner;

    // Cleanup
    return () => {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current
          .clear()
          .catch((err) => console.error('Error clearing scanner:', err));
        scannerInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (scannerInstanceRef.current) {
      scannerInstanceRef.current.clear().catch((err) => console.error('Error clearing scanner:', err));
      scannerInstanceRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-4">
      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <Camera className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">
            Apunta la cámara al código QR del artículo
          </p>
          <p className="text-xs text-blue-600 mt-1">
            El escaneo se realizará automáticamente cuando el código sea detectado
          </p>
        </div>
      </div>

      {/* Scanner */}
      <div className="relative w-full max-w-md mx-auto">
        <div
          id="qr-reader"
          ref={scannerRef}
          className="rounded-lg overflow-hidden border-2 border-gray-300"
        />

        {/* Overlay de resultado exitoso */}
        {scanResult?.success && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-90 flex items-center justify-center rounded-lg">
            <div className="text-center text-white">
              <CheckCircle className="w-16 h-16 mx-auto mb-3" />
              <p className="text-xl font-semibold">¡Código escaneado!</p>
              <p className="text-sm mt-1">Agregando al carrito...</p>
            </div>
          </div>
        )}

        {/* Overlay de error */}
        {scanResult?.success === false && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-90 flex items-center justify-center rounded-lg">
            <div className="text-center text-white">
              <XCircle className="w-16 h-16 mx-auto mb-3" />
              <p className="text-xl font-semibold">Error al escanear</p>
              <p className="text-sm mt-1">{scanResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800 font-medium">Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="ghost" onClick={handleClose}>
          Cerrar
        </Button>
      </div>

      {/* Estilos adicionales para el scanner */}
      <style>{`
        #qr-reader {
          border: none !important;
          width: 100% !important;
        }
        #qr-reader > div {
          border: none !important;
        }
        #qr-reader video {
          border-radius: 0.5rem;
          width: 100% !important;
          max-height: 400px !important;
          object-fit: cover;
        }
        #qr-reader__dashboard {
          padding: 10px 0 !important;
        }
        #qr-reader__dashboard_section {
          text-align: center !important;
        }
        #qr-reader__scan_region {
          position: relative !important;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
