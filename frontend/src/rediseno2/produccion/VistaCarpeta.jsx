// Rediseño 2 · Producción · carpeta de una obra en un cajón ancho (CarpetaProyectoModal encendido).
// La usan el Tablero (carpeta de producción: planos de manufactura, herrería y tickets) y el Calendario (carpeta de
// ventas). Antes: diálogo negro centrado con datos en 11 px MAYÚSCULAS. Ahora: cajón lateral con los datos arriba y los
// archivos por grupo. TODO lo de adentro sale de CarpetaProyectoModal: misma carga al abrir, mismo «Reintentar», mismas
// miniaturas y visor (las mismas peticiones de cada archivo), y Esc cierra el visor primero, como hoy.
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderOpen, Lock } from 'lucide-react';
import { useCapa } from '../fundacion/useCapa';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { SeccionCajon } from '../fundacion/piezas/Cajon';
import { plural } from '../fundacion/formato';
import './produccion.css';

export default function VistaCarpeta({
  titulo, subtitulo, textoCargando, cargando, error, datos, archivoAbierto, ejecutar, onClose, datosProyecto, grupos, secciones,
  archivos, pintarMiniatura, pintarVisor, extra = null,
}) {
  const ref = useRef(null);
  // Esc lo atiende la carpeta de siempre (cierra primero el visor); aquí solo el foco, Tab y el orden de capas
  useCapa({ abierta: true, ref, alCerrar: (motivo) => { if (motivo !== 'esc') onClose(); } });
  const ruta = datos?.carpeta?.ruta ? `${subtitulo} / ${datos.carpeta.ruta}` : subtitulo;

  let cuerpo;
  if (cargando) {
    cuerpo = <Cargando forma="ficha" filas={6} etiqueta={textoCargando} />;
  } else if (error) {
    cuerpo = <>{extra}<ErrorCarga mensaje="No se pudo leer la carpeta." motivo={error} alReintentar={ejecutar} /></>;
  } else if (archivoAbierto) {
    cuerpo = pintarVisor();
  } else {
    cuerpo = (
      <>
        {datosProyecto && (
          <SeccionCajon titulo="Datos de la obra">
            <dl className="r2-datos r2-datos--dos r2-prod-carpeta-datos">
              {typeof datosProyecto === 'function' ? datosProyecto(datos) : datosProyecto}
            </dl>
          </SeccionCajon>
        )}
        {/* 28-oct · lo propio de quien abre (Producción: «Calidad», solo con PANEL_CALIDAD; apagado no pinta nada) */}
        {extra}
        {!datos?.carpeta ? (
          <Vacio icono={FolderOpen} titulo="Sin carpeta" texto={datos?.mensaje || 'Todavía no hay carpeta para este proyecto'} compacto />
        ) : archivos.length === 0 ? (
          <Vacio icono={FolderOpen} titulo="Carpeta vacía" texto="La carpeta no tiene archivos que puedas ver" compacto />
        ) : (
          secciones.map((s) => (
            <SeccionCajon key={s.titulo} titulo={grupos ? `${s.titulo} · ${plural(s.archivos.length, 'archivo', 'archivos')}` : s.titulo}>
              <ul className="r2-prod-archivos">
                {s.archivos.map((a) => <li key={a.id}>{pintarMiniatura(a)}</li>)}
              </ul>
            </SeccionCajon>
          ))
        )}
        {datos?.ocultos > 0 && (
          <p className="r2-nota r2-prod-ocultos">
            <Lock size={14} aria-hidden="true" />
            {datos.ocultos === 1 ? 'Se oculta 1 documento reservado' : `Se ocultan ${datos.ocultos} documentos reservados`}
          </p>
        )}
      </>
    );
  }

  return createPortal(
    <div className="r2-capa r2-capa--cajon">
      <div className="r2-velo" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="r2-cajon r2-cajon--ancho r2-prod-carpeta" role="dialog" aria-modal="true" aria-label={`Carpeta de ${titulo}`}>
        <div className="r2-cajon-cabecera">
          <div className="r2-cajon-titulos">
            <h2 className="r2-cajon-titulo" tabIndex={-1} data-r2-foco="">{titulo}</h2>
            <div className="r2-cajon-dato">
              <span className="r2-prod-carpeta-ruta"><FolderOpen size={16} aria-hidden="true" />{ruta}</span>
            </div>
          </div>
          <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma r2-cajon-cerrar"
            aria-label="Cerrar carpeta" title="Cerrar (Esc)" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="r2-cajon-cuerpo">{cuerpo}</div>
      </div>
    </div>,
    document.body,
  );
}
