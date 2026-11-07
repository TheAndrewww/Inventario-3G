import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import ImportarChecklistModal from './ImportarChecklistModal';
import EnlazarArticulosModal from './EnlazarArticulosModal';
import { confirmarG3 } from '../../diseno-3g/dialogosG3';
import { CajonCatalogoChecklist } from '../../rediseno2/gestion/CajonesChecklist';

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
    if (!(await confirmarG3({ titulo: `¿Eliminar «${item.nombre}» del checklist?`, confirmar: 'Eliminar del checklist', cancelar: 'No eliminar', peligro: true }))) return;
    try {
      await checklistService.eliminarItem(item.id);
      toast.success('Ítem eliminado');
      cargarItems();
    } catch (error) {
      toast.error('Error al eliminar');
    }
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
      <CajonCatalogoChecklist onClose={onClose} items={items} cargando={cargando} tabActiva={tabActiva} setTabActiva={setTabActiva}
        itemsHerramienta={itemsHerramienta} itemsMaterial={itemsMaterial} porSeccion={porSeccion}
        abrirImportar={() => setModalImportar(true)} abrirEnlazar={setModalEnlazar} handleEliminar={handleEliminar} />
      <ImportarChecklistModal isOpen={modalImportar} onClose={() => setModalImportar(false)} onImportado={cargarItems} />
      <EnlazarArticulosModal isOpen={!!modalEnlazar} onClose={() => setModalEnlazar(null)} item={modalEnlazar} onEnlazado={cargarItems} />
    </>
  );
};

export default ChecklistManager;
