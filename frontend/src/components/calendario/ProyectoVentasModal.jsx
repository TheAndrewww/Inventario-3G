import React, { useCallback } from 'react';
import { FolderOpen, Calendar, Clock, User, FileText, AlertCircle } from 'lucide-react';
import CarpetaProyectoModal, { Dato } from '../carpetas/CarpetaProyectoModal';
import { obtenerCarpetaVentas } from '../../services/calendario.service';

const ETAPAS = {
  pendiente: 'Pendiente',
  diseno: 'Diseño',
  compras: 'Compras',
  produccion: 'Producción',
  instalacion: 'Instalación',
  completado: 'Completado'
};

const rutaArchivo = (id) => `/calendario/proyecto/ventas/archivo/${id}`;

/**
 * Ventana que abre almacén/calidad al dar click a un proyecto del calendario:
 * los datos del proyecto y los archivos que ventas dejó en Drive.
 * El pedido, los documentos con importes y los formatos de cierre (garantía,
 * control de calidad, check) los filtra el backend.
 */
const ProyectoVentasModal = ({ isOpen, onClose, proyecto, mes, dia }) => {
  const nombreProyecto = proyecto?.nombre || '';

  const cargar = useCallback(async () => {
    const respuesta = await obtenerCarpetaVentas(nombreProyecto, mes);
    return respuesta.data;
  }, [nombreProyecto, mes]);

  const datosProyecto = (datos) => {
    const info = datos?.proyecto;
    return (
      <>
        <Dato icono={<Calendar size={14} />} etiqueta="Entrega" valor={dia && mes ? `${dia} de ${mes}` : null} />
        <Dato icono={<Clock size={14} />} etiqueta="Hora" valor={proyecto?.hora} />
        <Dato icono={<User size={14} />} etiqueta="Cliente" valor={info?.cliente || proyecto?.cliente} />
        <Dato icono={<FolderOpen size={14} />} etiqueta="Tipo" valor={info?.tipo_proyecto || proyecto?.tipoProyecto} />
        <Dato
          icono={<FolderOpen size={14} />}
          etiqueta="Etapa"
          valor={info?.etapa_actual ? (ETAPAS[info.etapa_actual] || info.etapa_actual) : null}
        />
        <Dato icono={<User size={14} />} etiqueta="Equipo" valor={proyecto?.equipoHora} />
        {info?.pausado && (
          <Dato icono={<AlertCircle size={14} />} etiqueta="Pausado" valor={info.pausado_motivo || 'Sí'} />
        )}
        <Dato icono={<FileText size={14} />} etiqueta="Notas" valor={info?.descripcion} />
      </>
    );
  };

  return (
    <CarpetaProyectoModal
      isOpen={isOpen}
      onClose={onClose}
      titulo={nombreProyecto}
      subtitulo="Ventas"
      textoCargando="Abriendo carpeta de ventas…"
      cargar={cargar}
      rutaArchivo={rutaArchivo}
      datosProyecto={datosProyecto}
    />
  );
};

export default ProyectoVentasModal;
