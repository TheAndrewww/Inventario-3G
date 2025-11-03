import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, SwitchCamera } from 'lucide-react';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';

const EAN13ScannerOrdenesCompra = ({ onArticuloEscaneado, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const html5QrCodeRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const audioRef = useRef(null);

  // Inicializar sonido de confirmación
  useEffect(() => {
    audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  // Función para reproducir sonido de confirmación
  const playBeep = () => {
    if (!audioRef.current) return;

    try {
      const oscillator = audioRef.current.createOscillator();
      const gainNode = audioRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioRef.current.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioRef.current.currentTime + 0.2);

      oscillator.start(audioRef.current.currentTime);
      oscillator.stop(audioRef.current.currentTime + 0.2);
    } catch (error) {
      console.error('Error al reproducir sonido:', error);
    }
  };

  // Obtener lista de cámaras disponibles
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          const backCamera = devices.find(
            (device) => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
          );
          setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.error('Error al obtener cámaras:', err);
        toast.error('No se pudo acceder a la cámara');
      });
  }, []);

  // Procesar código escaneado con cooldown de 2 segundos
  const handleScan = async (decodedText, decodedResult) => {
    if (isProcessingRef.current) {
      return;
    }

    // Validar que sea un código EAN-13 (13 dígitos)
    if (!/^[0-9]{13}$/.test(decodedText)) {
      return;
    }

    // Cooldown de 2 segundos
    const currentTime = Date.now();
    if (currentTime - lastScanTimeRef.current < 2000) {
      return;
    }

    isProcessingRef.current = true;
    lastScanTimeRef.current = currentTime;

    console.log('✅ Código escaneado:', decodedText);

    try {
      const articulo = await articulosService.getByEAN13(decodedText);

      if (articulo) {
        // Efecto visual de flash verde
        setFlashEffect(true);
        setTimeout(() => setFlashEffect(false), 300);

        // Reproducir sonido de confirmación
        playBeep();

        // Notificar al componente padre
        onArticuloEscaneado(articulo);

        toast.success(`${articulo.nombre} agregado`);
      }
    } catch (error) {
      console.error('Error al buscar artículo:', error);
      toast.error(error.message || 'Artículo no encontrado');
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 2000);
    }
  };

  // Iniciar escaneo
  const startScanning = async () => {
    if (!selectedCamera) {
      toast.error('No se encontró ninguna cámara');
      return;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('ean13-scanner-ordenes');

      await html5QrCodeRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 350, height: 150 },
          aspectRatio: 1.777778,
        },
        handleScan,
        () => {} // Ignorar errores de escaneo continuo
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error al iniciar scanner:', err);
      toast.error('No se pudo iniciar la cámara');
    }
  };

  // Detener escaneo
  const stopScanning = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.error('Error al detener scanner:', err);
      }
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
    if (!cameraId) {
      toast.error('No se encontró ninguna cámara');
      return;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('ean13-scanner-ordenes');

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 350, height: 150 },
          aspectRatio: 1.777778,
        },
        handleScan,
        () => {} // Ignorar errores de escaneo continuo
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error al iniciar scanner:', err);
      toast.error('No se pudo iniciar la cámara');
    }
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <>
      <style>{`
        #ean13-scanner-ordenes #qr-shaded-region {
          border: none !important;
          box-shadow: none !important;
        }
        #ean13-scanner-ordenes__scan_region {
          border: none !important;
          outline: none !important;
        }
        #ean13-scanner-ordenes svg {
          display: none !important;
        }
        #ean13-scanner-ordenes canvas:last-of-type {
          opacity: 0 !important;
        }
      `}</style>

      <div className="space-y-4">
        {/* Área de escaneo */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <div id="ean13-scanner-ordenes" className="w-full h-80" />

          {/* Botón flotante para cambiar de cámara */}
          {isScanning && cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="absolute top-4 right-4 p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all z-10"
              title="Cambiar cámara"
            >
              <SwitchCamera size={24} />
            </button>
          )}

          {/* Esquinas blancas fijas como guía */}
          {isScanning && (
            <>
              <div className="absolute top-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-t-4 border-white opacity-70 pointer-events-none" />
              <div className="absolute top-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-t-4 border-white opacity-70 pointer-events-none" />
              <div className="absolute bottom-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-b-4 border-white opacity-70 pointer-events-none" />
              <div className="absolute bottom-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-b-4 border-white opacity-70 pointer-events-none" />
            </>
          )}

          {/* Esquinas verdes cuando se escanea */}
          {flashEffect && (
            <>
              <div className="absolute top-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-t-4 border-green-400 animate-pulse pointer-events-none" />
              <div className="absolute top-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-t-4 border-green-400 animate-pulse pointer-events-none" />
              <div className="absolute bottom-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-b-4 border-green-400 animate-pulse pointer-events-none" />
              <div className="absolute bottom-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-b-4 border-green-400 animate-pulse pointer-events-none" />
            </>
          )}

          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
              <div className="text-center text-white space-y-4">
                <Camera size={64} className="mx-auto opacity-50" />
                <p className="text-lg">Presiona el botón para activar la cámara</p>
              </div>
            </div>
          )}
        </div>

        {/* Información */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex gap-2">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Instrucciones:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Coloca el código EAN-13 dentro del área de escaneo</li>
                <li>El artículo se agregará automáticamente a la orden</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Selector de cámara (si hay múltiples) */}
        {cameras.length > 1 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Cámara:</label>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={isScanning}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 disabled:opacity-50"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Cámara ${camera.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Botones de control */}
        <div className="flex gap-3">
          {!isScanning ? (
            <button
              type="button"
              onClick={startScanning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              <Camera size={18} />
              Activar Cámara
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <X size={18} />
              Detener
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
};

export default EAN13ScannerOrdenesCompra;
