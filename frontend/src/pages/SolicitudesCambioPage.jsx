import React, { useState, useEffect } from 'react';
import solicitudesCambioService from '../services/solicitudesCambio.service';
import ubicacionesService from '../services/ubicaciones.service';
import configuracionService from '../services/configuracion.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { confirmarG3, pedirTextoG3 } from '../diseno-3g/dialogosG3';
import VistaSolicitudesCambio from '../rediseno2/inventario/VistaSolicitudesCambio';

const TIPO_LABEL = {
  cambio_ubicacion: 'Cambio de ubicación',
  entrada_stock: 'Entrada de stock',
  salida_stock: 'Salida de stock',
  crear_articulo: 'Crear artículo',
  desactivar_articulo: 'Desactivar artículo',
  reactivar_articulo: 'Reactivar artículo'
};

const SolicitudesCambioPage = () => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';
  const esCompras = user?.rol === 'compras';
  // Quién puede resolver una solicitud: admin todas; compras solo reactivaciones.
  const puedeResolver = (s) => esAdmin || (esCompras && s.tipo === 'reactivar_articulo');

  const [solicitudes, setSolicitudes] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [tabActivo, setTabActivo] = useState('pendiente');
  const [loading, setLoading] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [ajusteDirecto, setAjusteDirecto] = useState(false);
  const [cambiandoAjuste, setCambiandoAjuste] = useState(false);
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de carga para la vista nueva (el aviso de siempre no cambia)

  const cargar = async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) setLoading(true);
      const [resSol, resUb] = await Promise.all([
        solicitudesCambioService.listar(),
        ubicacionesService.getAll().catch(() => [])
      ]);
      setSolicitudes(resSol?.data?.solicitudes || []);
      setUbicaciones(Array.isArray(resUb) ? resUb : []);
      setErrorCargaR2(null);
    } catch (e) {
      console.error(e);
      if (!silent) setErrorCargaR2(e?.response?.data?.message || e?.message || 'Error al cargar solicitudes');
      if (!silent) toast.error('Error al cargar solicitudes');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Cargar estado del interruptor de ajuste directo (solo lo gestiona el admin)
  useEffect(() => {
    if (!esAdmin) return;
    configuracionService.obtener()
      .then(res => setAjusteDirecto(!!res?.data?.almacen_ajuste_directo))
      .catch(() => {});
  }, [esAdmin]);

  const toggleAjusteDirecto = async () => {
    const nuevo = !ajusteDirecto;
    if (nuevo) {
      if (!(await confirmarG3({
        titulo: '¿Activar el ajuste directo?',
        aviso: 'Almacén podrá registrar entradas y salidas de stock sin tu aprobación.',
        pasa: ['Las entradas y salidas que registre Almacén se aplican al momento y quedan aquí como aprobadas.', 'Lo puedes desactivar con este mismo interruptor.'],
        confirmar: 'Activar ajuste directo', cancelar: 'No activar',
      }))) return;
    }
    try {
      setCambiandoAjuste(true);
      const res = await configuracionService.setAjusteDirecto(nuevo);
      setAjusteDirecto(!!res?.data?.almacen_ajuste_directo);
      toast.success(res?.message || (nuevo ? 'Ajuste directo activado' : 'Ajuste directo desactivado'));
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'No se pudo cambiar la configuración');
    } finally {
      setCambiandoAjuste(false);
    }
  };

  // Auto-refresh: cada 20s y al volver a la pestaña.
  // Admin ve nuevas solicitudes y almacén ve resoluciones sin recargar.
  // Silencioso — no parpadea ni rompe scroll.
  useEffect(() => {
    const refrescar = () => cargar({ silent: true });
    const interval = setInterval(refrescar, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') refrescar(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refrescar);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refrescar);
    };
  }, []);

  const aprobar = async (id) => {
    // Vista previa armada solo con la solicitud que ya está en pantalla (sin pedir nada al servidor)
    const s = solicitudes.find(x => x.id === id);
    if (!(await confirmarG3({
      titulo: '¿Aprobar esta solicitud?',
      aviso: 'El cambio se aplicará inmediatamente.',
      datos: s ? [
        ['Tipo', TIPO_LABEL[s.tipo] || s.tipo],
        ...(s.articulo ? [['Artículo', s.articulo.nombre]] : []),
        ['Cambio', describirCambio(s)],
        ['Solicitado por', s.solicitante?.nombre || '?'],
      ] : [],
      confirmar: 'Aprobar y aplicar', cancelar: 'Regresar',
    }))) return;
    try {
      setProcesandoId(id);
      const res = await solicitudesCambioService.aprobar(id);
      const actualizada = res?.data?.solicitud;
      // Actualización local — sin refetch ni perder scroll
      setSolicitudes(prev => prev.map(s => s.id === id ? (actualizada || { ...s, estado: 'aprobada' }) : s));
      toast.success('Solicitud aprobada y aplicada');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Error al aprobar');
    } finally {
      setProcesandoId(null);
    }
  };

  const rechazar = async (id) => {
    // Diseño 3G encendido: cajón con el mismo campo (devuelve lo mismo que prompt(): el texto o null); la validación de
    // abajo es la de siempre. Los datos del cajón salen de la solicitud que ya está en pantalla.
    let motivo;
    const s = solicitudes.find(x => x.id === id);
    motivo = await pedirTextoG3({
      titulo: 'Rechazar solicitud',
      datos: s ? [
        ['Tipo', TIPO_LABEL[s.tipo] || s.tipo],
        ...(s.articulo ? [['Artículo', s.articulo.nombre]] : []),
        ['Solicitado por', s.solicitante?.nombre || '?'],
      ] : [],
      etiqueta: 'Motivo del rechazo',
      ayuda: 'Será notificado al solicitante.',
      confirmar: 'Rechazar solicitud', cancelar: 'Regresar', peligro: true,
    });
    if (!motivo || !motivo.trim()) return;
    try {
      setProcesandoId(id);
      const res = await solicitudesCambioService.rechazar(id, motivo.trim());
      const actualizada = res?.data?.solicitud;
      setSolicitudes(prev => prev.map(s => s.id === id ? (actualizada || { ...s, estado: 'rechazada', motivo_rechazo: motivo.trim() }) : s));
      toast.success('Solicitud rechazada y solicitante notificado');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Error al rechazar');
    } finally {
      setProcesandoId(null);
    }
  };

  const filtradas = solicitudes.filter(s => s.estado === tabActivo);

  const describirCambio = (s) => {
    switch (s.tipo) {
      case 'cambio_ubicacion': {
        const idAnt = s.snapshot?.ubicacion_id;
        const idNue = s.payload?.ubicacion_id;
        const nomAnt = ubicaciones.find(u => u.id === idAnt)?.codigo || idAnt || 'Sin asignar';
        const nomNue = ubicaciones.find(u => u.id === idNue)?.codigo || idNue || 'Sin asignar';
        return `${nomAnt} → ${nomNue}`;
      }
      case 'entrada_stock':
        return `+${s.payload?.cantidad} (stock actual: ${s.snapshot?.stock_actual ?? '?'})`;
      case 'salida_stock':
        return `−${s.payload?.cantidad} (stock actual: ${s.snapshot?.stock_actual ?? '?'})`;
      case 'crear_articulo':
        return `Nombre: ${s.payload?.nombre || ''}`;
      case 'desactivar_articulo':
        return 'Desactivar artículo';
      case 'reactivar_articulo':
        return 'Reactivar artículo';
      default:
        return '';
    }
  };

  return (
    <VistaSolicitudesCambio s={{
      esAdmin, esCompras, puedeResolver, solicitudes, filtradas, tabActivo, setTabActivo, loading, procesandoId,
      ajusteDirecto, cambiandoAjuste, toggleAjusteDirecto, cargar, aprobar, rechazar, describirCambio, TIPO_LABEL, errorCargaR2,
    }} />
  );
};

export default SolicitudesCambioPage;
