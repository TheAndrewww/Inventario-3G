// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useCallback } from 'react';
import { FolderOpen, Calendar, Clock, User, FileText, AlertCircle } from 'lucide-react';
import CarpetaProyectoModal, { Dato } from '../carpetas/CarpetaProyectoModal';
import { obtenerCarpetaVentas } from '../../services/calendario.service';
import { obtenerCarpetaProduccion } from '../../services/produccion.service';
// Rediseño 2 (encendido): los mismos datos en palabras de la vista nueva (la carpeta y su petición no cambian)
import { useDiseno3G as useDiseno3GR2 } from '../../rediseno2/fundacion/useDiseno3G';
import { estadoDe, tipoTrabajo } from '../../rediseno2/fundacion/vocabulario';
import { nombreEquipo, oracion } from '../../rediseno2/gestion/comunes';
import { fechaExacta } from '../../rediseno2/fundacion/formato';

const ETAPAS = {
  pendiente: 'Pendiente',
  diseno: 'Diseño',
  compras: 'Compras',
  produccion: 'Producción',
  instalacion: 'Instalación',
  completado: 'Completado'
};

// Cada archivo se pide por la ruta de su carpeta: ventas o producción
const rutaArchivo = (id, archivo) => (archivo?._origen === 'produccion'
  ? `/produccion/carpeta/archivo/${id}`
  : `/calendario/proyecto/ventas/archivo/${id}`);

// Ventas arriba; luego lo de producción por área (las categorías las pone el backend de producción)
const GRUPOS = [
  { clave: 'ventas', titulo: 'Ventas' },
  { clave: 'manufactura', titulo: 'Producción · Manufactura' },
  { clave: 'herreria', titulo: 'Producción · Herrería' },
  { clave: 'ticket', titulo: 'Producción · Tickets de almacén' }
];

const estadoArea = (tiene, hecho) => (tiene ? (hecho ? 'Terminada' : 'Pendiente') : null);
const fechaDe = (v) => (v ? fechaExacta(String(v).slice(0, 10)) || null : null);

/**
 * Ventana que abre almacén/calidad al dar click a un proyecto del calendario:
 * los datos del proyecto y los archivos que ventas dejó en Drive.
 * El pedido, los documentos con importes y los formatos de cierre (garantía,
 * control de calidad, check) los filtra el backend.
 */
const ProyectoVentasModal = ({ isOpen, onClose, proyecto, mes, dia }) => {
  const nombreProyecto = proyecto?.nombre || '';
  const d3 = useDiseno3GR2();

  // Ventas (carpeta de Drive + el proyecto de producción que le corresponde) y, con ese proyecto, su carpeta de
  // producción (planos de manufactura y herrería, tickets). Producción solo la ven administración, almacén y diseño: a los
  // demás el servidor la niega y la ventana se queda con ventas.
  const cargar = useCallback(async () => {
    const respuesta = await obtenerCarpetaVentas(nombreProyecto, mes);
    const ventas = respuesta.data || {};
    const archivos = (ventas.archivos || []).map((a) => ({ ...a, categoria: 'ventas', _origen: 'ventas' }));
    let produccion = null;
    if (ventas.proyecto?.id) {
      try {
        produccion = (await obtenerCarpetaProduccion(ventas.proyecto.id))?.data || null;
      } catch {
        produccion = null;
      }
    }
    const deProduccion = (produccion?.archivos || []).map((a) => ({ ...a, _origen: 'produccion' }));
    return {
      ...ventas,
      carpeta: ventas.carpeta || produccion?.carpeta || null,
      archivos: [...archivos, ...deProduccion],
      ocultos: (ventas.ocultos || 0) + (produccion?.ocultos || 0),
      carpetaProduccion: produccion?.carpeta || null
    };
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
          {/* Producción del mismo proyecto (cruzado por nombre en el servidor) */}
          {info && <Dato etiqueta="Proyecto en producción" valor={info.nombre} />}
          <Dato etiqueta="Entró a producción" valor={fechaDe(info?.fecha_entrada)} />
          <Dato etiqueta="Fecha máxima" valor={fechaDe(info?.fecha_limite)} />
          <Dato etiqueta="Manufactura" valor={estadoArea(info?.tiene_manufactura, info?.manufactura_completado)} />
          <Dato etiqueta="Soldadura" valor={estadoArea(info?.tiene_herreria, info?.herreria_completado || info?.herreria_armado_completado)} />
          <Dato etiqueta="Pintura" valor={estadoArea(info?.tiene_herreria, info?.herreria_completado || info?.herreria_pintado_completado)} />
          <Dato etiqueta="Notas" valor={info?.descripcion} />
          {datos && !info && <Dato etiqueta="Producción" valor="No se encontró este proyecto en producción" />}
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
      subtitulo={d3 ? 'Ventas y producción' : 'Ventas'}
      textoCargando="Abriendo ventas y producción…"
      cargar={cargar}
      rutaArchivo={rutaArchivo}
      datosProyecto={datosProyecto}
      grupos={d3 ? GRUPOS : undefined}
    />
  );
};

export default ProyectoVentasModal;
