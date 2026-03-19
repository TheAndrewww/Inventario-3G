import React, { useState, useEffect } from 'react';
import { ClipboardList, Upload, Link2, Trash2, Package, ChevronDown, ChevronRight, Loader, Wrench, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import ImportarChecklistModal from './ImportarChecklistModal';
import EnlazarArticulosModal from './EnlazarArticulosModal';

const ChecklistManager = ({ isOpen, onClose }) => {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalEnlazar, setModalEnlazar] = useState(null);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(new Set());
  const [tabActiva, setTabActiva] = useState('herramienta');

  useEffect(() => {
    if (isOpen) cargarItems();
  }, [isOpen]);

  const cargarItems = async () => {
    setCargando(true);
    try {
      const response = await checklistService.listarItems();
      const data = response.data || response;
      setItems(data.items || []);
      const secciones = new Set((data.items || []).map(i => i.seccion || 'GENERAL'));
      setSeccionesAbiertas(secciones);
    } catch (error) {
      console.error('Error al cargar items:', error);
      toast.error('Error al cargar checklist');
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async (item) => {
    if (!confirm(`¿Eliminar "${item.nombre}" del checklist?`)) return;
    try {
      await checklistService.eliminarItem(item.id);
      toast.success('Ítem eliminado');
      cargarItems();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev);
      if (next.has(seccion)) next.delete(seccion);
      else next.add(seccion);
      return next;
    });
  };

  if (!isOpen) return null;

  // Filtrar por tipo activo
  const itemsFiltrados = items.filter(i => i.tipo === tabActiva);
  const itemsHerramienta = items.filter(i => i.tipo === 'herramienta');
  const itemsMaterial = items.filter(i => i.tipo === 'material');

  // Agrupar por sección
  const porSeccion = itemsFiltrados.reduce((acc, item) => {
    const sec = item.seccion || 'GENERAL';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-xl">
                  <ClipboardList size={22} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Catálogo de Checklist</h2>
                  <p className="text-sm text-gray-500">{items.length} ítems en total</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalImportar(true)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm"
                >
                  <Upload size={16} />
                  Importar Excel
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex mt-4 bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setTabActiva('herramienta')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tabActiva === 'herramienta'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wrench size={16} />
                Herramientas
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tabActiva === 'herramienta' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {itemsHerramienta.length}
                </span>
              </button>
              <button
                onClick={() => setTabActiva('material')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tabActiva === 'material'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Box size={16} />
                Consumibles
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tabActiva === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {itemsMaterial.length}
                </span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                <Loader size={28} className="animate-spin" />
                <p className="text-sm">Cargando...</p>
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
                {tabActiva === 'herramienta' ? <Wrench size={48} /> : <Box size={48} />}
                <p className="text-center text-gray-500">
                  No hay {tabActiva === 'herramienta' ? 'herramientas' : 'materiales'} en el catálogo
                </p>
                <button
                  onClick={() => setModalImportar(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Upload size={16} />
                  Importar desde Excel
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(porSeccion).map(([seccion, sectionItems]) => {
                  const isOpen = seccionesAbiertas.has(seccion);
                  return (
                    <div key={seccion} className={`border rounded-xl overflow-hidden ${
                      tabActiva === 'herramienta' ? 'border-blue-200' : 'border-amber-200'
                    }`}>
                      <button
                        onClick={() => toggleSeccion(seccion)}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-colors text-left ${
                          tabActiva === 'herramienta' ? 'bg-blue-50' : 'bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span className={`font-bold text-sm uppercase tracking-wider ${
                            tabActiva === 'herramienta' ? 'text-blue-700' : 'text-amber-700'
                          }`}>{seccion}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            tabActiva === 'herramienta' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                          }`}>{sectionItems.length}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-gray-100">
                          {sectionItems.map((item) => {
                            const numEnlazados = item.articulosVinculados?.length || 0;
                            return (
                              <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-800 text-sm truncate">
                                      {item.nombre}
                                      {item.especificacion && (
                                        <span className="text-gray-400 font-normal ml-1.5">({item.especificacion})</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Cantidad: {item.cantidad_requerida} · {numEnlazados} artículo{numEnlazados !== 1 ? 's' : ''} enlazado{numEnlazados !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => setModalEnlazar(item)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      numEnlazados > 0
                                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                        : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
                                    }`}
                                    title="Enlazar artículos"
                                  >
                                    <Link2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleEliminar(item)}
                                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modales */}
      <ImportarChecklistModal
        isOpen={modalImportar}
        onClose={() => setModalImportar(false)}
        onImportado={cargarItems}
      />

      <EnlazarArticulosModal
        isOpen={!!modalEnlazar}
        onClose={() => setModalEnlazar(null)}
        item={modalEnlazar}
        onEnlazado={cargarItems}
      />
    </>
  );
};

export default ChecklistManager;
