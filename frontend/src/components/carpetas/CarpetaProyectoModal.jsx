import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Film,
  File,
  ArrowLeft,
  AlertCircle,
  Folder,
} from 'lucide-react';
import api from '../../services/api';
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
  const esImagen = archivo.tipo === 'imagen';
  const { url, error } = useArchivoBlob(ruta, esImagen);
  const Icono = ICONOS[archivo.tipo] || File;

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
};

const Visor = ({ archivo, ruta, onVolver }) => {
  const { url, error } = useArchivoBlob(ruta);
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
};

export const Dato = ({ icono, etiqueta, valor }) => {
  if (!valor) return null;
  return (
    <div className="r2-dato">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
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
  onDatos = null,
  // 28-oct · algo propio de quien abre la carpeta, debajo de «Datos de la obra» (Producción: la hoja de calidad)
  extra = null
}) => {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [archivoAbierto, setArchivoAbierto] = useState(null);

  // Cada carga lleva su número: si mientras tanto se abrió otro proyecto, la respuesta vieja se tira. Sin esto, una búsqueda
  // lenta en Drive (p. ej. PABLO HERNANDEZ, cuya carpeta está en el mes anterior) llegaba después y pintaba sus datos en la
  // ventana de LUISA DÍAZ (19-oct-2026).
  const vuelta = useRef(0);
  const ejecutar = useCallback(async () => {
    const mia = ++vuelta.current;
    setCargando(true);
    setError(null);
    setDatos(null);
    setArchivoAbierto(null);
    try {
      const data = await cargar();
      if (mia !== vuelta.current) return;
      setDatos(data);
      if (onDatos) onDatos(data);
    } catch (err) {
      if (mia !== vuelta.current) return;
      setError(err.response?.data?.message || 'No se pudo leer la carpeta');
    } finally {
      if (mia === vuelta.current) setCargando(false);
    }
  }, [cargar, onDatos]);

  // Se carga al abrir y otra vez si cambia el proyecto (`cargar` cambia con él; el padre debe memoizarla)
  useEffect(() => {
    if (isOpen) ejecutar();
    else {
      vuelta.current += 1;
      setDatos(null);
      setArchivoAbierto(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cargar]);

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

  return (
    <VistaCarpeta
      titulo={titulo} subtitulo={subtitulo} textoCargando={textoCargando} cargando={cargando} error={error} datos={datos}
      archivoAbierto={archivoAbierto} ejecutar={ejecutar} onClose={onClose} datosProyecto={datosProyecto} grupos={grupos} extra={extra}
      secciones={grupos ? secciones : [{ titulo: `Archivos · ${archivos.length}`, archivos }]} archivos={archivos}
      pintarMiniatura={(archivo) => (
        <Miniatura archivo={archivo} ruta={rutaArchivo(archivo.id, archivo)} onClick={() => setArchivoAbierto(archivo)} />
      )}
      pintarVisor={() => (
        <Visor archivo={archivoAbierto} ruta={rutaArchivo(archivoAbierto.id, archivoAbierto)} onVolver={() => setArchivoAbierto(null)} />
      )}
    />
  );
};

export default CarpetaProyectoModal;
