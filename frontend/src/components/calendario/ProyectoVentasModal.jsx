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
  Calendar,
  Clock,
  User,
  Loader2
} from 'lucide-react';
import api from '../../services/api';
import { obtenerCarpetaVentas } from '../../services/calendario.service';

const ICONOS = {
  imagen: ImageIcon,
  pdf: FileText,
  video: Film,
  documento: FileText,
  hoja: FileText,
  presentacion: FileText,
  otro: File
};

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
 * Descarga un archivo del backend (que hace de proxy con Drive) y lo entrega
 * como object URL. Almacén no tiene acceso a Drive, por eso todo pasa por aquí.
 */
const useArchivoBlob = (archivoId, activo = true) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!archivoId || !activo) return;

    let cancelado = false;
    let objectUrl = null;

    (async () => {
      try {
        const response = await api.get(rutaArchivo(archivoId), { responseType: 'blob' });
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
  }, [archivoId, activo]);

  return { url, error };
};

const Miniatura = ({ archivo, onClick }) => {
  const esImagen = archivo.tipo === 'imagen';
  const { url, error } = useArchivoBlob(archivo.id, esImagen);
  const Icono = ICONOS[archivo.tipo] || File;

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
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">📁 {archivo.subcarpeta}</p>
        )}
      </div>
    </button>
  );
};

const Visor = ({ archivo, onVolver }) => {
  const { url, error } = useArchivoBlob(archivo.id);

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

const Dato = ({ icono, etiqueta, valor }) => {
  if (!valor) return null;
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
 * Modal que abre almacén/calidad al dar click a un proyecto del calendario:
 * muestra los datos del proyecto y los archivos que ventas dejó en Drive.
 * El pedido, los documentos con importes y los formatos de cierre (garantía,
 * control de calidad, check) los filtra el backend.
 */
const ProyectoVentasModal = ({ isOpen, onClose, proyecto, mes, dia }) => {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [archivoAbierto, setArchivoAbierto] = useState(null);

  const nombreProyecto = proyecto?.nombre || '';

  const cargar = useCallback(async () => {
    if (!nombreProyecto) return;
    setCargando(true);
    setError(null);
    setArchivoAbierto(null);
    try {
      const respuesta = await obtenerCarpetaVentas(nombreProyecto, mes);
      setDatos(respuesta.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo leer la carpeta de ventas');
    } finally {
      setCargando(false);
    }
  }, [nombreProyecto, mes]);

  useEffect(() => {
    if (isOpen) cargar();
    else {
      setDatos(null);
      setArchivoAbierto(null);
    }
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

  const info = datos?.proyecto;
  const archivos = datos?.archivos || [];

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
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              {nombreProyecto}
            </h3>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <FolderOpen size={12} />
              {datos?.carpeta?.ruta ? `Ventas / ${datos.carpeta.ruta}` : 'Carpeta de ventas'}
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
              Abriendo carpeta de ventas…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={32} className="text-red-400 mb-2" />
              <p className="text-gray-700">{error}</p>
              <button
                onClick={cargar}
                className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          ) : archivoAbierto ? (
            <Visor archivo={archivoAbierto} onVolver={() => setArchivoAbierto(null)} />
          ) : (
            <>
              {/* Datos del proyecto */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4 mb-4">
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
              </div>

              {/* Archivos */}
              {!datos?.carpeta ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-300" />
                  {datos?.mensaje || 'Todavía no hay carpeta de ventas para este proyecto'}
                </div>
              ) : archivos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-300" />
                  La carpeta no tiene archivos que puedas ver
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Archivos ({archivos.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {archivos.map((archivo) => (
                      <Miniatura
                        key={archivo.id}
                        archivo={archivo}
                        onClick={() => setArchivoAbierto(archivo)}
                      />
                    ))}
                  </div>
                </>
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

export default ProyectoVentasModal;
