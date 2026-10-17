import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, CheckCircle, AlertCircle, Plus, Minus, Trash2, ShoppingCart, SwitchCamera, Package } from 'lucide-react';
import { useDiseno3G } from '../../diseno-3g/useDiseno3G';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';
import { usePedido } from '../../context/PedidoContext';
import { getImageUrl } from '../../utils/imageUtils';
import { g3Activo, confirmarG3 } from '../../diseno-3g/dialogosG3';
import { useDiseno3G as useRediseno2 } from '../../rediseno2/fundacion/useDiseno3G';
import { EscanerCamaraR2 } from '../../rediseno2/tickets/PiezasEscaner';

const EAN13Scanner = ({ onClose }) => {
  const g3 = useDiseno3G(); // Diseño 3G: ícono en vez de emoji (apagado, lo de siempre)
  const d3 = useRediseno2(); // Rediseño 2: encendido se pinta EscanerCamaraR2 con este mismo estado y manejadores
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [carritoEscaneados, setCarritoEscaneados] = useState([]);
  const [flashEffect, setFlashEffect] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const audioRef = useRef(null);
  const { agregarArticulo } = usePedido();

  // Inicializar sonido de confirmación
  useEffect(() => {
    // Crear un beep sound usando AudioContext
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

      oscillator.frequency.value = 800; // Frecuencia del beep (Hz)
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

  // Procesar código escaneado con cooldown de 2 segundos
  const handleScan = async (decodedText, decodedResult) => {
    // Si ya está procesando un escaneo, ignorar INMEDIATAMENTE
    if (isProcessingRef.current) {
      console.log('⏸️ Escaneo bloqueado - procesamiento en curso');
      return;
    }

    // Validar que sea un código EAN-13 (13 dígitos)
    if (!/^[0-9]{13}$/.test(decodedText)) {
      return; // Ignorar códigos inválidos silenciosamente
    }

    // Implementar cooldown de 2 segundos
    const currentTime = Date.now();
    if (currentTime - lastScanTimeRef.current < 2000) {
      console.log('⏸️ Escaneo bloqueado - cooldown activo');
      return;
    }

    // Bloquear inmediatamente más escaneos
    isProcessingRef.current = true;
    lastScanTimeRef.current = currentTime;
    setLastScanned(decodedText);

    console.log('✅ Código escaneado:', decodedText);

    try {
      // Buscar artículo por código EAN-13
      const articulo = await articulosService.getByEAN13(decodedText);

      if (articulo) {
        // Efecto visual de flash verde
        setFlashEffect(true);
        setTimeout(() => setFlashEffect(false), 300);

        // Reproducir sonido de confirmación
        playBeep();

        // Agregar al carrito de escaneados
        agregarAlCarrito(articulo);
        toast.success(`${articulo.nombre} escaneado`);
      }
    } catch (error) {
      console.error('Error al buscar artículo:', error);
      toast.error(error.message || 'Artículo no encontrado');
    } finally {
      // Reactivar escaneo después de 2 segundos
      setTimeout(() => {
        isProcessingRef.current = false;
        console.log('✅ Scanner listo para siguiente escaneo');
      }, 2000);
    }
  };

  // Agregar artículo al carrito de escaneados
  const agregarAlCarrito = (articulo) => {
    setCarritoEscaneados(prev => {
      const existe = prev.find(item => item.articulo.id === articulo.id);
      if (existe) {
        return prev.map(item =>
          item.articulo.id === articulo.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      } else {
        return [...prev, { articulo, cantidad: 1 }];
      }
    });
  };

  // Aumentar cantidad en el carrito
  const aumentarCantidad = (articuloId) => {
    setCarritoEscaneados(prev =>
      prev.map(item =>
        item.articulo.id === articuloId
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      )
    );
  };

  // Disminuir cantidad en el carrito
  const disminuirCantidad = (articuloId) => {
    setCarritoEscaneados(prev =>
      prev.map(item =>
        item.articulo.id === articuloId && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  };

  // Eliminar del carrito
  const eliminarDelCarrito = (articuloId) => {
    setCarritoEscaneados(prev => prev.filter(item => item.articulo.id !== articuloId));
  };

  // Crear pedido con todos los artículos del carrito
  const crearPedido = () => {
    if (carritoEscaneados.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    carritoEscaneados.forEach(item => {
      agregarArticulo(item.articulo, item.cantidad);
    });
    toast.success(`${carritoEscaneados.length} producto(s) agregado(s) al pedido`);
    setCarritoEscaneados([]);
    onClose();
  };

  // Cancelar y limpiar carrito
  const cancelar = () => {
    if (carritoEscaneados.length > 0) {
      // Diseño 3G encendido y con la cámara apagada: vista previa del paquete. Con la cámara encendida se queda el
      // confirm() de siempre, que detiene la lectura mientras pregunta (un diálogo propio la dejaría seguir leyendo).
      if (g3Activo() && !isScanning) {
        const n = carritoEscaneados.length;
        confirmarG3({
          titulo: '¿Descartar los artículos escaneados?',
          datos: [['Artículos escaneados', String(n)]],
          pasa: ['No se agregan al pedido y se cierra el escáner.'],
          confirmar: 'Descartar', cancelar: 'Seguir escaneando', peligro: true,
        }).then((si) => {
          if (!si) return;
          setCarritoEscaneados([]);
          onClose();
        });
        return;
      }
      if (window.confirm('¿Deseas descartar los artículos escaneados?')) {
        setCarritoEscaneados([]);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Iniciar escaneo
  const startScanning = async () => {
    if (!selectedCamera) {
      toast.error('No se encontró ninguna cámara');
      return;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('ean13-scanner');

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
          // console.log('Escaneando...', errorMessage);
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
      html5QrCodeRef.current = new Html5Qrcode('ean13-scanner');

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 350, height: 150 },
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

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // Rediseño 2 encendido: la cámara arriba y los escaneados abajo, en el mismo lugar donde la abre cada pantalla (sin el
  // panel lateral aparte). «Vaciar» repite tal cual lo que hoy va escrito dentro del botón «Vaciar Carrito».
  if (d3) {
    return (
      <EscanerCamaraR2 c={{
        isScanning, cameras, selectedCamera, setSelectedCamera, carritoEscaneados, flashEffect,
        startScanning, stopScanning, switchCamera, aumentarCantidad, disminuirCantidad, eliminarDelCarrito, crearPedido,
        vaciarCarrito: () => {
          if (g3Activo() && !isScanning) {
            confirmarG3({
              titulo: '¿Vaciar el carrito?',
              datos: [['Artículos escaneados', String(carritoEscaneados.length)]],
              confirmar: 'Vaciar carrito', cancelar: 'No vaciar', peligro: true,
            }).then((si) => { if (si) setCarritoEscaneados([]); });
            return;
          }
          if (window.confirm('¿Deseas vaciar el carrito?')) {
            setCarritoEscaneados([]);
          }
        },
      }} />
    );
  }

  // Componente del carrito para renderizar con Portal
  const carritoModal = carritoEscaneados.length > 0 ? (
    <div className="fixed top-0 right-0 h-screen w-full sm:w-96 bg-white shadow-2xl flex flex-col" style={{ zIndex: 9999 }}>
      {/* Header del carrito */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-red-700 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
            <h3 className="font-bold text-base sm:text-lg">Carrito</h3>
          </div>
          <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 bg-white text-red-700 font-bold rounded-full text-sm">
            {carritoEscaneados.length}
          </span>
        </div>
        <p className="text-red-100 text-xs sm:text-sm">Productos escaneados</p>
      </div>

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 bg-gray-50">
        {carritoEscaneados.map((item) => (
          <div
            key={item.articulo.id}
            className="bg-white rounded-lg shadow-md p-2.5 sm:p-3 space-y-2 sm:space-y-3 border border-gray-200"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Imagen del artículo */}
              <div className="flex-shrink-0">
                {item.articulo.imagen_url ? (
                  <img
                    src={getImageUrl(item.articulo.imagen_url)}
                    alt={item.articulo.nombre}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-200"
                    onError={(e) => {
                      // Si falla la carga, mostrar placeholder
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xl sm:text-2xl"
                  style={{ display: item.articulo.imagen_url ? 'none' : 'flex' }}
                >
                  {g3 ? <Package size={24} className="text-gray-400" aria-hidden="true" /> : '📦'}
                </div>
              </div>

              {/* Información del producto */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-tight mb-1 truncate">
                  {item.articulo.nombre}
                </h4>
                <p className="text-xs text-gray-500 font-mono">
                  {item.articulo.codigo_ean13}
                </p>
              </div>

              {/* Botón eliminar */}
              <button
                onClick={() => eliminarDelCarrito(item.articulo.id)}
                className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0 self-start"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Controles de cantidad */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => disminuirCantidad(item.articulo.id)}
                  disabled={item.cantidad <= 1}
                  className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center font-bold text-gray-900">
                  {item.cantidad}
                </span>
                <button
                  onClick={() => aumentarCantidad(item.articulo.id)}
                  className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {item.articulo.unidad}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="p-4 bg-white border-t-2 border-gray-200 space-y-2">
        <button
          onClick={crearPedido}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all"
        >
          <CheckCircle size={20} />
          Crear Pedido ({carritoEscaneados.length})
        </button>
        <button
          onClick={() => {
            if (g3Activo() && !isScanning) {
              confirmarG3({
                titulo: '¿Vaciar el carrito?',
                datos: [['Artículos escaneados', String(carritoEscaneados.length)]],
                confirmar: 'Vaciar carrito', cancelar: 'No vaciar', peligro: true,
              }).then((si) => { if (si) setCarritoEscaneados([]); });
              return;
            }
            if (window.confirm('¿Deseas vaciar el carrito?')) {
              setCarritoEscaneados([]);
            }
          }}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          Vaciar Carrito
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Estilos CSS para ocultar las esquinas del scanner */}
      <style>{`
        /* Ocultar completamente el qr-shaded-region y sus bordes */
        #ean13-scanner #qr-shaded-region {
          border: none !important;
          box-shadow: none !important;
        }

        /* Ocultar el scan region border */
        #ean13-scanner__scan_region {
          border: none !important;
          outline: none !important;
        }

        /* Ocultar los bordes SVG que genera la librería */
        #ean13-scanner svg {
          display: none !important;
        }

        /* Ocultar cualquier canvas overlay de la librería */
        #ean13-scanner canvas:last-of-type {
          opacity: 0 !important;
        }
      `}</style>

      {/* Renderizar carrito usando Portal */}
      {carritoModal && createPortal(carritoModal, document.body)}

      {/* Panel principal de escaneo */}
      <div className="space-y-4">
        {/* Área de escaneo - Mayor altura para mejor visualización */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <div id="ean13-scanner" className="w-full h-96" />

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

          {/* Esquinas blancas fijas como guía de escaneo */}
          {isScanning && (
            <>
              {/* Esquina superior izquierda - blanca fija */}
              <div className="absolute top-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-t-4 border-white opacity-70 pointer-events-none" />
              {/* Esquina superior derecha - blanca fija */}
              <div className="absolute top-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-t-4 border-white opacity-70 pointer-events-none" />
              {/* Esquina inferior izquierda - blanca fija */}
              <div className="absolute bottom-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-b-4 border-white opacity-70 pointer-events-none" />
              {/* Esquina inferior derecha - blanca fija */}
              <div className="absolute bottom-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-b-4 border-white opacity-70 pointer-events-none" />
            </>
          )}

          {/* Esquinas verdes que parpadean cuando se escanea exitosamente */}
          {flashEffect && (
            <>
              {/* Esquina superior izquierda - verde parpadeante */}
              <div className="absolute top-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-t-4 border-green-400 animate-pulse pointer-events-none" />
              {/* Esquina superior derecha - verde parpadeante */}
              <div className="absolute top-[25%] right-[50%] translate-x-[175px] w-8 h-8 border-r-4 border-t-4 border-green-400 animate-pulse pointer-events-none" />
              {/* Esquina inferior izquierda - verde parpadeante */}
              <div className="absolute bottom-[25%] left-[50%] -translate-x-[175px] w-8 h-8 border-l-4 border-b-4 border-green-400 animate-pulse pointer-events-none" />
              {/* Esquina inferior derecha - verde parpadeante */}
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Instrucciones:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Coloca el código de barras EAN-13 dentro del área de escaneo</li>
                <li>Mantén el código estable y bien iluminado</li>
                <li>Los artículos escaneados aparecerán en el panel lateral derecho</li>
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
              onClick={startScanning}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
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
        </div>
      </div>
    </>
  );
};

export default EAN13Scanner;
