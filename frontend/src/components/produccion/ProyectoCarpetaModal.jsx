// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useCallback } from 'react';
import { FolderOpen, Calendar, User, FileText, AlertCircle, Factory, Hammer } from 'lucide-react';
import CarpetaProyectoModal, { Dato } from '../carpetas/CarpetaProyectoModal';
import { obtenerCarpetaProduccion } from '../../services/produccion.service';
import { ETAPAS_CONFIG } from './constants';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import { estadoDe, tipoTrabajo } from '../../rediseno2/fundacion/vocabulario';
import { fechaExacta } from '../../rediseno2/fundacion/formato';

const rutaArchivo = (id) => `/produccion/carpeta/archivo/${id}`;

// El backend etiqueta cada archivo con su categoría; aquí solo se les pone
// nombre y orden: primero lo que se fabrica, al final los tickets.
const GRUPOS = [
  { clave: 'manufactura', titulo: 'Manufactura' },
  { clave: 'herreria', titulo: 'Herrería' },
  { clave: 'ticket', titulo: 'Tickets de almacén' }
];

const formatearFecha = (valor) => {
  if (!valor) return null;
  const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Ventana que abre almacén/calidad al dar click a un proyecto del dashboard de
 * producción: los datos del proyecto y lo que hay en su carpeta de Drive
 * (planos de manufactura, herrería y tickets de almacén).
 */
const ProyectoCarpetaModal = ({ isOpen, onClose, proyecto }) => {
  const proyectoId = proyecto?.id;
  const d3 = useDiseno3G(); // Rediseño 2: encendido, los mismos datos con las palabras del sistema (etapa, tipo, fecha)

  const cargar = useCallback(async () => {
    const respuesta = await obtenerCarpetaProduccion(proyectoId);
    return respuesta.data;
  }, [proyectoId]);

  const datosProyecto = (datos) => {
    const info = datos?.proyecto || proyecto || {};
    const etapa = d3 ? estadoDe('etapa', info.etapa_actual).texto : (ETAPAS_CONFIG[info.etapa_actual]?.nombre || info.etapa_actual);
    const fechaEntrega = d3
      ? (proyecto?._fechaInstalacion || info.fecha_limite ? fechaExacta(String(proyecto?._fechaInstalacion || info.fecha_limite).slice(0, 10)) || null : null)
      : formatearFecha(proyecto?._fechaInstalacion || info.fecha_limite);
    const tipo = d3 ? (tipoTrabajo(info.tipo_proyecto)?.texto || null) : info.tipo_proyecto;

    return (
      <>
        <Dato icono={<User size={14} />} etiqueta="Cliente" valor={info.cliente} />
        <Dato icono={<FolderOpen size={14} />} etiqueta="Tipo" valor={tipo} />
        <Dato icono={<FolderOpen size={14} />} etiqueta="Etapa" valor={etapa} />
        <Dato icono={<Calendar size={14} />} etiqueta="Entrega" valor={fechaEntrega} />
        <Dato
          icono={<Factory size={14} />}
          etiqueta="Manufactura"
          valor={info.tiene_manufactura ? (info.manufactura_completado ? 'Terminada' : 'Pendiente') : null}
        />
        <Dato
          icono={<Hammer size={14} />}
          etiqueta="Herrería"
          valor={info.tiene_herreria ? (info.herreria_completado ? 'Terminada' : 'Pendiente') : null}
        />
        {info.pausado && (
          <Dato icono={<AlertCircle size={14} />} etiqueta={d3 ? 'Pausada' : 'Pausado'} valor={info.pausado_motivo || 'Sí'} />
        )}
        <Dato icono={<FileText size={14} />} etiqueta="Notas" valor={info.descripcion} />
      </>
    );
  };

  return (
    <CarpetaProyectoModal
      isOpen={isOpen}
      onClose={onClose}
      titulo={proyecto?.nombre || ''}
      subtitulo="Producción"
      textoCargando="Abriendo carpeta de producción…"
      cargar={cargar}
      rutaArchivo={rutaArchivo}
      datosProyecto={datosProyecto}
      grupos={GRUPOS}
    />
  );
};

export default ProyectoCarpetaModal;
