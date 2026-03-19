import React, { useState, useEffect } from 'react';
import { X, ClipboardCheck, Plus, Trash2, Package, Loader, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';

const ChecklistEquipoModal = ({ isOpen, onClose, equipo }) => {
  const [checklist, setChecklist] = useState([]);
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (isOpen && equipo?.id) {
      cargarChecklist();
      cargarTodosLosItems();
    }
  }, [isOpen, equipo?.id]);

  const cargarChecklist = async () => {
    setCargando(true);
    try {
      const response = await checklistService.obtenerChecklistEquipo(equipo.id);
      const data = response.data || response;
      setChecklist(data.checklist || []);
    } catch (error) {
      console.error('Error al cargar checklist:', error);
      toast.error('Error al cargar checklist');
    } finally {
      setCargando(false);
    }
  };

  const cargarTodosLosItems = async () => {
    try {
      const response = await checklistService.listarItems();
      const data = response.data || response;
      setTodosLosItems(data.items || []);
    } catch (error) {
      console.error('Error al cargar ítems:', error);
    }
  };

  const asignarItem = async (item) => {
    try {
      await checklistService.asignarItemsAEquipo(equipo.id, [{
        checklist_item_id: item.id,
        cantidad_requerida: item.cantidad_requerida || 1
      }]);
      toast.success(`"${item.nombre}" asignado al equipo`);
      cargarChecklist();
    } catch (error) {
      toast.error('Error al asignar');
    }
  };

  const asignarTodos = async () => {
    if (!confirm('¿Asignar TODOS los ítems del catálogo a este equipo?')) return;
    try {
      const items = todosLosItems.map(i => ({
        checklist_item_id: i.id,
        cantidad_requerida: i.cantidad_requerida || 1
      }));
      await checklistService.asignarItemsAEquipo(equipo.id, items);
      toast.success(`${items.length} ítems asignados`);
      cargarChecklist();
      setMostrarAgregar(false);
    } catch (error) {
      toast.error('Error al asignar');
    }
  };

  const quitarItem = async (itemId) => {
    try {
      await checklistService.quitarItemDeEquipo(equipo.id, itemId);
      toast.success('Ítem removido');
      cargarChecklist();
    } catch (error) {
      toast.error('Error al quitar');
    }
  };

  if (!isOpen || !equipo) return null;

  const idsAsignados = new Set(checklist.map(c => c.checklistItem?.id).filter(Boolean));
  const itemsDisponibles = todosLosItems.filter(i =>
    !idsAsignados.has(i.id) &&
    (!busqueda || i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  // Agrupar checklist por sección
  const porSeccion = checklist.reduce((acc, c) => {
    const sec = c.checklistItem?.seccion || 'GENERAL';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(c);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <ClipboardCheck size={22} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Checklist del Equipo</h2>
              <p className="text-sm text-gray-500">{equipo.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarAgregar(!mostrarAgregar)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm"
            >
              <Plus size={16} />
              Agregar ítems
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Panel de agregar ítems */}
          {mostrarAgregar && (
            <div className="p-4 bg-teal-50 border-b border-teal-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-teal-800">Agregar ítems del catálogo</h3>
                <button
                  onClick={asignarTodos}
                  className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Asignar todos ({todosLosItems.length - idsAsignados.size})
                </button>
              </div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar ítem..."
                  className="w-full pl-9 pr-4 py-2 border border-teal-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {itemsDisponibles.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    {todosLosItems.length === 0 ? 'Importa ítems primero desde el catálogo' : 'Todos los ítems ya están asignados'}
                  </p>
                ) : (
                  itemsDisponibles.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => asignarItem(item)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-teal-50 rounded-lg text-left transition-colors border border-teal-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                          item.tipo === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.tipo === 'material' ? 'M' : 'H'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 truncate">{item.nombre}</span>
                        {item.especificacion && (
                          <span className="text-xs text-gray-400">({item.especificacion})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">×{item.cantidad_requerida}</span>
                        <Plus size={14} className="text-teal-600" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Lista de ítems asignados */}
          <div className="p-4">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                <Loader size={28} className="animate-spin" />
                <p className="text-sm">Cargando...</p>
              </div>
            ) : checklist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-400">
                <ClipboardCheck size={48} />
                <p className="text-gray-500 text-center">Este equipo no tiene ítems asignados</p>
                <button
                  onClick={() => setMostrarAgregar(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Agregar ítems
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500 font-medium">
                    {checklist.length} ítem{checklist.length !== 1 ? 's' : ''} asignado{checklist.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {Object.entries(porSeccion).map(([seccion, sectionItems]) => (
                  <div key={seccion} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold text-xs text-gray-600 uppercase tracking-wider">
                      {seccion} ({sectionItems.length})
                    </div>
                    <div className="divide-y divide-gray-100">
                      {sectionItems.map((asignacion) => {
                        const item = asignacion.checklistItem;
                        if (!item) return null;
                        const numEnlazados = item.articulosVinculados?.length || 0;
                        return (
                          <div key={asignacion.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                numEnlazados > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {numEnlazados > 0 ? <Check size={12} /> : <Package size={12} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {item.nombre}
                                  {item.especificacion && <span className="text-gray-400 font-normal ml-1">({item.especificacion})</span>}
                                </p>
                                <p className="text-xs text-gray-400">
                                  ×{asignacion.cantidad_requerida} · {numEnlazados > 0 ? `${numEnlazados} artículo${numEnlazados > 1 ? 's' : ''}` : 'sin enlazar'}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => quitarItem(item.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistEquipoModal;
