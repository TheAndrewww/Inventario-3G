import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Link2, Check, Package, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';

const EnlazarArticulosModal = ({ isOpen, onClose, item, onEnlazado }) => {
  const [sugerencias, setSugerencias] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (isOpen && item?.id) {
      cargarSugerencias();
    }
  }, [isOpen, item?.id]);

  const cargarSugerencias = async () => {
    setCargando(true);
    try {
      const response = await checklistService.sugerirArticulos(item.id);
      const data = response.data || response;
      setSugerencias(data.sugerencias || []);
      setSeleccionados(new Set(data.enlazados || []));
    } catch (error) {
      console.error('Error al cargar sugerencias:', error);
      toast.error('Error al cargar sugerencias');
    } finally {
      setCargando(false);
    }
  };

  const buscarArticulos = useCallback(async (q) => {
    if (q.length < 2) {
      setResultadosBusqueda([]);
      return;
    }
    setBuscando(true);
    try {
      const response = await checklistService.buscarArticulos(q);
      const data = response.data || response;
      setResultadosBusqueda(data.articulos || []);
    } catch (error) {
      console.error('Error al buscar:', error);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda.trim()) {
        buscarArticulos(busqueda.trim());
      } else {
        setResultadosBusqueda([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, buscarArticulos]);

  const toggleArticulo = (articuloId) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(articuloId)) {
        next.delete(articuloId);
      } else {
        next.add(articuloId);
      }
      return next;
    });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await checklistService.enlazarArticulos(item.id, Array.from(seleccionados));
      toast.success('Artículos enlazados correctamente');
      onEnlazado?.();
      onClose();
    } catch (error) {
      console.error('Error al enlazar:', error);
      toast.error('Error al enlazar artículos');
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen || !item) return null;

  const articulosAMostrar = busqueda.trim() ? resultadosBusqueda : sugerencias;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Link2 size={22} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Enlazar Artículos</h2>
                <p className="text-sm text-gray-500">
                  {item.nombre} {item.especificacion ? `(${item.especificacion})` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mt-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar artículos del inventario..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            />
            {buscando && (
              <Loader size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <Loader size={28} className="animate-spin" />
              <p className="text-sm">Buscando sugerencias...</p>
            </div>
          ) : articulosAMostrar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <Package size={28} />
              <p className="text-sm">
                {busqueda ? 'No se encontraron artículos' : 'No hay sugerencias automáticas'}
              </p>
              <p className="text-xs">Usa el buscador para encontrar artículos del inventario</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {!busqueda.trim() && sugerencias.length > 0 && (
                <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider px-2 mb-2">
                  ✨ Sugerencias automáticas
                </p>
              )}
              {articulosAMostrar.map((articulo) => {
                const isSelected = seleccionados.has(articulo.id);
                return (
                  <button
                    key={articulo.id}
                    onClick={() => toggleArticulo(articulo.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-indigo-50 border-2 border-indigo-300 shadow-sm'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-transparent'
                    }`}>
                      <Check size={14} />
                    </div>
                    {articulo.imagen_url ? (
                      <img
                        src={articulo.imagen_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{articulo.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {articulo.categoria?.nombre && (
                          <span className="text-xs text-gray-400">{articulo.categoria.nombre}</span>
                        )}
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">Stock: {articulo.stock_actual}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {seleccionados.size} artículo{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            {guardando ? (
              <>
                <Loader size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Link2 size={16} />
                Guardar enlaces
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnlazarArticulosModal;
