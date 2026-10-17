// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useCallback } from 'react';
import { FolderOpen, Calendar, Clock, User, FileText, AlertCircle } from 'lucide-react';
import CarpetaProyectoModal, { Dato } from '../carpetas/CarpetaProyectoModal';
import { obtenerCarpetaVentas } from '../../services/calendario.service';
// Rediseño 2 (encendido): los mismos datos en palabras de la vista nueva (la carpeta y su petición no cambian)
import { useDiseno3G as useDiseno3GR2 } from '../../rediseno2/fundacion/useDiseno3G';
import { estadoDe, tipoTrabajo } from '../../rediseno2/fundacion/vocabulario';
import { nombreEquipo, oracion } from '../../rediseno2/gestion/comunes';

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
  const d3 = useDiseno3GR2();

  const cargar = useCallback(async () => {
    const respuesta = await obtenerCarpetaVentas(nombreProyecto, mes);
    return respuesta.data;
  }, [nombreProyecto, mes]);

  const datosProyecto = (datos) => {
    const info = datos?.proyecto;
    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) {
      // Rediseño 2: «16 de octubre», «Mantenimiento», «Lista para instalar», «Equipo I» y la falla con su motivo
      const tipo = info?.tipo_proyecto || proyecto?.tipoProyecto;
      const falla = proyecto?.equipoHora === 'FALLA';
      return (
        <>
          <Dato etiqueta="Entrega" valor={dia && mes ? `${dia} de ${String(mes).toLowerCase()}` : null} />
          <Dato etiqueta="Hora" valor={proyecto?.hora} />
          <Dato etiqueta="Cliente" valor={info?.cliente || proyecto?.cliente} />
          <Dato etiqueta="Tipo" valor={tipo ? (tipoTrabajo(tipo)?.texto === String(tipo).trim() ? oracion(tipo) : tipoTrabajo(tipo)?.texto) : null} />
          <Dato etiqueta="Etapa" valor={info?.etapa_actual ? estadoDe('etapa', info.etapa_actual).texto : null} />
          <Dato etiqueta="Equipo" valor={falla ? 'Falla' : (proyecto?.equipoHora ? nombreEquipo(proyecto.equipoHora) : null)} />
          {proyecto?.nota && <Dato etiqueta={falla ? 'Motivo de la falla' : 'Nota del calendario'} valor={proyecto.nota} />}
          {info?.pausado && <Dato etiqueta="Pausada" valor={info.pausado_motivo || 'Sí'} />}
          <Dato etiqueta="Notas" valor={info?.descripcion} />
        </>
      );
    }
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
