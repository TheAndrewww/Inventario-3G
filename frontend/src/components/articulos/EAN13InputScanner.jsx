import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { detectBarcodeType, getBarcodeTypeName } from '../../utils/barcodeTypeDetector';
import CampoCodigoR2 from '../../rediseno2/inventario/CampoCodigoR2';

// `resto` (id y aria-* del <Campo> que lo envuelve) solo lo usa la vista encendida
const EAN13InputScanner = ({ value, onChange, disabled = false, onTypeDetected, ...resto }) => {
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
    try {
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

      // Actualizar valor primero
      onChange(decodedText);

      // Notificar al componente padre sobre el tipo detectado
      if (onTypeDetected) {
        onTypeDetected(detectedType);
      }

      // Mostrar mensaje de éxito
      toast.success(`${typeName} escaneado correctamente`);

      // Detener escaneo automáticamente
      stopScanning().catch(err => {
        console.error('Error al detener scanner:', err);
      });

      // Limpiar después de 2 segundos
      setTimeout(() => setLastScanned(null), 2000);
    } catch (error) {
      console.error('Error en handleScan:', error);
      toast.error('Error al procesar el código escaneado');
    }
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

    try {
      if (html5QrCodeRef.current && scannerInitialized.current) {
        try {
          const state = await html5QrCodeRef.current.getState();
          console.log('Estado del scanner:', state);

          // Solo detener si está realmente corriendo
          if (state === 2) { // Html5QrcodeScannerState.SCANNING
            await html5QrCodeRef.current.stop();
            console.log('Scanner detenido');
          }

          // Intentar limpiar
          try {
            await html5QrCodeRef.current.clear();
          } catch (clearErr) {
            console.log('Error al limpiar, ignorando:', clearErr);
          }
        } catch (err) {
          console.error('Error al detener scanner:', err);
        }

        // Siempre limpiar referencias
        html5QrCodeRef.current = null;
        scannerInitialized.current = false;
      }
    } catch (err) {
      console.error('Error general al detener scanner:', err);
    } finally {
      // Siempre actualizar estados
      setIsScanning(false);
      setShowScanner(false);
    }
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
    <CampoCodigoR2 valor={value} alCambiar={handleInputChange} deshabilitado={disabled} escaneando={isScanning} mostrarEscaner={showScanner}
      camaras={cameras} alIniciar={startScanning} alDetener={stopScanning} alCambiarCamara={switchCamera} valido={validateCode(value)} resto={resto} />
  );
};

export default EAN13InputScanner;
