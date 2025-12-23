import React, { useState, useEffect } from 'react';
import { X, Package, MapPin, DollarSign, Hash, Box, Edit, Sparkles, Eye, PackagePlus, PackageMinus } from 'lucide-react';
import { Modal } from '../common';
import BarcodeDisplay from './BarcodeDisplay';
import UnidadHerramientaDetalleModal from './UnidadHerramientaDetalleModal';
import { getImageUrl } from '../../utils/imageUtils';
import articulosService from '../../services/articulos.service';
import herramientasRentaService from '../../services/herramientasRenta.service';

const ArticuloDetalleModal = ({
  articulo,
  isOpen,
  onClose,
  onEdit,
  canEdit = false,
  onImageReprocessed,
  onEntrada,
  onSalida,
  puedeGestionarInventario = false,
  puedeRegistrarSalida = false
}) => {
  const [imagenExpandida, setImagenExpandida] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Estados para herramientas de renta
  const [unidadesHerramienta, setUnidadesHerramienta] = useState([]);
  const [tipoHerramienta, setTipoHerramienta] = useState(null);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modalUnidadOpen, setModalUnidadOpen] = useState(false);

  // Cargar unidades cuando es herramienta de renta
  useEffect(() => {
    if (isOpen && articulo?.es_herramienta) {
      cargarUnidadesHerramienta();
    } else {
      // Limpiar cuando se cierra o no es herramienta
      setUnidadesHerramienta([]);
      setTipoHerramienta(null);
    }
  }, [isOpen, articulo?.id, articulo?.es_herramienta]);

  // Cerrar imagen expandida con tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && imagenExpandida) {
        setImagenExpandida(false);
      }
    };

    if (imagenExpandida) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [imagenExpandida]);

  // Cargar unidades de la herramienta
  const cargarUnidadesHerramienta = async () => {
    if (!articulo?.id) return;

    try {
      setLoadingUnidades(true);
      const data = await herramientasRentaService.obtenerUnidadesPorArticulo(articulo.id);
      setUnidadesHerramienta(data.unidades || []);
      setTipoHerramienta(data.tipo || null);
    } catch (error) {
      console.error('Error al cargar unidades de herramienta:', error);
      setUnidadesHerramienta([]);
      setTipoHerramienta(null);
    } finally {
      setLoadingUnidades(false);
    }
  };

  // Abrir modal de detalle de unidad
  const handleVerUnidad = (unidad) => {
    setUnidadSeleccionada(unidad);
    setModalUnidadOpen(true);
  };

  if (!articulo) return null;

  const stockBajo = parseFloat(articulo.stock_actual) <= parseFloat(articulo.stock_minimo);

  const imagenUrl = getImageUrl(articulo.imagen_url);

  // Manejar reprocesamiento de imagen con IA
  const handleReprocessImage = async () => {
    if (!articulo.imagen_url) return;

    if (!confirm('¿Reprocesar esta imagen con IA para mejorar su calidad? Esto puede tardar unos segundos.')) {
      return;
    }

    setReprocessing(true);
    try {
      const result = await articulosService.reprocessImagen(articulo.id);
      alert('✅ Imagen reprocesada exitosamente con IA');

      // Notificar al componente padre para actualizar la lista
      if (onImageReprocessed) {
        onImageReprocessed(articulo.id, result.imagen_url);
      }
    } catch (error) {
      console.error('Error al reprocesar imagen:', error);
      alert('❌ ' + (error.message || 'Error al reprocesar imagen. Verifica que Nano Banana esté configurado.'));
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Artículo">
      <div className="space-y-6">
        {/* Header con imagen y nombre */}
        <div className="border-b pb-4">
          <div className="flex items-start gap-4">
            {/* Imagen del artículo */}
            <div className="flex-shrink-0">
              {imagenUrl ? (
                <div className="space-y-2">
                  <img
                    src={imagenUrl}
                    alt={articulo.nombre}
                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setImagenExpandida(true)}
                    title="Haz clic para ver la imagen en tamaño completo"
                  />
                  {canEdit && (
                    <button
                      onClick={handleReprocessImage}
                      disabled={reprocessing}
                      className="w-24 px-2 py-1 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Reprocesar con IA para mejorar calidad"
                    >
                      {reprocessing ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                          <span>IA...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          <span>Mejorar IA</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center text-4xl">
                  📦
                </div>
              )}
            </div>

            {/* Información del artículo */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {articulo.nombre}
              </h2>
              {articulo.descripcion && (
                <p className="text-gray-600">{articulo.descripcion}</p>
              )}
              <div className="mt-3">
                <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                  {articulo.categoria?.nombre || 'Sin categoría'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Código de barras - Solo para consumibles, NO para herramientas */}
        {!articulo.es_herramienta && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">
              Código de Barras EAN-13
            </h3>
            <BarcodeDisplay
              articuloId={articulo.id}
              codigoEAN13={articulo.codigo_ean13}
            />
          </div>
        )}

        {/* Lista de unidades para herramientas */}
        {articulo.es_herramienta && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-orange-200 bg-orange-100">
              <span className="text-2xl">🔧</span>
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Herramienta de Renta - Unidades Individuales
                </p>
                <p className="text-xs text-orange-700">
                  Cada unidad tiene su propio código de barras. Haz clic en una unidad para ver sus detalles.
                </p>
              </div>
            </div>

            {/* Loading */}
            {loadingUnidades && (
              <div className="p-6 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-orange-700 mt-2">Cargando unidades...</p>
              </div>
            )}

            {/* Lista de unidades */}
            {!loadingUnidades && unidadesHerramienta.length > 0 && (
              <div className="p-4 max-h-80 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unidadesHerramienta.map((unidad) => {
                    const estadoBadges = {
                      disponible: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disponible', icon: '✓' },
                      asignada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Asignada', icon: '👤' },
                      en_reparacion: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Reparación', icon: '🔧' },
                      perdida: { bg: 'bg-red-100', text: 'text-red-800', label: 'Perdida', icon: '❌' },
                      baja: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Baja', icon: '🗑️' }
                    };
                    const badge = estadoBadges[unidad.estado] || estadoBadges.disponible;

                    return (
                      <button
                        key={unidad.id}
                        onClick={() => handleVerUnidad(unidad)}
                        className="bg-white border-2 border-orange-200 hover:border-orange-400 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-red-600 text-sm">
                            {unidad.codigo_unico}
                          </span>
                          <Eye size={16} className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </div>
                        {unidad.usuarioAsignado && (
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            👤 {unidad.usuarioAsignado.nombre}
                          </p>
                        )}
                        {unidad.equipoAsignado && (
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            👥 {unidad.equipoAsignado.nombre}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-orange-700 mt-3 text-center">
                  Total: {unidadesHerramienta.length} {unidadesHerramienta.length === 1 ? 'unidad' : 'unidades'}
                </p>
              </div>
            )}

            {/* Sin unidades */}
            {!loadingUnidades && unidadesHerramienta.length === 0 && (
              <div className="p-6 text-center text-orange-700">
                <p className="text-sm">No hay unidades registradas para esta herramienta</p>
              </div>
            )}
          </div>
        )}

        {/* Información del artículo */}
        <div className="grid grid-cols-2 gap-4">
          {/* Stock */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Box size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Stock Actual</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${stockBajo ? 'text-red-600' : 'text-gray-900'}`}>
                {parseFloat(articulo.stock_actual).toFixed(0)}
              </span>
              <span className="text-sm text-gray-500">{articulo.unidad}</span>
            </div>
            {stockBajo && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                Stock bajo (mín: {parseFloat(articulo.stock_minimo).toFixed(0)})
              </span>
            )}
          </div>

          {/* Costo */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Costo Unitario</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${parseFloat(articulo.costo_unitario || 0).toFixed(2)}
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Ubicación</span>
            </div>
            <div className="text-sm text-gray-900">
              {articulo.ubicacion?.codigo || 'N/A'}
            </div>
            {articulo.ubicacion?.descripcion && (
              <div className="text-xs text-gray-500 mt-1">
                {articulo.ubicacion.descripcion}
              </div>
            )}
          </div>

          {/* Stock Mínimo */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Stock Mínimo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {parseFloat(articulo.stock_minimo).toFixed(0)}
              </span>
              <span className="text-sm text-gray-500">{articulo.unidad}</span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-3 pt-4 border-t">
          {/* Botones de Entrada y Salida - Solo para almacenistas */}
          {(puedeGestionarInventario || puedeRegistrarSalida) && (
            <div className="grid grid-cols-2 gap-3">
              {puedeGestionarInventario && onEntrada && (
                <button
                  onClick={() => {
                    onEntrada(articulo);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  <PackagePlus size={20} />
                  Entrada
                </button>
              )}
              {puedeRegistrarSalida && onSalida && (
                <button
                  onClick={() => {
                    onSalida(articulo);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                >
                  <PackageMinus size={20} />
                  Salida
                </button>
              )}
            </div>
          )}

          {/* Botones de cerrar y editar */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            {canEdit && onEdit && (
              <button
                onClick={() => {
                  onEdit(articulo);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors"
              >
                <Edit size={18} />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de imagen expandida */}
      {imagenExpandida && imagenUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4"
          onClick={() => setImagenExpandida(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setImagenExpandida(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={32} />
            </button>
            <img
              src={imagenUrl}
              alt={articulo.nombre}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 text-sm">
              {articulo.nombre}
            </p>
          </div>
        </div>
      )}

      {/* Modal de detalle de unidad de herramienta */}
      {modalUnidadOpen && unidadSeleccionada && (
        <UnidadHerramientaDetalleModal
          unidad={unidadSeleccionada}
          tipoHerramienta={tipoHerramienta}
          isOpen={modalUnidadOpen}
          onClose={() => {
            setModalUnidadOpen(false);
            setUnidadSeleccionada(null);
          }}
        />
      )}
    </Modal>
  );
};

export default ArticuloDetalleModal;
