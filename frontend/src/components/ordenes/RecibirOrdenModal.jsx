import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { Cajon as CajonR2, CajonCabecera as CajonCabeceraR2 } from '../../rediseno2/fundacion';
import RecibirManoR2 from '../../rediseno2/compras/RecibirMano';

const formatCantidad = (n) => {
  const v = parseFloat(n) || 0;
  return Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
};

// Mismas claves que MOTIVOS_FALTANTE del backend
const MOTIVOS_FALTANTE = [
  { valor: 'incompleto', texto: 'Llegó incompleto (el proveedor no surtió todo)' },
  { valor: 'calidad', texto: 'Se regresó por calidad' },
  { valor: 'danado', texto: 'Llegó dañado' },
  { valor: 'equivocado', texto: 'Llegó otro producto / equivocado' },
  { valor: 'otro', texto: 'Otro' }
];

const RecibirOrdenModal = ({ isOpen, onClose, orden, onSuccess, incrustado = false, alPie = null, alOcupado = null }) => {
  const [articulos, setArticulos] = useState([]);
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [mostrarModalCompletar, setMostrarModalCompletar] = useState(false);
  const [motivoCompletar, setMotivoCompletar] = useState('');
  // Motivo por SKU que quedó corto: { [detalle_id]: 'incompleto' | 'calidad' | ... }
  const [motivosFaltante, setMotivosFaltante] = useState({});
  const [completando, setCompletando] = useState(false);
  // Rediseño 2: avisa al cajón «Recibir» que se está registrando, para que no se cierre a medias (hoy tampoco se puede)
  useEffect(() => {
    if (!alOcupado) return undefined;
    alOcupado(guardando || completando);
    return () => alOcupado(false); // al cerrarse (también tras registrar) el cajón queda libre
  }, [alOcupado, guardando, completando]);
  const inputsCantidad = useRef({});

  useEffect(() => {
    if (isOpen && orden) {
      // Cada renglón arranca sin palomear: el almacén confirma lo que sí llegó.
      // modo: 'pendiente' (no llegó) | 'completo' (llegó lo pendiente) | 'otra' (cantidad a mano)
      const articulosIniciales = orden.detalles.map(detalle => ({
        detalle_id: detalle.id,
        articulo_id: detalle.articulo.id,
        nombre: detalle.articulo.nombre,
        unidad: detalle.articulo.unidad,
        imagen_url: detalle.articulo.imagen_url,
        cantidad_solicitada: parseFloat(detalle.cantidad_solicitada),
        cantidad_ya_recibida: parseFloat(detalle.cantidad_recibida) || 0,
        cantidad_pendiente: parseFloat(detalle.cantidad_solicitada) - (parseFloat(detalle.cantidad_recibida) || 0),
        cantidad_recibida: '',
        modo: 'pendiente',
        observaciones: '',
        mostrarNota: false
      }));
      setArticulos(articulosIniciales);
      setObservacionesGenerales('');
      setErrores({});
    }
  }, [isOpen, orden]);

  const actualizarArticulo = (detalleId, cambios) => {
    setArticulos(prev => prev.map(art =>
      art.detalle_id === detalleId ? { ...art, ...cambios } : art
    ));
  };

  const limpiarError = (detalleId) => {
    setErrores(prev => {
      if (!prev[detalleId]) return prev;
      const nuevos = { ...prev };
      delete nuevos[detalleId];
      return nuevos;
    });
  };

  // Palomear = llegó completo lo que faltaba de ese artículo
  const marcarCompleto = (articulo) => {
    if (articulo.cantidad_pendiente <= 0) return;
    actualizarArticulo(articulo.detalle_id, {
      modo: 'completo',
      cantidad_recibida: articulo.cantidad_pendiente
    });
    limpiarError(articulo.detalle_id);
  };

  const togglePalomear = (articulo) => {
    if (articulo.cantidad_pendiente <= 0) return;

    if (articulo.modo === 'pendiente') {
      marcarCompleto(articulo);
    } else {
      actualizarArticulo(articulo.detalle_id, { modo: 'pendiente', cantidad_recibida: '' });
      limpiarError(articulo.detalle_id);
    }
  };

  // Llegó una cantidad distinta: ahí sí se escribe a mano
  const activarOtraCantidad = (articulo) => {
    if (articulo.cantidad_pendiente <= 0) return;
    actualizarArticulo(articulo.detalle_id, { modo: 'otra', cantidad_recibida: '' });
    limpiarError(articulo.detalle_id);
    setTimeout(() => inputsCantidad.current[articulo.detalle_id]?.focus(), 0);
  };

  const handleCantidadChange = (articulo, valor) => {
    const valorNumerico = parseFloat(valor);

    if (valor !== '' && !isNaN(valorNumerico)) {
      if (valorNumerico > articulo.cantidad_pendiente) {
        setErrores(prev => ({
          ...prev,
          [articulo.detalle_id]: `Máximo permitido: ${formatCantidad(articulo.cantidad_pendiente)} ${articulo.unidad}`
        }));
      } else if (valorNumerico < 0) {
        setErrores(prev => ({ ...prev, [articulo.detalle_id]: 'La cantidad debe ser mayor a 0' }));
      } else {
        limpiarError(articulo.detalle_id);
      }
    } else {
      limpiarError(articulo.detalle_id);
    }

    actualizarArticulo(articulo.detalle_id, { cantidad_recibida: valor });
  };

  const recibiblesIds = articulos.filter(a => a.cantidad_pendiente > 0).map(a => a.detalle_id);
  const palomeados = articulos.filter(a => a.cantidad_pendiente > 0 && a.modo !== 'pendiente');
  const todoPalomeado = recibiblesIds.length > 0 && palomeados.length === recibiblesIds.length;

  // Recepción masiva: un clic marca toda la orden como recibida completa
  const togglePalomearTodo = () => {
    if (todoPalomeado) {
      setArticulos(prev => prev.map(art =>
        art.cantidad_pendiente > 0 ? { ...art, modo: 'pendiente', cantidad_recibida: '' } : art
      ));
      setErrores({});
      return;
    }

    setArticulos(prev => prev.map(art =>
      art.cantidad_pendiente > 0
        ? { ...art, modo: 'completo', cantidad_recibida: art.cantidad_pendiente }
        : art
    ));
    setErrores({});
  };

  const handleObservacionChange = (detalleId, valor) => {
    actualizarArticulo(detalleId, { observaciones: valor });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Solo entra lo que se palomeó (o lo que se capturó con otra cantidad)
    const articulosConRecepcion = articulos.filter(art =>
      art.modo !== 'pendiente' && parseFloat(art.cantidad_recibida) > 0
    );

    if (articulosConRecepcion.length === 0) {
      toast.error('Palomea al menos un artículo para registrar la recepción');
      return;
    }

    if (Object.keys(errores).length > 0) {
      toast.error('Corrige los errores antes de continuar');
      return;
    }

    try {
      setGuardando(true);

      const data = {
        articulos: articulosConRecepcion.map(art => ({
          detalle_id: art.detalle_id,
          cantidad_recibida: parseFloat(art.cantidad_recibida),
          observaciones: art.observaciones || null
        })),
        observaciones_generales: observacionesGenerales || null,
        // Recepción contada a mano: no deja la orden pendiente de volver a contar
        origen: 'manual'
      };

      const response = await ordenesCompraService.recibirMercancia(orden.id, data);

      toast.success(response.message || 'Recepción registrada exitosamente');

      if (onSuccess) {
        onSuccess(response.data);
      }

      onClose();
    } catch (error) {
      console.error('Error al recibir mercancía:', error);

      if (error.response?.data?.errores) {
        // Mostrar errores de validación del backend
        error.response.data.errores.forEach(err => toast.error(err));
      } else {
        toast.error(error.response?.data?.message || 'Error al recibir mercancía');
      }
    } finally {
      setGuardando(false);
    }
  };

  const calcularProgreso = () => {
    const totalSolicitado = articulos.reduce((sum, art) => sum + art.cantidad_solicitada, 0);
    const totalYaRecibido = articulos.reduce((sum, art) => sum + art.cantidad_ya_recibida, 0);
    const totalAhoraRecibido = articulos.reduce((sum, art) => {
      const cantidad = parseFloat(art.cantidad_recibida) || 0;
      return sum + cantidad;
    }, 0);

    const totalRecibido = totalYaRecibido + totalAhoraRecibido;
    const porcentaje = totalSolicitado > 0 ? Math.round((totalRecibido / totalSolicitado) * 100) : 0;

    return {
      porcentaje,
      totalSolicitado,
      totalYaRecibido,
      totalAhoraRecibido,
      totalRecibido
    };
  };

  // Lo que se capturó en pantalla (paloma u otra cantidad), listo para mandar
  const articulosCapturados = () => articulos.filter(art =>
    art.modo !== 'pendiente' && parseFloat(art.cantidad_recibida) > 0
  );

  // Cómo queda cada renglón si se cierra ahora con lo capturado
  const faltantesAlCerrar = articulos
    .map(art => {
      const ahora = art.modo !== 'pendiente' ? (parseFloat(art.cantidad_recibida) || 0) : 0;
      const recibido = art.cantidad_ya_recibida + ahora;
      return { ...art, recibido_total: recibido, faltante: Math.max(0, art.cantidad_solicitada - recibido) };
    })
    .filter(art => art.faltante > 0);

  const abrirCerrarIncompleta = () => {
    if (Object.keys(errores).length > 0) {
      toast.error('Corrige las cantidades antes de cerrar');
      return;
    }
    // Por defecto: llegó incompleto
    const iniciales = {};
    faltantesAlCerrar.forEach(f => { iniciales[f.detalle_id] = motivosFaltante[f.detalle_id] || 'incompleto'; });
    setMotivosFaltante(iniciales);
    setMostrarModalCompletar(true);
  };

  const handleCompletarManualmente = async () => {
    const requiereComentario = faltantesAlCerrar.some(f => motivosFaltante[f.detalle_id] === 'otro');
    if (requiereComentario && motivoCompletar.trim().length < 5) {
      toast.error('Explica en el comentario qué pasó con lo marcado como "Otro"');
      return;
    }

    try {
      setCompletando(true);

      // 1) Registrar lo que sí llegó (entra al stock)
      const capturados = articulosCapturados();
      let respuestaRecepcion = null;
      if (capturados.length > 0) {
        respuestaRecepcion = await ordenesCompraService.recibirMercancia(orden.id, {
          articulos: capturados.map(art => ({
            detalle_id: art.detalle_id,
            cantidad_recibida: parseFloat(art.cantidad_recibida),
            observaciones: art.observaciones || null
          })),
          observaciones_generales: observacionesGenerales || null,
          origen: 'manual'
        });
      }

      // Si con eso ya se completó todo, no hay nada que cerrar
      if (faltantesAlCerrar.length === 0) {
        toast.success('Recepción registrada: la orden quedó completa');
        if (onSuccess) onSuccess(respuestaRecepcion?.data);
        setMostrarModalCompletar(false);
        onClose();
        return;
      }

      // 2) Cerrar con el motivo de cada faltante
      try {
        const faltantes = {};
        faltantesAlCerrar.forEach(f => { faltantes[f.detalle_id] = motivosFaltante[f.detalle_id]; });
        const response = await ordenesCompraService.completarManualmente(orden.id, {
          faltantes,
          comentario: motivoCompletar.trim() || null
        });
        toast.success(response.message || 'Orden cerrada', { duration: 5000 });
        if (onSuccess) onSuccess(response.data);
      } catch (error) {
        // La recepción ya quedó guardada; solo falta cerrar (se puede reintentar)
        if (capturados.length > 0 && onSuccess) onSuccess(respuestaRecepcion?.data);
        toast.error(`${capturados.length > 0 ? 'La recepción se guardó, pero la orden no se cerró: ' : ''}${error.response?.data?.message || 'Error al cerrar la orden'}`, { duration: 6000 });
        return;
      }

      setMostrarModalCompletar(false);
      setMotivoCompletar('');
      onClose();
    } catch (error) {
      console.error('Error al cerrar orden:', error);
      if (error.response?.data?.errores) {
        error.response.data.errores.forEach(err => toast.error(err));
      } else {
        toast.error(error.response?.data?.message || 'Error al registrar la recepción');
      }
    } finally {
      setCompletando(false);
    }
  };

  const hayArticulosPendientes = articulos.some(art => art.cantidad_pendiente > 0);

  const progreso = calcularProgreso();

  if (!isOpen) return null;

  const contenidoR2 = (
    <RecibirManoR2
      articulos={articulos}
      observacionesGenerales={observacionesGenerales}
      setObservacionesGenerales={setObservacionesGenerales}
      guardando={guardando}
      errores={errores}
      togglePalomear={togglePalomear}
      marcarCompleto={marcarCompleto}
      activarOtraCantidad={activarOtraCantidad}
      handleCantidadChange={handleCantidadChange}
      handleObservacionChange={handleObservacionChange}
      actualizarArticulo={actualizarArticulo}
      togglePalomearTodo={togglePalomearTodo}
      todoPalomeado={todoPalomeado}
      palomeados={palomeados}
      recibiblesIds={recibiblesIds}
      hayArticulosPendientes={hayArticulosPendientes}
      progreso={progreso}
      handleSubmit={handleSubmit}
      onClose={onClose}
      abrirCerrarIncompleta={abrirCerrarIncompleta}
      inputsCantidad={inputsCantidad}
      alPie={alPie}
      mostrarModalCompletar={mostrarModalCompletar}
      cerrarDialogoCompletar={() => {
        setMostrarModalCompletar(false);
        setMotivoCompletar('');
      }}
      faltantesAlCerrar={faltantesAlCerrar}
      motivosFaltante={motivosFaltante}
      setMotivosFaltante={setMotivosFaltante}
      motivoCompletar={motivoCompletar}
      setMotivoCompletar={setMotivoCompletar}
      completando={completando}
      handleCompletarManualmente={handleCompletarManualmente}
      motivos={MOTIVOS_FALTANTE}
    />
  );
  if (incrustado) return contenidoR2;
  return (
    <CajonR2 abierto alCerrar={guardando ? () => {} : onClose} ancho="ancho" etiqueta={`Recibir ${orden?.ticket_id || ''}`}>
      <CajonCabeceraR2 titulo={`Recibir ${orden?.ticket_id || ''}`} dato={orden?.proveedor?.nombre} alCerrar={guardando ? undefined : onClose} />
      {contenidoR2}
    </CajonR2>
  );
};

export default RecibirOrdenModal;
