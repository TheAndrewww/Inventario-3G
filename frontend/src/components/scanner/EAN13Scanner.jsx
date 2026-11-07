import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';
import { usePedido } from '../../context/PedidoContext';
import { confirmarG3 } from '../../diseno-3g/dialogosG3';
import { EscanerCamaraR2 } from '../../rediseno2/tickets/PiezasEscaner';

const EAN13Scanner = ({ onClose }) => {
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
      if (!isScanning) {
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

  return (
    <EscanerCamaraR2 c={{
      isScanning, cameras, selectedCamera, setSelectedCamera, carritoEscaneados, flashEffect,
      startScanning, stopScanning, switchCamera, aumentarCantidad, disminuirCantidad, eliminarDelCarrito, crearPedido,
      vaciarCarrito: () => {
        if (!isScanning) {
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
};

export default EAN13Scanner;
