import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import pedidosService from '../services/pedidos.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaTicketsPendientes from '../rediseno2/tickets/VistaTicketsPendientes';

// Devuelve solo las observaciones originales del ticket (recorta anotaciones
// auto-añadidas: [ANULADO], [CANCELADO], [RECHAZADO]... y el placeholder
// legacy "Pedido creado por ...").
const obsOriginales = (texto) => {
  if (!texto) return '';
  const idx = texto.search(/\n\s*\[/);
  const limpio = (idx >= 0 ? texto.substring(0, idx) : texto).trim();
  if (/^Pedido creado por\b/i.test(limpio)) return '';
  return limpio;
};

const PedidosPendientesPage = () => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';

  const [pedidos, setPedidos] = useState([]);
  const [pedidosCompletados, setPedidosCompletados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [editandoCantidad, setEditandoCantidad] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);
  // Borrón y cuenta nueva (admin): { total, solicitudes_a_cancelar, tickets } o null
  const [anulacionMasiva, setAnulacionMasiva] = useState(null);
  const [anulandoTodo, setAnulandoTodo] = useState(false);
  // Rediseño 2: la vista nueva enseña el error de carga con «Reintentar» (el aviso flotante de siempre no cambia)
  const [errorPendientesR2, setErrorPendientesR2] = useState(null);
  const [errorCompletadosR2, setErrorCompletadosR2] = useState(null);
  // A6 · PLA-05: tickets que quedaron abiertos al cerrar su obra (solo existen con CIERRE_OBRA_RESPETA_ENTREGADO).
  // Sin ellos no se muestra nada nuevo: la pantalla queda igual que siempre.
  const [soloPorRevisar, setSoloPorRevisar] = useState(false);
  const porRevisar = pedidos.filter((p) => p.revision_requerida);
  const pedidosALaVista = soloPorRevisar && porRevisar.length > 0 ? porRevisar : pedidos;

  const abrirAnulacionMasiva = async (reabrir = false) => {
    try {
      setAnulandoTodo(true);
      const res = reabrir
        ? await pedidosService.previewReabrirAnulacion()
        : await pedidosService.previewAnulacionMasiva();
      if (!res.data?.total) {
        toast(reabrir ? 'No hay tickets anulados de proyectos abiertos' : 'No hay tickets abiertos que anular');
        return;
      }
      setAnulacionMasiva({ ...res.data, reabrir });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al obtener los tickets abiertos');
    } finally {
      setAnulandoTodo(false);
    }
  };

  const confirmarAnulacionMasiva = async () => {
    try {
      setAnulandoTodo(true);
      const ids = anulacionMasiva.tickets.map(t => t.id);
      const res = anulacionMasiva.reabrir
        ? await pedidosService.reabrirAnulacion(ids)
        : await pedidosService.ejecutarAnulacionMasiva(ids);
      toast.success(res.message || 'Listo');
      setAnulacionMasiva(null);
      await cargarDatos();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar los tickets');
    } finally {
      setAnulandoTodo(false);
    }
  };

  const handleEliminarTicket = async (pedido, e) => {
    if (e) e.stopPropagation();
    if (!(await confirmarG3({
      titulo: `¿Eliminar el ticket ${pedido.ticket_id}?`,
      aviso: 'No se puede deshacer.',
      datos: [['Ticket', pedido.ticket_id], ['Destino', pedido.ubicacionDestino?.almacen || pedido.proyecto || 'Sin especificar'], ['Artículos', String(pedido.detalles?.length || 0)]],
      pasa: ['Se revertirá el stock de sus artículos.'],
      confirmar: 'Eliminar ticket', cancelar: 'No eliminar', peligro: true,
    }))) return;
    try {
      setEliminandoId(pedido.id);
      const res = await pedidosService.eliminar(pedido.id);
      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
      toast.success(res?.message || 'Ticket eliminado');
    } catch (error) {
      console.error('Error al eliminar ticket:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el ticket');
    } finally {
      setEliminandoId(null);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      await Promise.all([cargarPedidosPendientes(), cargarPedidosCompletados()]);
      setListasCargadas(true); // PLA-13: la liga ?ticket= espera a las dos listas
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarPedidosPendientes = async () => {
    try {
      const response = await pedidosService.listarPendientes();
      setPedidos(response.data?.pedidos || []);
      setErrorPendientesR2(null);
    } catch (error) {
      setErrorPendientesR2(error);
      console.error('Error al cargar tickets pendientes:', error);
      toast.error('Error al cargar tickets pendientes');
    } finally {
      setLoading(false);
    }
  };

  const cargarPedidosCompletados = async () => {
    try {
      const response = await pedidosService.listarCompletados();
      setPedidosCompletados(response.data?.pedidos || []);
      setErrorCompletadosR2(null);
    } catch (error) {
      setErrorCompletadosR2(error);
      console.error('Error al cargar tickets completados:', error);
      toast.error('Error al cargar tickets completados');
    }
  };

  // Liga directa a un ticket (D2 · PLA-13): /pedidos-pendientes?ticket=141026-0900-01 abre su detalle. Se busca por
  // folio (o por id) entre los pendientes y los completados ya cargados; el parámetro se quita de la dirección.
  const [searchParams, setSearchParams] = useSearchParams();
  const ligaTicketAtendida = useRef(null);
  const [listasCargadas, setListasCargadas] = useState(false);
  useEffect(() => {
    const folio = (searchParams.get('ticket') || '').trim();
    if (!listasCargadas || !folio || ligaTicketAtendida.current === folio) return;
    ligaTicketAtendida.current = folio;
    const igual = (p) => String(p.ticket_id || '').toUpperCase() === folio.toUpperCase() || String(p.id) === folio;
    const pedido = pedidos.find(igual) || pedidosCompletados.find(igual);
    const resto = new URLSearchParams(searchParams);
    resto.delete('ticket');
    if (!pedido) {
      toast.error(`No se encontró el ticket ${folio} entre los pendientes`);
      setSearchParams(resto, { replace: true });
      return;
    }
    handleVerDetalle(pedido).finally(() => setSearchParams(resto, { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, listasCargadas, pedidos, pedidosCompletados]);

  const handleVerDetalle = async (pedido) => {
    try {
      setLoading(true);
      const response = await pedidosService.obtenerPorId(pedido.id);
      setPedidoSeleccionado(response.data?.pedido);
      setShowModal(true);
    } catch (error) {
      console.error('Error al cargar detalle del ticket:', error);
      toast.error('Error al cargar detalle del ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarArticulo = async (pedidoId, detalleId, dispersado) => {
    try {
      setProcesando(true);
      await pedidosService.marcarDispersado(pedidoId, detalleId, dispersado);
      toast.success(dispersado ? 'Artículo marcado como preparado' : 'Artículo desmarcado');

      const response = await pedidosService.obtenerPorId(pedidoId);
      setPedidoSeleccionado(response.data?.pedido);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al actualizar artículo:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar artículo');
    } finally {
      setProcesando(false);
    }
  };

  const handleEditarCantidad = (detalleId, cantidadActual) => {
    setEditandoCantidad({ detalleId, cantidad: cantidadActual });
  };

  const handleGuardarCantidad = async () => {
    if (!editandoCantidad || editandoCantidad.cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setProcesando(true);
      await pedidosService.actualizarCantidad(
        pedidoSeleccionado.id,
        editandoCantidad.detalleId,
        editandoCantidad.cantidad
      );
      toast.success('Cantidad actualizada exitosamente');

      const response = await pedidosService.obtenerPorId(pedidoSeleccionado.id);
      setPedidoSeleccionado(response.data?.pedido);
      setEditandoCantidad(null);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al actualizar cantidad:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar cantidad');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarArticulo = async (pedidoId, detalleId) => {
    const detalle = pedidoSeleccionado?.detalles?.find((d) => d.id === detalleId);
    if (!(await confirmarG3({
      titulo: '¿Quitar este artículo del ticket?',
      datos: [['Ticket', pedidoSeleccionado?.ticket_id || ''], ['Artículo', detalle?.articulo?.nombre || '']],
      confirmar: 'Quitar artículo', cancelar: 'No quitar', peligro: true,
    }))) return;

    try {
      setProcesando(true);
      await pedidosService.eliminarArticulo(pedidoId, detalleId);
      toast.success('Artículo eliminado del ticket');

      const response = await pedidosService.obtenerPorId(pedidoId);
      setPedidoSeleccionado(response.data?.pedido);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar artículo');
    } finally {
      setProcesando(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setPedidoSeleccionado(null);
    setEditandoCantidad(null);
  };

  const handleCompletarTicket = async () => {
    if (!pedidoSeleccionado) return;
    if (pedidoSeleccionado.progreso_dispersion !== 100) {
      toast.error('Faltan artículos por palomear');
      return;
    }
    if (!(await confirmarG3({
      titulo: `¿Marcar el ticket ${pedidoSeleccionado.ticket_id} como completado?`,
      datos: [['Ticket', pedidoSeleccionado.ticket_id], ['Destino', pedidoSeleccionado.ubicacionDestino?.almacen || pedidoSeleccionado.proyecto || 'Sin especificar'], ['Artículos', String(pedidoSeleccionado.detalles?.length || 0)]],
      pasa: ['Pasará a la columna de Completados.'],
      confirmar: 'Marcar como completado', cancelar: 'Regresar',
    }))) return;
    try {
      setProcesando(true);
      await pedidosService.entregarDirecto(pedidoSeleccionado.id);
      toast.success('Ticket completado');
      setShowModal(false);
      setPedidoSeleccionado(null);
      await cargarDatos();
    } catch (error) {
      console.error('Error al completar ticket:', error);
      // El detalle del backend se muestra tal cual: sin él, un fallo en
      // producción solo se ve como "error" y no hay por dónde empezar.
      // El manejador global del backend manda `error: {}` en producción; sin
      // este filtro el aviso terminaba en "[object Object]".
      const crudo = error.response?.data?.error;
      const detalle = typeof crudo === 'string' && crudo.trim() ? crudo : null;
      toast.error(
        error.code === 'ECONNABORTED'
          ? 'El sistema no respondió. El ticket NO se cerró, vuelve a intentarlo.'
          : [error.response?.data?.message || 'Error al completar el ticket', detalle]
              .filter(Boolean).join(': '),
        { duration: 12000 }
      );
      // Recargar para que la pantalla muestre cómo quedó de verdad el ticket.
      await cargarDatos();
    } finally {
      setProcesando(false);
    }
  };

  return (
    <VistaTicketsPendientes t={{
      esAdmin, pedidos, pedidosCompletados, loading, listasCargadas, cargarDatos,
      errorPendientes: errorPendientesR2, errorCompletados: errorCompletadosR2,
      porRevisar, soloPorRevisar, setSoloPorRevisar, pedidosALaVista,
      handleVerDetalle, handleEliminarTicket, eliminandoId,
      abrirAnulacionMasiva, anulandoTodo, anulacionMasiva, confirmarAnulacionMasiva,
      cerrarAnulacion: () => !anulandoTodo && setAnulacionMasiva(null),
      showModal, pedidoSeleccionado, handleCloseModal, procesando, obsOriginales,
      handleMarcarArticulo, handleEditarCantidad, editandoCantidad, handleGuardarCantidad, handleEliminarArticulo, handleCompletarTicket,
      cantidadMenos: () => setEditandoCantidad({
        ...editandoCantidad,
        cantidad: Math.max(1, editandoCantidad.cantidad - 1)
      }),
      cantidadMas: () => setEditandoCantidad({
        ...editandoCantidad,
        cantidad: editandoCantidad.cantidad + 1
      }),
      cantidadEscrita: (valor) => setEditandoCantidad({
        ...editandoCantidad,
        cantidad: parseInt(valor) || 1
      }),
      cancelarEdicion: () => setEditandoCantidad(null),
    }} />
  );
};

export default PedidosPendientesPage;
