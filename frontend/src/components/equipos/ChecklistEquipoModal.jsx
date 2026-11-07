import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import { confirmarG3 } from '../../diseno-3g/dialogosG3';
import { CajonChecklistEquipo } from '../../rediseno2/gestion/CajonesChecklist';

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
    if (!(await confirmarG3({
      titulo: `¿Asignar ${itemsTipo.length} ${tabActiva === 'herramienta' ? 'herramientas' : 'materiales'} a este equipo?`,
      datos: [['Equipo', equipo?.nombre || ''], ['Renglones', itemsTipo.slice(0, 6).map(i => i.nombre).join(', ') + (itemsTipo.length > 6 ? ` y ${itemsTipo.length - 6} más` : '')]],
      confirmar: 'Asignar al equipo', cancelar: 'Regresar',
    }))) return;
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

  return (
    <CajonChecklistEquipo equipo={equipo} onClose={onClose} cargando={cargando} tabActiva={tabActiva} setTabActiva={setTabActiva}
      checklistHerramientas={checklistHerramientas} checklistMateriales={checklistMateriales} checklistActiva={checklistActiva}
      porSeccion={porSeccion} mostrarAgregar={mostrarAgregar} setMostrarAgregar={setMostrarAgregar} busqueda={busqueda} setBusqueda={setBusqueda}
      itemsDisponibles={itemsDisponibles} hayDelTipo={todosLosItems.some((i) => i.tipo === tabActiva)}
      asignarItem={asignarItem} asignarTodos={asignarTodos} quitarItem={quitarItem} />
  );
};

export default ChecklistEquipoModal;
