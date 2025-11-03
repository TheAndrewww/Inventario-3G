import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Barcode, AlertCircle, SwitchCamera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { detectBarcodeType, getBarcodeTypeName } from '../../utils/barcodeTypeDetector';

const EAN13InputScanner = ({ value, onChange, disabled = false, onTypeDetected }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scannerInitialized = useRef(false);

  // Validar que el código tenga contenido válido
  const validateCode = (code) => {
    // Aceptar cualquier código que tenga contenido válido
    return code && code.length > 0 && code.length <= 4296; // Máximo para QR Code
  };

  // Manejar cambio manual del input
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    // Permitir cualquier carácter alfanumérico y algunos especiales
    if (newValue.length <= 50) { // Límite del campo en BD
      onChange(newValue);
    }
  };

  // Procesar código escaneado
  const handleScan = (decodedText) => {
    console.log('Código escaneado:', decodedText);

    // Validar que tenga contenido
    if (!validateCode(decodedText)) {
      toast.error('Código inválido o demasiado largo');
      return;
    }

    // Evitar escaneos duplicados
    if (lastScanned === decodedText) {
      return;
    }
    setLastScanned(decodedText);

    // Detectar automáticamente el tipo de código
    const detectedType = detectBarcodeType(decodedText);
    const typeName = getBarcodeTypeName(detectedType);

    console.log('Tipo detectado:', detectedType, '-', typeName);

    // Notificar al componente padre sobre el tipo detectado
    if (onTypeDetected) {
      onTypeDetected(detectedType);
    }

    // Actualizar valor
    onChange(decodedText);
    toast.success(`✓ ${typeName} escaneado correctamente`);

    // Detener escaneo automáticamente
    stopScanning();

    // Limpiar después de 2 segundos
    setTimeout(() => setLastScanned(null), 2000);
  };

  // Iniciar escaneo
  const startScanning = async () => {
    try {
      console.log('Iniciando scanner...');

      // Mostrar área de scanner primero
      setShowScanner(true);

      // Esperar más tiempo para que el DOM se actualice completamente
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verificar que el elemento existe antes de continuar
      const element = document.getElementById('ean13-input-scanner');
      if (!element) {
        console.error('Elemento del scanner no encontrado después del delay');
        toast.error('Error al inicializar el área de escaneo');
        setShowScanner(false);
        return;
      }

      const devices = await Html5Qrcode.getCameras();
      console.log('Cámaras encontradas:', devices);

      if (!devices || devices.length === 0) {
        toast.error('No se encontró ninguna cámara');
        setShowScanner(false);
        return;
      }

      // Guardar lista de cámaras
      setCameras(devices);

      // Preferir cámara trasera
      const backCamera = devices.find(
        (device) => device.label.toLowerCase().includes('back') ||
                   device.label.toLowerCase().includes('rear')
      );
      const cameraId = backCamera ? backCamera.id : devices[0].id;
      setSelectedCamera(cameraId);
      console.log('Cámara seleccionada:', cameraId);

      // Limpiar instancia anterior si existe
      if (html5QrCodeRef.current && scannerInitialized.current) {
        try {
          await html5QrCodeRef.current.clear();
        } catch (e) {
          console.log('Error limpiando scanner anterior:', e);
        }
      }

      // Inicializar scanner
      html5QrCodeRef.current = new Html5Qrcode('ean13-input-scanner');
      scannerInitialized.current = true;

      // Configuración simplificada para mejor compatibilidad
      const config = {
        fps: 10,
        qrbox: 250, // Usar un valor único en lugar de objeto para mejor compatibilidad
        aspectRatio: 1.0, // Relación cuadrada para mejor detección de códigos de barras
        disableFlip: false
      };

      console.log('Iniciando cámara con configuración:', config);

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        (decodedText) => {
          console.log('✅ Código detectado:', decodedText);
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Solo loguear, no mostrar errores de escaneo continuo
          // console.log('Escaneando...', errorMessage);
        }
      );

      setIsScanning(true);
      console.log('✅ Scanner iniciado correctamente');
      toast.success('Cámara activada. Coloca el código de barras o QR');
    } catch (err) {
      console.error('❌ Error al iniciar scanner:', err);
      toast.error(`No se pudo activar la cámara: ${err.message || 'Error desconocido'}`);
      setIsScanning(false);
      setShowScanner(false);
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current = null;
        } catch (e) {
          // Ignorar
        }
      }
      scannerInitialized.current = false;
    }
  };

  // Detener escaneo
  const stopScanning = async () => {
    console.log('Deteniendo scanner...', { current: html5QrCodeRef.current, isScanning });

    if (html5QrCodeRef.current) {
      try {
        const state = await html5QrCodeRef.current.getState();
        console.log('Estado del scanner:', state);

        // Solo detener si está realmente corriendo
        if (state === 2) { // Html5QrcodeScannerState.SCANNING
          await html5QrCodeRef.current.stop();
          console.log('Scanner detenido');
        }

        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
        scannerInitialized.current = false;
      } catch (err) {
        console.error('Error al detener scanner:', err);
        // Forzar limpieza incluso si hay error
        html5QrCodeRef.current = null;
        scannerInitialized.current = false;
      }
    }

    setIsScanning(false);
    setShowScanner(false);
  };

  // Cambiar de cámara
  const switchCamera = async () => {
    if (cameras.length <= 1) {
      toast.error('No hay otra cámara disponible');
      return;
    }

    const currentIndex = cameras.findIndex(cam => cam.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    // Detener escaneo actual
    await stopScanning();

    // Cambiar a la nueva cámara
    setSelectedCamera(nextCamera.id);
    toast.success(`Cambiado a: ${nextCamera.label || 'Cámara ' + (nextIndex + 1)}`);

    // Reiniciar escaneo con la nueva cámara después de un breve delay
    setTimeout(() => {
      if (nextCamera.id) {
        startScanningWithCamera(nextCamera.id);
      }
    }, 500);
  };

  // Iniciar escaneo con una cámara específica
  const startScanningWithCamera = async (cameraId) => {
    try {
      console.log('Iniciando scanner con cámara específica:', cameraId);

      // Mostrar área de scanner
      setShowScanner(true);

      // Esperar a que el DOM se actualice
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verificar que el elemento existe
      const element = document.getElementById('ean13-input-scanner');
      if (!element) {
        console.error('Elemento del scanner no encontrado');
        toast.error('Error al inicializar el área de escaneo');
        setShowScanner(false);
        return;
      }

      // Limpiar instancia anterior si existe
      if (html5QrCodeRef.current && scannerInitialized.current) {
        try {
          await html5QrCodeRef.current.clear();
        } catch (e) {
          console.log('Error limpiando scanner anterior:', e);
        }
      }

      // Inicializar scanner
      html5QrCodeRef.current = new Html5Qrcode('ean13-input-scanner');
      scannerInitialized.current = true;

      // Configuración
      const config = {
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0,
        disableFlip: false
      };

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        (decodedText) => {
          console.log('✅ Código detectado:', decodedText);
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
      );

      setIsScanning(true);
      console.log('✅ Scanner iniciado correctamente con nueva cámara');
    } catch (err) {
      console.error('❌ Error al iniciar scanner:', err);
      toast.error(`No se pudo activar la cámara: ${err.message || 'Error desconocido'}`);
      setIsScanning(false);
      setShowScanner(false);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current = null;
      }
      scannerInitialized.current = false;
    }
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && scannerInitialized.current) {
        const cleanup = async () => {
          try {
            const state = await html5QrCodeRef.current.getState();
            if (state === 2) { // SCANNING
              await html5QrCodeRef.current.stop();
            }
            await html5QrCodeRef.current.clear();
          } catch (e) {
            console.log('Cleanup error (ignorado):', e);
          }
        };
        cleanup();
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Input de código */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            disabled={disabled || isScanning}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono"
            placeholder="1234567890123"
            maxLength={13}
          />
          <Barcode
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={18}
          />
          {value && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className={`text-xs ${validateEAN13(value) ? 'text-green-600' : 'text-orange-600'}`}>
                {value.length}/13
              </span>
            </div>
          )}
        </div>

        {/* Botón de scanner */}
        {!isScanning ? (
          <button
            type="button"
            onClick={startScanning}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Escanear código de barras"
          >
            <Camera size={18} />
            Escanear
          </button>
        ) : (
          <button
            type="button"
            onClick={stopScanning}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            title="Detener escaneo"
          >
            <X size={18} />
            Detener
          </button>
        )}
      </div>

      {/* Área de escaneo */}
      {showScanner && (
        <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ width: '100%' }}>
          <div
            id="ean13-input-scanner"
            className="w-full"
            style={{
              minHeight: '400px',
              width: '100%',
              maxWidth: '100%',
              display: 'block'
            }}
          />

          {/* Botón flotante para cambiar de cámara */}
          {isScanning && cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="absolute top-4 left-4 p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all z-10"
              title="Cambiar cámara"
            >
              <SwitchCamera size={24} />
            </button>
          )}

          {isScanning && (
            <div className="absolute top-2 right-2 z-10">
              <span className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded shadow-lg">
                <Loader2 size={14} className="animate-spin" />
                Escaneando...
              </span>
            </div>
          )}
          {!isScanning && showScanner && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
              <Loader2 size={32} className="animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {/* Ayuda */}
      {!isScanning && (
        <p className="text-xs text-gray-500">
          Puedes digitar manualmente o escanear un código EAN-13 existente. Si lo dejas vacío, se generará uno automáticamente.
        </p>
      )}

      {/* Validación */}
      {value && !validateEAN13(value) && (
        <p className="text-xs text-orange-600">
          ⚠️ El código debe tener exactamente 13 dígitos
        </p>
      )}
    </div>
  );
};

export default EAN13InputScanner;
