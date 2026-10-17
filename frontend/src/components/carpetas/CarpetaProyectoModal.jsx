import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  ArrowLeft,
  AlertCircle,
  Lock,
  Loader2,
  Folder
} from 'lucide-react';
import { useDiseno3G } from '../../diseno-3g/useDiseno3G';
import api from '../../services/api';
import { useDiseno3G as useDiseno3GR2 } from '../../rediseno2/fundacion/useDiseno3G';
import VistaCarpeta from '../../rediseno2/produccion/VistaCarpeta';

const ICONOS = {
  imagen: ImageIcon,
  pdf: FileText,
  video: Film,
  documento: FileText,
  hoja: FileText,
  presentacion: FileText,
  otro: File
};

/**
 * Descarga un archivo del backend (que hace de proxy con Drive) y lo entrega
 * como object URL. Quien consulta no tiene acceso a Drive, por eso todo pasa
 * por aquí.
 */
const useArchivoBlob = (ruta, activo = true) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ruta || !activo) return;

    let cancelado = false;
    let objectUrl = null;

    (async () => {
      try {
        const response = await api.get(ruta, { responseType: 'blob' });
        if (cancelado) return;
        const blob = new Blob([response.data], {
          type: response.headers['content-type'] || 'application/octet-stream'
        });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelado) setError(true);
      }
    })();

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta, activo]);

  return { url, error };
};

