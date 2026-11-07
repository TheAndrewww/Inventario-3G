import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import { CajonEnlazarArticulos } from '../../rediseno2/gestion/CajonesChecklist';

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
    <CajonEnlazarArticulos item={item} onClose={onClose} cargando={cargando} buscando={buscando} busqueda={busqueda} setBusqueda={setBusqueda}
      articulosAMostrar={articulosAMostrar} sugerencias={sugerencias} seleccionados={seleccionados} toggleArticulo={toggleArticulo}
      guardando={guardando} handleGuardar={handleGuardar} />
  );
};

export default EnlazarArticulosModal;
