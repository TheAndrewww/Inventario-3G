import React, { useState, useEffect } from 'react';
import { usePedido } from '../context/PedidoContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import pedidosService from '../services/pedidos.service';
import ordenesCompraService from '../services/ordenesCompra.service';
import camionetasService from '../services/camionetas.service';
import articulosService from '../services/articulos.service';
import produccionService from '../services/produccion.service';
import usuariosService from '../services/usuarios.service';
import { flattenProyectos } from '../utils/produccion';
import EAN13Scanner from '../components/scanner/EAN13Scanner';
import ArticuloFormModal from '../components/articulos/ArticuloFormModal';
import toast from 'react-hot-toast';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import ScanSuccessNotification from '../components/scanner/ScanSuccessNotification';
import { generateTicketPDF } from '../utils/pdfGenerator';
import { ModalCrearOrdenDesdeSolicitudes } from './OrdenesCompraPage';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaOrdenSalida from '../rediseno2/tickets/VistaOrdenSalida';

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
  const [camionetas, setCamionetas] = useState([]);
  const [camionetaSeleccionada, setCamionetaSeleccionada] = useState('');
  const [cargandoCamionetas, setCargandoCamionetas] = useState(false);
  const [proyectosProduccion, setProyectosProduccion] = useState([]);
  const [cargandoProyectos, setCargandoProyectos] = useState(false);
  const [encargados, setEncargados] = useState([]);
  const [encargadoSeleccionado, setEncargadoSeleccionado] = useState('');
  const [cargandoEncargados, setCargandoEncargados] = useState(false);

  // Estados para búsqueda rápida
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { agregarArticulo } = usePedido();

  // Estados para pistola de códigos automática
  const [lastScannedArticle, setLastScannedArticle] = useState(null);
  const [showScanSuccess, setShowScanSuccess] = useState(false);

  // Paso 2: generar orden de compra desde los faltantes de la orden de salida
  const [mostrarModalOrden, setMostrarModalOrden] = useState(false);
  const [solicitudesOrden, setSolicitudesOrden] = useState([]);

  // Estados para modal de nuevo artículo
  const [modalNuevoArticulo, setModalNuevoArticulo] = useState(false);
  const [nombreNuevoArticulo, setNombreNuevoArticulo] = useState(null);

  // Cargar equipos si el usuario es almacenista
  useEffect(() => {
    const cargarEquipos = async () => {
      if (user?.rol === 'almacen') {
        try {
          setCargandoEquipos(true);
          const response = await camionetasService.obtenerTodos();
          setEquipos(response.data.camionetas || []);
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

  // Cargar camionetas si el usuario es almacenista
  useEffect(() => {
    const cargarCamionetas = async () => {
      if (user?.rol === 'almacen') {
        try {
          setCargandoCamionetas(true);
          const response = await camionetasService.obtenerTodos();
          setCamionetas(response.data.camionetas || []);
        } catch (error) {
          console.error('Error al cargar camionetas:', error);
          toast.error('Error al cargar camionetas');
        } finally {
          setCargandoCamionetas(false);
        }
      }
    };

    cargarCamionetas();
  }, [user]);

  // Cargar proyectos activos de producción (para diseñador/admin)
  useEffect(() => {
    const cargarProyectos = async () => {
      if (user?.rol !== 'almacen') {
        try {
          setCargandoProyectos(true);
          const response = await produccionService.obtenerDashboard();
          if (response.success) {
            const todos = flattenProyectos(response.data.resumen);
            setProyectosProduccion(todos.filter(p => {
              if (p.etapa_actual === 'completado') return false;
              if (p.tipo_proyecto?.toUpperCase().startsWith('CANCELADO')) return false;
              const tipo = p.tipo_proyecto?.toUpperCase();
              const esMTOoGTIA = tipo === 'MTO' || tipo === 'GTIA';
              // A/B/C entran siempre; MTO/GTIA solo si son EXTENSIVO
              return !esMTOoGTIA || p.es_extensivo;
            }));
          }
        } catch (error) {
          console.error('Error al cargar proyectos:', error);
        } finally {
          setCargandoProyectos(false);
        }
      }
    };

    cargarProyectos();
  }, [user]);

  // Cargar encargados (para diseñador/admin/compras)
  useEffect(() => {
    const cargarEncargados = async () => {
      if (user?.rol !== 'almacen') {
        try {
          setCargandoEncargados(true);
          const response = await usuariosService.obtenerEncargados();
          if (response.success) {
            setEncargados(response.data.encargados || []);
          }
        } catch (error) {
          console.error('Error al cargar encargados:', error);
        } finally {
          setCargandoEncargados(false);
        }
      }
    };

    cargarEncargados();
  }, [user]);

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

    const totalPiezas = getTotalPiezas();
    confirmarG3({
      titulo: '¿Vaciar el carrito?',
      datos: [['Artículos', String(items.length)], ['Piezas', String(totalPiezas)]],
      pasa: [`Se eliminarán ${items.length} artículo${items.length !== 1 ? 's' : ''} del carrito con un total de ${totalPiezas} pieza${totalPiezas !== 1 ? 's' : ''}.`],
      confirmar: 'Vaciar carrito', cancelar: 'No vaciar', peligro: true,
    }).then((si) => {
      if (!si) return;
      limpiarPedido();
      toast.success('Carrito vaciado exitosamente');
    });
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
      // Diseñador/Admin debe especificar proyecto
      if (!proyecto.trim()) {
        toast.error('Debes seleccionar un proyecto');
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
        observaciones: observaciones.trim() || null,
      };

      // Agregar proyecto o equipo según el rol
      if (user?.rol === 'almacen') {
        data.equipo_id = parseInt(equipoSeleccionado);
        // Agregar camioneta si fue seleccionada
        if (camionetaSeleccionada) {
          data.camioneta_id = parseInt(camionetaSeleccionada);
        }
      } else {
        data.proyecto = proyecto.trim();
        if (encargadoSeleccionado) {
          data.supervisor_id = parseInt(encargadoSeleccionado);
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
          const pedidoCompleto = await pedidosService.obtenerPorId(pedidoCreado.id);
          const pedidoData = pedidoCompleto.data.pedido;

          // Generar PDF (descarga automática + retorna base64)
          const pdfBase64 = await generateTicketPDF(pedidoData);

          // Subir ticket a la carpeta del proyecto en Drive. Desde el 27-oct lo sube el servidor solo al crear la
          // orden (ticket_drive: 'servidor'); la pantalla lo sube solo si el servidor dice que no (bandera en 0).
          if (pdfBase64 && pedidoData.proyecto && response.data?.ticket_drive !== 'servidor') {
            try {
              await pedidosService.uploadTicketDrive({
                ticket_id: pedidoData.ticket_id,
                proyecto: pedidoData.proyecto,
                pdf_base64: pdfBase64
              });
              toast.success(`Ticket ${pedidoData.ticket_id} guardado en Drive`);
            } catch (driveError) {
              console.error('Error al subir ticket a Drive:', driveError);
              toast.error(`No se subió el ticket a Drive: ${driveError.response?.data?.message || driveError.message}`);
            }
          }
        }
      } catch (pdfError) {
        console.error('Error al generar PDF:', pdfError);
        toast.error('El pedido se creó pero hubo un error al generar el PDF');
      }

      // La orden de salida ya quedó creada: limpiar el carrito y el formulario
      limpiarPedido();
      setProyecto('');
      setObservaciones('');
      setEquipoSeleccionado('');
      setCamionetaSeleccionada('');
      setEncargadoSeleccionado('');

      // Paso 2 — Si el pedido generó solicitudes de compra automáticas por
      // faltantes/reposición, ofrecer crear la Orden de Compra sin salir de la página.
      const solicitudesGeneradas = response.data?.solicitudes_compra || [];
      if (solicitudesGeneradas.length > 0) {
        try {
          const idsGeneradas = solicitudesGeneradas.map((s) => s.solicitud_id);
          const resSol = await ordenesCompraService.listarSolicitudes({ estado: 'pendiente', limit: 99999 });
          const todas = resSol?.data?.solicitudes || [];
          const soloGeneradas = todas.filter((s) => idsGeneradas.includes(s.id));

          if (soloGeneradas.length > 0) {
            setSolicitudesOrden(soloGeneradas);
            setMostrarModalOrden(true);
            return; // Nos quedamos en la página para crear la orden de compra
          }
        } catch (solError) {
          console.error('Error al cargar faltantes para la orden de compra:', solError);
          toast.error('La orden de salida se creó, pero no se pudieron cargar los faltantes para la orden de compra');
        }
      }

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

      // Filtrar artículos localmente por nombre o código — incluye DESACTIVADOS
      // (para que se vean al buscar y se puedan reactivar/usar en lugar de duplicar)
      const resultados = articulos.filter(art => {
        const nombreMatch = art.nombre?.toLowerCase().includes(termino.toLowerCase());
        const codigoMatch = art.codigo_ean13?.includes(termino);
        return nombreMatch || codigoMatch;
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
        toast.success(`${response.nombre} agregado`);
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
      // (incluye desactivados para evitar duplicados / permitir reactivación)
      if (!articuloEncontrado) {
        const todosLosArticulos = await articulosService.getAll();

        articuloEncontrado = todosLosArticulos.find(art => art.codigo_ean13 === codigo);

        if (!articuloEncontrado) {
          articuloEncontrado = todosLosArticulos.find(art => art.codigo_ean13?.includes(codigo));
        }
      }

      if (articuloEncontrado && articuloEncontrado.id) {
        // Agregar al pedido
        agregarArticulo(articuloEncontrado);

        // Mostrar notificación visual personalizada
        setLastScannedArticle(articuloEncontrado);
        setShowScanSuccess(true);

        // También mostrar toast para confirmación
        toast.success(`${articuloEncontrado.nombre} agregado`, {
          icon: undefined,
          duration: 2000,
        });
      } else {
        toast.error(`Artículo no encontrado: ${codigo}`, {
          duration: 4000,
        });
      }
    } catch (error) {
      toast.error('Error al buscar el artículo', {
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
    toast.success(`${articulo.nombre} agregado`);
    setBusqueda('');
    setResultadosBusqueda([]);
  };

  // Handler para cuando se crea un nuevo artículo exitosamente
  const handleNuevoArticuloCreado = (nuevoArticulo) => {
    toast.success(`Artículo «${nuevoArticulo.nombre}» creado`);
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
    <VistaOrdenSalida e={{
      user, items, incrementar, decrementar, eliminarArticulo, getTotalPiezas, getCostoTotal,
      proyecto, setProyecto, observaciones, setObservaciones,
      equipos, equipoSeleccionado, setEquipoSeleccionado, cargandoEquipos,
      camionetas, camionetaSeleccionada, setCamionetaSeleccionada, cargandoCamionetas,
      proyectosProduccion, cargandoProyectos, encargados, encargadoSeleccionado, setEncargadoSeleccionado, cargandoEncargados,
      busqueda, cambiarBusqueda: (texto) => setBusqueda(texto.toUpperCase()), resultadosBusqueda, buscando,
      showScanner, setShowScanner, isScanning,
      handleCantidadChange, handleCantidadBlur, handleVaciarCarrito, handleFinalizarPedido, handleAgregarArticulo,
      abrirNuevoArticulo: () => {
        setNombreNuevoArticulo(busqueda);
        setModalNuevoArticulo(true);
      },
      irAInventario: () => navigate('/inventario'),
      escaner: showScanner ? <EAN13Scanner onScan={buscarPorCodigo} onClose={() => setShowScanner(false)} /> : null,
      avisoLectura: showScanSuccess && lastScannedArticle ? (
        <ScanSuccessNotification
          articulo={lastScannedArticle}
          onClose={() => {
            setShowScanSuccess(false);
            setLastScannedArticle(null);
          }}
        />
      ) : null,
      modales: (
        <>
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
          {mostrarModalOrden && (
            <ModalCrearOrdenDesdeSolicitudes
              isOpen={mostrarModalOrden}
              solicitudes={solicitudesOrden}
              generarPDFOrden={undefined}
              onClose={() => {
                setMostrarModalOrden(false);
                setSolicitudesOrden([]);
                navigate('/historial');
              }}
              onSuccess={() => {
                setMostrarModalOrden(false);
                setSolicitudesOrden([]);
                navigate('/historial');
              }}
            />
          )}
        </>
      ),
    }} />
  );
};

export default PedidoPage;