const Miniatura = ({ archivo, ruta, onClick }) => {
  const g3 = useDiseno3G(); // Diseño 3G: ícono en vez de emoji y letra de 12 px como mínimo
  const d3 = useDiseno3GR2(); // Rediseño 2: encendido, la miniatura nueva
  const esImagen = archivo.tipo === 'imagen';
  const { url, error } = useArchivoBlob(ruta, esImagen);
  const Icono = ICONOS[archivo.tipo] || File;

  // Rediseño 2 (encendido): misma miniatura (la misma petición de la imagen), con el aspecto nuevo
  if (d3) {
    return (
      <button type="button" onClick={onClick} className="r2-prod-archivo" title={archivo.nombre}>
        <span className="r2-prod-archivo-vista">
          {esImagen && url ? (
            <img src={url} alt="" />
          ) : esImagen && !error ? (
            <span className="r2-hueso r2-prod-archivo-hueso" aria-hidden="true" />
          ) : (
            <Icono size={32} aria-hidden="true" className={archivo.tipo === 'pdf' ? 'r2-tono--mal' : undefined} />
          )}
        </span>
        <span className="r2-prod-archivo-nombre">{archivo.nombre}</span>
        {archivo.subcarpeta && (
          <span className="r2-prod-archivo-sub"><Folder size={14} aria-hidden="true" />{archivo.subcarpeta}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-violet-400 hover:shadow-md transition-all"
    >
      <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
        {esImagen && url ? (
          <img
            src={url}
            alt={archivo.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : esImagen && !error ? (
          <Loader2 size={20} className="text-gray-400 animate-spin" />
        ) : (
          <Icono size={36} className={archivo.tipo === 'pdf' ? 'text-red-400' : 'text-gray-400'} />
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-gray-800 line-clamp-2 break-words">
          {archivo.nombre}
        </p>
        {archivo.subcarpeta && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate g3:!text-xs g3:!text-g3-tinta-2">{g3 ? <Folder size={12} className="g3:inline g3:align-[-2px] g3:mr-1" aria-hidden="true" /> : '📁 '}{archivo.subcarpeta}</p>
        )}
      </div>
    </button>
  );
};

const Visor = ({ archivo, ruta, onVolver }) => {
  const { url, error } = useArchivoBlob(ruta);
  const d3 = useDiseno3GR2(); // Rediseño 2: encendido, el mismo visor con el aspecto nuevo (misma petición del archivo)

  if (d3) {
    return (
      <div className="r2-prod-visor">
        <div className="r2-prod-visor-cab">
          <button type="button" onClick={onVolver} className="r2-boton r2-boton--fantasma r2-boton--normal">
            <ArrowLeft size={18} aria-hidden="true" className="r2-boton-svg" /><span className="r2-boton-texto">Volver a la carpeta</span>
          </button>
          <span className="r2-prod-visor-nombre">{archivo.nombre}</span>
        </div>
        <div className="r2-prod-visor-marco">
          {error ? (
            <div className="r2-vacio" role="alert">
              <AlertCircle size={24} aria-hidden="true" className="r2-tono--mal" />
              <p className="r2-vacio-titulo">No se pudo abrir el archivo</p>
            </div>
          ) : !url ? (
            <span className="r2-hueso r2-prod-visor-hueso" role="status" aria-label="Abriendo archivo…" />
          ) : archivo.tipo === 'imagen' ? (
            <img src={url} alt={archivo.nombre} />
          ) : archivo.tipo === 'video' ? (
            <video src={url} controls />
          ) : archivo.tipo === 'pdf' ? (
            <iframe src={url} title={archivo.nombre} />
          ) : (
            <div className="r2-vacio">
              <File size={24} aria-hidden="true" className="r2-vacio-icono" />
              <p className="r2-vacio-titulo">Este tipo de archivo no se puede ver aquí.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onVolver}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <span className="text-sm font-medium text-gray-700 truncate flex-1">{archivo.nombre}</span>
      </div>

      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[50vh]">
        {error ? (
          <div className="text-center text-gray-500 p-6">
            <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
            No se pudo abrir el archivo
          </div>
        ) : !url ? (
          <Loader2 size={28} className="text-gray-400 animate-spin" />
        ) : archivo.tipo === 'imagen' ? (
          <img src={url} alt={archivo.nombre} className="max-w-full max-h-[70vh] object-contain" />
        ) : archivo.tipo === 'video' ? (
          <video src={url} controls className="max-w-full max-h-[70vh]" />
        ) : archivo.tipo === 'pdf' ? (
          <iframe src={url} title={archivo.nombre} className="w-full h-[70vh] border-0" />
        ) : (
          <div className="text-center text-gray-600 p-6">
            <File size={32} className="mx-auto mb-2 text-gray-400" />
            Este tipo de archivo no se puede ver aquí.
          </div>
        )}
      </div>
    </div>
  );
};

export const Dato = ({ icono, etiqueta, valor }) => {
  const d3 = useDiseno3GR2(); // Rediseño 2: encendido, etiqueta arriba (13 px) y valor (15 px), sin ícono ni mayúsculas
  if (!valor) return null;
  if (d3) {
    return (
      <div className="r2-dato">
        <dt>{etiqueta}</dt>
        <dd>{valor}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className="text-sm text-gray-800 break-words">{valor}</p>
      </div>
    </div>
  );
};

/**
 * Ventana con el contenido de una carpeta de Drive de un proyecto.
 *
 * La comparten dos vistas: el calendario (carpeta de ventas) y el dashboard de
 * producción (carpeta de producción). El backend decide qué archivos entrega;
 * aquí solo se muestran, sin opción de descarga.
 *
 * @param {Function} props.cargar - async () => data del backend
 *        ({ carpeta, archivos, ocultos, mensaje })
 * @param {Function} props.rutaArchivo - (id) => ruta del proxy en el backend
 * @param {React.ReactNode} props.datosProyecto - Bloque de datos a mostrar arriba
 * @param {Array} props.grupos - [{ clave, titulo }] para agrupar por archivo.categoria
 */
const CarpetaProyectoModal = ({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  textoCargando = 'Abriendo carpeta…',
  cargar,
  rutaArchivo,
  datosProyecto = null,
  grupos = null,
  onDatos = null
}) => {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [archivoAbierto, setArchivoAbierto] = useState(null);
  const d3 = useDiseno3GR2(); // Rediseño 2: encendido, la carpeta en un cajón (abajo, antes del return de siempre)

  const ejecutar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setArchivoAbierto(null);
    try {
      const data = await cargar();
      setDatos(data);
      if (onDatos) onDatos(data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo leer la carpeta');
    } finally {
      setCargando(false);
    }
  }, [cargar, onDatos]);

  useEffect(() => {
    if (isOpen) ejecutar();
    else {
      setDatos(null);
      setArchivoAbierto(null);
    }
    // ejecutar cambia con `cargar`; el padre debe memoizarla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (archivoAbierto) setArchivoAbierto(null);
      else onClose();
    };
    if (isOpen) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, archivoAbierto, onClose]);

  if (!isOpen) return null;

  const archivos = datos?.archivos || [];

  // Si la vista definió grupos, se reparten los archivos por categoría y se
  // deja al final lo que no cayó en ninguno.
  const secciones = grupos
    ? [
        ...grupos.map(g => ({
          titulo: g.titulo,
          archivos: archivos.filter(a => a.categoria === g.clave)
        })),
        {
          titulo: 'Otros',
          archivos: archivos.filter(a => !grupos.some(g => g.clave === a.categoria))
        }
      ].filter(s => s.archivos.length > 0)
    : [{ titulo: `Archivos (${archivos.length})`, archivos }];

  // Rediseño 2 (encendido): mismo contenido y mismas peticiones, en un cajón lateral
  if (d3) {
    return (
      <VistaCarpeta
        titulo={titulo} subtitulo={subtitulo} textoCargando={textoCargando} cargando={cargando} error={error} datos={datos}
        archivoAbierto={archivoAbierto} ejecutar={ejecutar} onClose={onClose} datosProyecto={datosProyecto} grupos={grupos}
        secciones={grupos ? secciones : [{ titulo: `Archivos · ${archivos.length}`, archivos }]} archivos={archivos}
        pintarMiniatura={(archivo) => (
          <Miniatura archivo={archivo} ruta={rutaArchivo(archivo.id)} onClick={() => setArchivoAbierto(archivo)} />
        )}
        pintarVisor={() => (
          <Visor archivo={archivoAbierto} ruta={rutaArchivo(archivoAbierto.id)} onVolver={() => setArchivoAbierto(null)} />
        )}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{titulo}</h3>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <FolderOpen size={12} />
              {datos?.carpeta?.ruta ? `${subtitulo} / ${datos.carpeta.ruta}` : subtitulo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 size={28} className="animate-spin mb-2" />
              {textoCargando}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={32} className="text-red-400 mb-2" />
              <p className="text-gray-700">{error}</p>
              <button
                onClick={ejecutar}
                className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          ) : archivoAbierto ? (
            <Visor
              archivo={archivoAbierto}
              ruta={rutaArchivo(archivoAbierto.id)}
              onVolver={() => setArchivoAbierto(null)}
            />
          ) : (
            <>
              {datosProyecto && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4 mb-4">
                  {typeof datosProyecto === 'function' ? datosProyecto(datos) : datosProyecto}
                </div>
              )}

              {!datos?.carpeta ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-300" />
                  {datos?.mensaje || 'Todavía no hay carpeta para este proyecto'}
                </div>
              ) : archivos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-300" />
                  La carpeta no tiene archivos que puedas ver
                </div>
              ) : (
                secciones.map((seccion) => (
                  <div key={seccion.titulo} className="mb-5">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      {seccion.titulo}
                      {grupos && <span className="text-gray-400 font-normal"> ({seccion.archivos.length})</span>}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {seccion.archivos.map((archivo) => (
                        <Miniatura
                          key={archivo.id}
                          archivo={archivo}
                          ruta={rutaArchivo(archivo.id)}
                          onClick={() => setArchivoAbierto(archivo)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}

              {datos?.ocultos > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-4">
                  <Lock size={12} />
                  {datos.ocultos === 1
                    ? 'Se oculta 1 documento reservado'
                    : `Se ocultan ${datos.ocultos} documentos reservados`}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarpetaProyectoModal;
