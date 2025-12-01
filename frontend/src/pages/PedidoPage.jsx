import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Package, Users, Truck, Search, Barcode, PlusCircle } from 'lucide-react';
import { usePedido } from '../context/PedidoContext';
import { Button } from '../components/common';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import pedidosService from '../services/pedidos.service';
import equiposService from '../services/equipos.service';
import ubicacionesService from '../services/ubicaciones.service';
import articulosService from '../services/articulos.service';
import EAN13Scanner from '../components/scanner/EAN13Scanner';
import ArticuloFormModal from '../components/articulos/ArticuloFormModal';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUtils';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import BarcodeScannerIndicator from '../components/scanner/BarcodeScannerIndicator';
import ScanSuccessNotification from '../components/scanner/ScanSuccessNotification';
import { jsPDF } from 'jspdf';

const PedidoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    incrementar,
    decrementar,
    eliminarArticulo,
    actualizarCantidad,
    limpiarPedido,
    getTotalPiezas,
    getCostoTotal,
  } = usePedido();

  const [proyecto, setProyecto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [cargandoEquipos, setCargandoEquipos] = useState(false);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionDestino, setUbicacionDestino] = useState('');
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);

  // Estados para búsqueda rápida
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { agregarArticulo } = usePedido();

  // Estados para pistola de códigos automática
  const [lastScannedArticle, setLastScannedArticle] = useState(null);
  const [showScanSuccess, setShowScanSuccess] = useState(false);

  // Estados para modal de nuevo artículo
  const [modalNuevoArticulo, setModalNuevoArticulo] = useState(false);
  const [nombreNuevoArticulo, setNombreNuevoArticulo] = useState(null);

  // Cargar equipos si el usuario es almacenista
  useEffect(() => {
    const cargarEquipos = async () => {
      if (user?.rol === 'almacen') {
        try {
          setCargandoEquipos(true);
          const response = await equiposService.obtenerTodos();
          setEquipos(response.data.equipos || []);
        } catch (error) {
          console.error('Error al cargar equipos:', error);
          toast.error('Error al cargar equipos');
        } finally {
          setCargandoEquipos(false);
        }
      }
    };

    cargarEquipos();
  }, [user]);

  // Cargar ubicaciones (camionetas y stock general)
  useEffect(() => {
    const cargarUbicaciones = async () => {
      try {
        setCargandoUbicaciones(true);
        const ubicacionesData = await ubicacionesService.getAll();
        // Filtrar solo ubicaciones que son camionetas o stock general
        const ubicacionesCamionetas = ubicacionesData.filter(ub =>
          ub.almacen.includes('Camioneta') ||
          ub.almacen.includes('Stock General') ||
          ub.codigo.includes('NP300') ||
          ub.codigo.includes('TORNADO') ||
          ub.codigo.includes('SAVEIRO') ||
          ub.codigo.includes('STOCK-GEN')
        );
        setUbicaciones(ubicacionesCamionetas);
      } catch (error) {
        console.error('Error al cargar ubicaciones:', error);
        toast.error('Error al cargar ubicaciones de destino');
      } finally {
        setCargandoUbicaciones(false);
      }
    };

    cargarUbicaciones();
  }, []);

  const handleCantidadChange = (id, value) => {
    const cantidad = parseInt(value);
    if (isNaN(cantidad) || cantidad < 1) {
      return;
    }
    actualizarCantidad(id, cantidad);
  };

  const handleCantidadBlur = (id, value) => {
    const cantidad = parseInt(value);
    if (isNaN(cantidad) || cantidad < 1) {
      // Si el valor es inválido, resetear a 1
      actualizarCantidad(id, 1);
      toast.error('La cantidad debe ser al menos 1');
    }
  };

  const handleVaciarCarrito = () => {
    if (items.length === 0) {
      return;
    }

    const confirmar = window.confirm(
      `¿Estás seguro que deseas vaciar el carrito?\n\nSe eliminarán ${items.length} artículo(s) con un total de ${getTotalPiezas()} pieza(s).`
    );

    if (confirmar) {
      limpiarPedido();
      toast.success('Carrito vaciado exitosamente');
    }
  };

  // Función para cargar imagen desde URL y obtener base64 + dimensiones
  const loadImageWithDimensions = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Crear imagen para obtener dimensiones
          const img = new Image();
          img.onload = () => {
            resolve({
              base64: reader.result,
              width: img.width,
              height: img.height,
              aspectRatio: img.width / img.height
            });
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error cargando imagen:', error);
      return null;
    }
  };

  const generatePDF = async (pedido) => {
    try {
      // URLs de los logos
      const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
      const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

      // Cargar imágenes
      const [logoData, marcaAguaData] = await Promise.all([
        loadImageWithDimensions(logoCompletoUrl),
        loadImageWithDimensions(marcaAguaUrl)
      ]);

      // === CALCULAR ALTURA NECESARIA DEL DOCUMENTO ===
      const articulos = pedido.detalles || [];

      // Agrupar artículos por categoría
      const articulosPorCategoria = {};
      articulos.forEach(detalle => {
        const categoria = detalle.articulo?.categoria?.nombre || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
          articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(detalle);
      });

      // Cargar imágenes de artículos
      const imagenesArticulos = {};
      for (const detalle of articulos) {
        if (detalle.articulo?.imagen_url) {
          try {
            const imagenData = await loadImageWithDimensions(detalle.articulo.imagen_url);
            if (imagenData) {
              imagenesArticulos[detalle.articulo_id] = imagenData;
            }
          } catch (error) {
            console.error(`Error cargando imagen del artículo ${detalle.articulo_id}:`, error);
          }
        }
      }

      // Calcular altura aproximada necesaria
      let alturaEstimada = 100; // Header inicial
      Object.keys(articulosPorCategoria).forEach(categoria => {
        alturaEstimada += 8; // Título de categoría
        articulosPorCategoria[categoria].forEach(detalle => {
          alturaEstimada += 20; // Espacio por artículo con imagen
          const descripcion = detalle.articulo?.descripcion || '';
          if (descripcion) {
            const lineasDesc = Math.ceil(descripcion.length / 50);
            alturaEstimada += lineasDesc * 4;
          }
        });
        alturaEstimada += 5; // Espacio entre categorías
      });
      alturaEstimada += 10; // Margen final

      // Crear documento con formato ticket (80mm de ancho, altura dinámica)
      const anchoTicket = 80; // mm
      const altoTicket = Math.max(200, alturaEstimada); // Mínimo 200mm
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [anchoTicket, altoTicket]
      });

      let yPos = 5;
      const margen = 5;
      const anchoUtil = anchoTicket - (margen * 2);

      // === HEADER ===
      // Logo completo centrado
      if (logoData) {
        const logoWidth = 60;
        const logoHeight = logoWidth / logoData.aspectRatio;
        const logoX = (anchoTicket - logoWidth) / 2;
        doc.addImage(logoData.base64, 'PNG', logoX, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 5;
      }

      // Información del pedido (centrada)
      doc.setFontSize(8);

      // Supervisor
      doc.setFont(undefined, 'bold');
      doc.text('SUPERVISOR', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const supervisor = pedido.aprobadoPor?.nombre || pedido.usuario?.nombre || 'N/A';
      const supervisorLines = doc.splitTextToSize(supervisor, anchoUtil);
      supervisorLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
      });
      yPos += 2;

      // Proyecto
      doc.setFont(undefined, 'bold');
      doc.text('PROYECTO', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const proyecto = pedido.proyecto || pedido.equipo?.nombre || 'Sin proyecto';
      const proyectoLines = doc.splitTextToSize(proyecto, anchoUtil);
      proyectoLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
      });
      yPos += 2;

      // Fecha
      doc.setFont(undefined, 'bold');
      doc.text('FECHA DE SALIDA', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const fechaPedido = pedido.created_at || pedido.createdAt;
      doc.text(
        fechaPedido ? new Date(fechaPedido).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        anchoTicket / 2,
        yPos,
        { align: 'center' }
      );
      yPos += 6;

      // === TÍTULO PRINCIPAL ===
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('ORDEN DE SALIDA', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 6;

      // Línea divisoria
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margen, yPos, anchoTicket - margen, yPos);
      yPos += 5;

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      doc.setFontSize(8);
      Object.keys(articulosPorCategoria).forEach(categoria => {
        // Nombre de categoría
        doc.setFont(undefined, 'bold');
        doc.text(categoria.toUpperCase(), margen, yPos);
        yPos += 4;

        // Lista de artículos
        doc.setFont(undefined, 'normal');
        articulosPorCategoria[categoria].forEach(detalle => {
          const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const descripcion = detalle.articulo?.descripcion || '';
          const cantidad = detalle.cantidad;
          const unidad = detalle.articulo?.unidad || 'uds';
          const imagenArticulo = imagenesArticulos[detalle.articulo_id];

          // Dibujar imagen del artículo si existe
          const imgSize = 12; // Tamaño de imagen en mm
          let textX = margen;
          let textStartY = yPos;

          if (imagenArticulo) {
            const imgWidth = imgSize;
            const imgHeight = imgSize / imagenArticulo.aspectRatio;

            // Borde de imagen
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.rect(margen, yPos, imgWidth, imgHeight);

            // Agregar imagen
            doc.addImage(imagenArticulo.base64, 'JPEG', margen, yPos, imgWidth, imgHeight);
            textX = margen + imgWidth + 2;
            textStartY = yPos + 3;
            yPos = Math.max(yPos + imgHeight, textStartY);
          } else {
            textStartY = yPos + 3;
          }

          // Nombre y cantidad en negrita
          doc.setFont(undefined, 'bold');
          const texto = `• ${nombreArticulo} - ${cantidad} ${unidad}`;
          const textoLines = doc.splitTextToSize(texto, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
          doc.text(textoLines, textX, textStartY);
          const altoTexto = textoLines.length * 3.5;

          // Descripción si existe
          if (descripcion) {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7);
            const descLines = doc.splitTextToSize(`  ${descripcion}`, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
            doc.text(descLines, textX, textStartY + altoTexto);
            yPos = Math.max(yPos, textStartY + altoTexto + (descLines.length * 3));
            doc.setFontSize(8);
          } else {
            yPos = Math.max(yPos, textStartY + altoTexto);
          }

          yPos += 3;
        });

        yPos += 3; // Espacio entre categorías
      });

      // === MARCA DE AGUA ===
      if (marcaAguaData) {
        const gState = doc.GState({ opacity: 0.05 });
        doc.setGState(gState);

        const watermarkWidth = 60;
        const watermarkHeight = watermarkWidth / marcaAguaData.aspectRatio;
        const watermarkX = (anchoTicket - watermarkWidth) / 2;
        const watermarkY = altoTicket / 2 - watermarkHeight / 2;

        doc.addImage(marcaAguaData.base64, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight, undefined, 'NONE', 0);
        doc.setGState(doc.GState({ opacity: 1 }));
      }

      // Descargar PDF
      doc.save(`Ticket-${pedido.ticket_id}.pdf`);
      toast.success('Ticket descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const handleFinalizarPedido = async () => {
    if (items.length === 0) {
      toast.error('El pedido está vacío');
      return;
    }

    // Validaciones según el rol
    if (user?.rol === 'almacen') {
      // Almacenista debe seleccionar equipo
      if (!equipoSeleccionado) {
        toast.error('Debes seleccionar un equipo');
        return;
      }
    } else {
      // Diseñador/Admin debe especificar proyecto O ubicación destino
      if (!proyecto.trim() && !ubicacionDestino) {
        toast.error('Debes especificar un proyecto o seleccionar una ubicación destino');
        return;
      }
    }

    try {
      const articulosPedido = items.map((item) => ({
        articulo_id: item.id,
        cantidad: item.cantidad,
        observaciones: '',
      }));

      const data = {
        articulos: articulosPedido,
        observaciones: observaciones.trim() || `Pedido creado por ${user?.nombre || 'Usuario'}`,
      };

      // Agregar proyecto o equipo según el rol
      if (user?.rol === 'almacen') {
        data.equipo_id = parseInt(equipoSeleccionado);
      } else {
        // Si se seleccionó ubicación destino, no enviar proyecto
        if (ubicacionDestino) {
          data.ubicacion_destino_id = parseInt(ubicacionDestino);
          // Agregar proyecto solo si hay texto
          if (proyecto.trim()) {
            data.proyecto = proyecto.trim();
          }
        } else {
          // Si no hay ubicación destino, el proyecto es obligatorio
          data.proyecto = proyecto.trim();
        }
      }

      const response = await pedidosService.crear(data);

      if (user?.rol === 'almacen') {
        toast.success('¡Pedido creado! Esperando aprobación del encargado');
      } else {
        toast.success('¡Pedido creado exitosamente!');
      }

      // Obtener detalles completos del pedido para generar PDF
      try {
        const pedidoCreado = response.data.pedido;
        if (pedidoCreado && pedidoCreado.id) {
          // Obtener detalles completos incluyendo artículos
          const pedidoCompleto = await pedidosService.obtenerPorId(pedidoCreado.id);

          // Generar PDF automáticamente
          // La respuesta tiene la estructura: { success: true, data: { pedido: {...} } }
          await generatePDF(pedidoCompleto.data.pedido);
        }
      } catch (pdfError) {
        console.error('Error al generar PDF:', pdfError);
        // No bloquear el flujo si falla el PDF
        toast.error('El pedido se creó pero hubo un error al generar el PDF');
      }

      limpiarPedido();
      setProyecto('');
      setObservaciones('');
      setEquipoSeleccionado('');
      setUbicacionDestino('');

      navigate('/historial');
    } catch (error) {
      console.error('Error al crear pedido:', error);
      toast.error(error.response?.data?.message || error.message || 'Error al crear el pedido');
    }
  };

  // Buscar artículos por nombre o código
  const buscarArticulos = async (termino) => {
    if (!termino || termino.length < 2) {
      setResultadosBusqueda([]);
      return;
    }

    try {
      setBuscando(true);
      const articulos = await articulosService.getAll();

      // Filtrar artículos localmente por nombre o código
      const resultados = articulos.filter(art => {
        const nombreMatch = art.nombre?.toLowerCase().includes(termino.toLowerCase());
        const codigoMatch = art.codigo_ean13?.includes(termino);
        const activoMatch = art.activo !== false;
        return (nombreMatch || codigoMatch) && activoMatch;
      });

      setResultadosBusqueda(resultados);
    } catch (error) {
      console.error('Error al buscar artículos:', error);
      toast.error('Error al buscar artículos');
    } finally {
      setBuscando(false);
    }
  };

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarArticulos(busqueda);
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda]);

  // Buscar por código de barras
  const buscarPorCodigo = async (codigo) => {
    try {
      const response = await articulosService.getByEAN13(codigo);
      if (response && response.id) {
        agregarArticulo(response);
        toast.success(`✓ ${response.nombre} agregado`);
        setBusqueda('');
        setResultadosBusqueda([]);
        setShowScanner(false);
      }
    } catch (error) {
      console.error('Error al buscar por código:', error);
      toast.error('Artículo no encontrado');
    }
  };

  // Función para manejar escaneo desde pistola automática
  const handleBarcodeScan = async (codigo) => {
    try {
      let articuloEncontrado = null;

      // Estrategia 1: Intentar buscar por código EAN-13 si tiene 13 dígitos
      if (codigo.length === 13 && /^\d+$/.test(codigo)) {
        try {
          const response = await articulosService.getByEAN13(codigo);
          if (response && response.id) {
            articuloEncontrado = response;
          }
        } catch (error) {
          // No encontrado como EAN-13, continuar con búsqueda general
        }
      }

      // Estrategia 2: Si no se encontró, buscar en todos los artículos por código
      if (!articuloEncontrado) {
        const todosLosArticulos = await articulosService.getAll();

        // Buscar por código_ean13 exacto (cualquier longitud)
        articuloEncontrado = todosLosArticulos.find(art =>
          art.codigo_ean13 === codigo && art.activo !== false
        );

        // Si aún no se encuentra, buscar por código que contenga el escaneado
        if (!articuloEncontrado) {
          articuloEncontrado = todosLosArticulos.find(art =>
            art.codigo_ean13?.includes(codigo) && art.activo !== false
          );
        }
      }

      if (articuloEncontrado && articuloEncontrado.id) {
        // Agregar al pedido
        agregarArticulo(articuloEncontrado);

        // Mostrar notificación visual personalizada
        setLastScannedArticle(articuloEncontrado);
        setShowScanSuccess(true);

        // También mostrar toast para confirmación
        toast.success(`✓ ${articuloEncontrado.nombre} agregado`, {
          icon: '📦',
          duration: 2000,
        });
      } else {
        toast.error(`❌ Artículo no encontrado: ${codigo}`, {
          duration: 4000,
        });
      }
    } catch (error) {
      toast.error(`❌ Error al buscar artículo`, {
        duration: 3000,
      });
    }
  };

  // Activar detección automática de pistola de códigos
  const { isScanning } = useBarcodeScanner(handleBarcodeScan, {
    enabled: true, // Siempre activa en la página de pedidos
    minLength: 6, // Códigos mínimos de 6 caracteres
    timeout: 200, // 200ms entre caracteres para capturar todos
  });

  // Agregar artículo desde búsqueda
  const handleAgregarArticulo = (articulo) => {
    agregarArticulo(articulo);
    toast.success(`✓ ${articulo.nombre} agregado`);
    setBusqueda('');
    setResultadosBusqueda([]);
  };

  // Handler para cuando se crea un nuevo artículo exitosamente
  const handleNuevoArticuloCreado = (nuevoArticulo) => {
    toast.success(`✓ Artículo "${nuevoArticulo.nombre}" creado exitosamente`);
    // Agregar el nuevo artículo al pedido
    agregarArticulo(nuevoArticulo);
    // Limpiar búsqueda
    setBusqueda('');
    setResultadosBusqueda([]);
    // Cerrar modal
    setModalNuevoArticulo(false);
    setNombreNuevoArticulo(null);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Indicador de escaneo activo */}
      <BarcodeScannerIndicator isScanning={isScanning} />

      {/* Notificación de artículo escaneado exitosamente */}
      {showScanSuccess && lastScannedArticle && (
        <ScanSuccessNotification
          articulo={lastScannedArticle}
          onClose={() => {
            setShowScanSuccess(false);
            setLastScannedArticle(null);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Lista de artículos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Panel de Búsqueda Rápida */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Search size={20} />
              Buscar y Agregar Artículos
            </h3>

            {/* Barra de búsqueda con scanner */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                    placeholder="BUSCAR POR NOMBRE O CÓDIGO..."
                    className="w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent text-sm md:text-base"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <button
                  onClick={() => setShowScanner(!showScanner)}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                    showScanner
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Escanear código de barras"
                >
                  <Barcode size={20} />
                </button>
              </div>

              {/* Scanner */}
              {showScanner && (
                <div className="border-2 border-red-700 rounded-lg p-3 bg-gray-50">
                  <EAN13Scanner
                    onScan={buscarPorCodigo}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              )}

              {/* Resultados de búsqueda */}
              {busqueda.length >= 2 && (
                <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                  {buscando ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto"></div>
                      <p className="mt-2 text-sm">Buscando...</p>
                    </div>
                  ) : resultadosBusqueda.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {resultadosBusqueda.map((articulo) => {
                        const imagenUrl = articulo.imagen_url
                          ? getImageUrl(articulo.imagen_url)
                          : null;

                        return (
                          <div
                            key={articulo.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleAgregarArticulo(articulo)}
                          >
                            <div className="flex items-center gap-3">
                              {imagenUrl ? (
                                <img
                                  src={imagenUrl}
                                  alt={articulo.nombre}
                                  className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm truncate">
                                  {articulo.nombre}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                  {articulo.codigo_ean13} • Stock: {articulo.stock_actual}
                                </p>
                              </div>
                              <button
                                className="px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAgregarArticulo(articulo);
                                }}
                              >
                                <Plus size={14} />
                                Agregar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-gray-600 mb-3 text-sm">
                        No se encontraron artículos con "{busqueda}"
                      </p>
                      <button
                        onClick={() => {
                          setNombreNuevoArticulo(busqueda);
                          setModalNuevoArticulo(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mx-auto text-sm"
                      >
                        <PlusCircle size={18} />
                        Crear nuevo artículo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!busqueda && !showScanner && (
                <p className="text-xs text-gray-500 text-center">
                  Escribe el nombre o código del artículo, o escanea su código de barras
                </p>
              )}
            </div>
          </div>

          {/* Lista de artículos en el pedido */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Artículos en el Pedido</h3>

            {items.length === 0 ? (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20 md:w-16 md:h-16" />
                <p className="text-base md:text-lg mb-2">No hay artículos en el pedido</p>
                <p className="text-sm">Agrega artículos desde el inventario</p>
                <button
                  onClick={() => navigate('/inventario')}
                  className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm md:text-base"
                >
                  Ver Inventario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const imagenUrl = item.imagen_url
                    ? getImageUrl(item.imagen_url)
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {imagenUrl ? (
                          <img
                            src={imagenUrl}
                            alt={item.nombre}
                            className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl md:text-3xl flex-shrink-0">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm md:text-base truncate">{item.nombre}</h4>
                          <p className="text-xs md:text-sm text-gray-500 truncate">
                            {item.codigo_ean13}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500">
                            ${(parseFloat(item.costo_unitario) || 0).toFixed(2)} c/u
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decrementar(item.id)}
                            className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                            onBlur={(e) => handleCantidadBlur(item.id, e.target.value)}
                            min="1"
                            className="text-base md:text-lg font-bold w-14 md:w-16 text-center border-2 border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent"
                          />
                          <button
                            onClick={() => incrementar(item.id)}
                            className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right min-w-[80px] md:min-w-[100px]">
                          <p className="font-bold text-gray-900 text-sm md:text-base">
                            ${(item.cantidad * (item.costo_unitario || 0)).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => eliminarArticulo(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resumen del pedido */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 lg:sticky lg:top-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>

            {/* Formulario de proyecto/equipo y observaciones */}
            <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b border-gray-200">
              {user?.rol === 'almacen' ? (
                // Almacenista selecciona equipo
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} />
                      <span>Equipo *</span>
                    </div>
                  </label>
                  <select
                    value={equipoSeleccionado}
                    onChange={(e) => setEquipoSeleccionado(e.target.value)}
                    className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    disabled={cargandoEquipos}
                    required
                  >
                    <option value="">Selecciona un equipo...</option>
                    {equipos.map((equipo) => (
                      <option key={equipo.id} value={equipo.id}>
                        {equipo.nombre}
                      </option>
                    ))}
                  </select>
                  {equipoSeleccionado && equipos.find(e => e.id === parseInt(equipoSeleccionado)) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Supervisor: {equipos.find(e => e.id === parseInt(equipoSeleccionado))?.supervisor?.nombre || 'N/A'}
                    </p>
                  )}
                </div>
              ) : (
                // Diseñador/Admin especifica destino (proyecto o ubicación)
                <>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={14} />
                        <span>Destino del Pedido *</span>
                      </div>
                    </label>
                    <select
                      value={ubicacionDestino}
                      onChange={(e) => setUbicacionDestino(e.target.value)}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                      disabled={cargandoUbicaciones}
                    >
                      <option value="">Proyecto específico (ingresa nombre abajo)</option>
                      {ubicaciones.map((ubicacion) => (
                        <option key={ubicacion.id} value={ubicacion.id}>
                          {ubicacion.almacen.includes('Camioneta') ? '🚛' : '📦'} {ubicacion.almacen}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!ubicacionDestino && (
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Package size={14} />
                          <span>Nombre del Proyecto *</span>
                        </div>
                      </label>
                      <input
                        type="text"
                        value={proyecto}
                        onChange={(e) => setProyecto(e.target.value)}
                        placeholder="Ej: Instalación Centro Comercial..."
                        className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                        required={!ubicacionDestino}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Requerido solo si no seleccionaste una ubicación arriba
                      </p>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
                />
              </div>
            </div>

            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
              <div className="flex justify-between text-gray-600 text-sm md:text-base">
                <span>Total de artículos:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm md:text-base">
                <span>Total de piezas:</span>
                <span className="font-medium">{getTotalPiezas()}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 md:pt-3 flex justify-between">
                <span className="font-bold text-gray-900 text-sm md:text-base">Costo Total:</span>
                <span className="font-bold text-lg md:text-xl text-red-700">${getCostoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 md:space-y-3">
              <Button
                variant="primary"
                fullWidth
                disabled={items.length === 0}
                onClick={handleFinalizarPedido}
              >
                <span className="text-sm md:text-base">Finalizar Pedido</span>
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={items.length === 0}
                onClick={handleVaciarCarrito}
              >
                <span className="text-sm md:text-base">Vaciar Carrito</span>
              </Button>
            </div>

            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">Información</h4>
              <p className="text-xs md:text-sm text-gray-600">
                Usuario: <span className="font-medium">{user?.nombre || 'N/A'}</span>
              </p>
              <p className="text-xs md:text-sm text-gray-600">
                Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-MX')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para crear nuevo artículo */}
      <ArticuloFormModal
        isOpen={modalNuevoArticulo}
        onClose={() => {
          setModalNuevoArticulo(false);
          setNombreNuevoArticulo(null);
        }}
        onSuccess={handleNuevoArticuloCreado}
        articulo={null}
        nombreInicial={nombreNuevoArticulo}
      />
    </div>
  );
};

export default PedidoPage;
