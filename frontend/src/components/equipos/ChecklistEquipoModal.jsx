import React, { useState, useEffect } from 'react';
import { X, ClipboardCheck, Plus, Trash2, Package, Loader, Check, Search, Wrench, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';

const ChecklistEquipoModal = ({ isOpen, onClose, equipo }) => {
  const [checklist, setChecklist] = useState([]);
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState('herramienta'); // 'herramienta' | 'material'

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
    const itemsTipo = todosLosItems.filter(i => i.tipo === tabActiva && !idsAsignados.has(i.id));
    if (itemsTipo.length === 0) return;
    if (!confirm(`¿Asignar ${itemsTipo.length} ${tabActiva === 'herramienta' ? 'herramientas' : 'materiales'} a este equipo?`)) return;
    try {
      const items = itemsTipo.map(i => ({
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

  // Separar checklist por tipo
  const checklistHerramientas = checklist.filter(c => c.checklistItem?.tipo === 'herramienta');
  const checklistMateriales = checklist.filter(c => c.checklistItem?.tipo === 'material');
  const checklistActiva = tabActiva === 'herramienta' ? checklistHerramientas : checklistMateriales;

  // Items disponibles para agregar (filtrados por tab activa)
  const itemsDisponibles = todosLosItems.filter(i =>
    i.tipo === tabActiva &&
    !idsAsignados.has(i.id) &&
    (!busqueda || i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  // Agrupar la checklist activa por sección
  const porSeccion = checklistActiva.reduce((acc, c) => {
    const sec = c.checklistItem?.seccion || 'GENERAL';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(c);
    return acc;
  }, {});

  const renderItemRow = (asignacion) => {
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
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
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
                Agregar
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs Herramienta / Material */}
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
                {checklistHerramientas.length}
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
                {checklistMateriales.length}
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Panel de agregar ítems */}
          {mostrarAgregar && (
            <div className={`p-4 border-b ${tabActiva === 'herramienta' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold text-sm ${tabActiva === 'herramienta' ? 'text-blue-800' : 'text-amber-800'}`}>
                  Agregar {tabActiva === 'herramienta' ? 'herramientas' : 'materiales'} del catálogo
                </h3>
                <button
                  onClick={asignarTodos}
                  className={`text-xs text-white px-3 py-1.5 rounded-lg transition-colors ${
                    tabActiva === 'herramienta' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Asignar todos ({itemsDisponibles.length})
                </button>
              </div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={`Buscar ${tabActiva === 'herramienta' ? 'herramienta' : 'material'}...`}
                  className={`w-full pl-9 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 ${
                    tabActiva === 'herramienta' ? 'border-blue-200 focus:ring-blue-400' : 'border-amber-200 focus:ring-amber-400'
                  }`}
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {itemsDisponibles.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    {todosLosItems.filter(i => i.tipo === tabActiva).length === 0 
                      ? 'No hay ítems de este tipo en el catálogo' 
                      : 'Todos los ítems ya están asignados'}
                  </p>
                ) : (
                  itemsDisponibles.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => asignarItem(item)}
                      className={`w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg text-left transition-colors border ${
                        tabActiva === 'herramienta' ? 'hover:bg-blue-50 border-blue-100' : 'hover:bg-amber-50 border-amber-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-700 truncate">{item.nombre}</span>
                        {item.especificacion && (
                          <span className="text-xs text-gray-400">({item.especificacion})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">×{item.cantidad_requerida}</span>
                        <Plus size={14} className={tabActiva === 'herramienta' ? 'text-blue-600' : 'text-amber-600'} />
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
            ) : checklistActiva.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-400">
                {tabActiva === 'herramienta' ? <Wrench size={48} /> : <Box size={48} />}
                <p className="text-gray-500 text-center">
                  No hay {tabActiva === 'herramienta' ? 'herramientas' : 'materiales'} asignados
                </p>
                <button
                  onClick={() => setMostrarAgregar(true)}
                  className={`font-medium px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm text-white ${
                    tabActiva === 'herramienta' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <Plus size={16} />
                  Agregar {tabActiva === 'herramienta' ? 'herramientas' : 'materiales'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-medium">
                  {checklistActiva.length} {tabActiva === 'herramienta' ? 'herramienta' : 'material'}{checklistActiva.length !== 1 ? (tabActiva === 'herramienta' ? 's' : 'es') : ''} asignado{checklistActiva.length !== 1 ? 's' : ''}
                </p>
                {Object.entries(porSeccion).map(([seccion, sectionItems]) => (
                  <div key={seccion} className={`border rounded-xl overflow-hidden ${
                    tabActiva === 'herramienta' ? 'border-blue-200' : 'border-amber-200'
                  }`}>
                    <div className={`px-4 py-2 font-semibold text-xs uppercase tracking-wider ${
                      tabActiva === 'herramienta' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {seccion} ({sectionItems.length})
                    </div>
                    <div className="divide-y divide-gray-100">
                      {sectionItems.map(renderItemRow)}
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
