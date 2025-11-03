import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';

const EAN13ScannerEntrada = ({ onClose, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const html5QrCodeRef = useRef(null);

  // Obtener lista de cámaras disponibles
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Preferir cámara trasera si está disponible
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

  // Procesar código escaneado
  const handleScan = async (decodedText, decodedResult) => {
    console.log('Código escaneado:', decodedText, decodedResult);

    // Validar que sea un código EAN-13 (13 dígitos)
    if (!/^[0-9]{13}$/.test(decodedText)) {
      toast.error('Código inválido. Debe ser un código EAN-13 (13 dígitos)');
      return;
    }

    // Evitar escaneos duplicados rápidos
    if (lastScanned === decodedText) {
      return;
    }
    setLastScanned(decodedText);

    try {
      // Buscar artículo por código EAN-13
      const response = await articulosService.getByEAN13(decodedText);
      const articulo = response.articulo;

      if (articulo && articulo.activo) {
        // Llamar al callback con el artículo encontrado
        onScan(articulo);
        toast.success(`${articulo.nombre} agregado`);

        // Limpiar después de 1 segundo para permitir nuevos escaneos
        setTimeout(() => setLastScanned(null), 1000);
      } else {
        toast.error('Artículo inactivo o no encontrado');
        setTimeout(() => setLastScanned(null), 2000);
      }
    } catch (error) {
      console.error('Error al buscar artículo:', error);
      toast.error(error.message || 'Artículo no encontrado');
      setTimeout(() => setLastScanned(null), 2000);
    }
  };

  // Iniciar escaneo
  const startScanning = async () => {
    if (!selectedCamera) {
      toast.error('No se encontró ninguna cámara');
      return;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('ean13-scanner-entrada');

      await html5QrCodeRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 350, height: 150 }, // Área de escaneo más ancha para códigos de barras
          aspectRatio: 1.777778,
        },
        handleScan,
        (errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
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

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Área de escaneo */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        <div id="ean13-scanner-entrada" className="w-full aspect-video" />

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
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-green-900">
            <p className="font-medium mb-1">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Coloca el código de barras EAN-13 dentro del área de escaneo</li>
              <li>Mantén el código estable y bien iluminado</li>
              <li>El artículo se agregará automáticamente a la lista</li>
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `Cámara ${camera.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        {!isScanning ? (
          <button
            onClick={startScanning}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Camera size={20} />
            Activar Cámara
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <X size={20} />
            Detener Escaneo
          </button>
        )}

        <button
          onClick={onClose}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default EAN13ScannerEntrada;
