import React, { useCallback } from 'react';
import { FolderOpen, Calendar, User, FileText, AlertCircle, Factory, Hammer } from 'lucide-react';
import CarpetaProyectoModal, { Dato } from '../carpetas/CarpetaProyectoModal';
import { obtenerCarpetaProduccion } from '../../services/produccion.service';
import { estadoDe, tipoTrabajo } from '../../rediseno2/fundacion/vocabulario';
import { fechaExacta } from '../../rediseno2/fundacion/formato';
import { SeccionCalidadObra } from '../../rediseno2/calidad/SeccionCalidadObra';

const rutaArchivo = (id) => `/produccion/carpeta/archivo/${id}`;

// El backend etiqueta cada archivo con su categoría; aquí solo se les pone
// nombre y orden: primero lo que se fabrica, al final los tickets.
const GRUPOS = [
  { clave: 'manufactura', titulo: 'Manufactura' },
  { clave: 'herreria', titulo: 'Herrería' },
  { clave: 'ticket', titulo: 'Tickets de almacén' }
];

/**
 * Ventana que abre almacén/calidad al dar click a un proyecto del dashboard de
 * producción: los datos del proyecto y lo que hay en su carpeta de Drive
 * (planos de manufactura, herrería y tickets de almacén).
 */
const ProyectoCarpetaModal = ({ isOpen, onClose, proyecto }) => {
  const proyectoId = proyecto?.id;

  const cargar = useCallback(async () => {
    const respuesta = await obtenerCarpetaProduccion(proyectoId);
    return respuesta.data;
  }, [proyectoId]);

  const datosProyecto = (datos) => {
    const info = datos?.proyecto || proyecto || {};
    const etapa = estadoDe('etapa', info.etapa_actual).texto;
    const fechaEntrega = (proyecto?._fechaInstalacion || info.fecha_limite ? fechaExacta(String(proyecto?._fechaInstalacion || info.fecha_limite).slice(0, 10)) || null : null);
    const tipo = (tipoTrabajo(info.tipo_proyecto)?.texto || null);

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
          <Dato icono={<AlertCircle size={14} />} etiqueta={'Pausada'} valor={info.pausado_motivo || 'Sí'} />
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
      // 28-oct · la hoja de calidad de la obra, de solo lectura (solo con PANEL_CALIDAD y para administración y almacén)
      extra={proyectoId ? <SeccionCalidadObra proyectoId={proyectoId} /> : null}
    />
  );
};

export default ProyectoCarpetaModal;
