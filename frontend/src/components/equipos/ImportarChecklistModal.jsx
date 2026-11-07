import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import camionetasService from '../../services/camionetas.service';
import { CajonImportarChecklist } from '../../rediseno2/gestion/CajonesChecklist';

/**
 * Parsea una hoja individual del Excel.
 * Soporta formato de 2 columnas lado a lado.
 */
const parsearHoja = (sheet, tipoDefault = 'herramienta') => {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const items = [];
  let seccionIzq = '';
  let seccionDer = '';

  // Detectar el nombre del equipo (segunda fila usualmente)
  let equipoNombre = '';
  for (let i = 0; i < Math.min(3, raw.length); i++) {
    const row = raw[i];
    const text = String(row?.[0] || '').trim();
    if (text.includes('/') || text.includes('INSTALACIÓN') || text.includes('MANTENIMIENTO')) {
      equipoNombre = text;
      break;
    }
  }

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;

    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim();
    const colC = String(row[2] || '').trim();
    const colE = String(row[4] || '').trim();
    const colF = String(row[5] || '').trim();
    const colG = String(row[6] || '').trim();

    // Detectar headers de sección
    const esHeaderIzq = colA && !colC && !colB && colA === colA.toUpperCase() && colA.length > 2 
      && !colA.includes('LISTA') && !colA.includes('FIRMA');
    const esHeaderDer = colE && !colG && !colF && colE === colE.toUpperCase() && colE.length > 2 
      && !colE.includes('LISTA') && !colE.includes('FIRMA');

    if (esHeaderIzq) seccionIzq = colA;
    if (esHeaderDer) seccionDer = colE;

    // Filtrar headers y filas irrelevantes
    const skipWords = ['LISTA DE', 'INSTALACIÓN', 'HERRAMIENTA', 'CANTIDAD', 'MATERIAL', 'FIRMA', 'MANTENIMIENTO'];
    const shouldSkipA = skipWords.some(w => colA.toUpperCase().startsWith(w)) && !colC;
    const shouldSkipE = skipWords.some(w => colE.toUpperCase().startsWith(w)) && !colG;

    // Procesar lado izquierdo
    if (colA && colC && !esHeaderIzq && !shouldSkipA) {
      const cantidad = parseInt(colC) || 0;
      if (cantidad > 0) {
        items.push({
          nombre: colA,
          especificacion: colB || null,
          seccion: seccionIzq || 'GENERAL',
          tipo: tipoDefault,
          cantidad_requerida: cantidad
        });
      }
    }

    // Procesar lado derecho
    if (colE && colG && !esHeaderDer && !shouldSkipE) {
      const cantidad = parseInt(colG) || 0;
      if (cantidad > 0) {
        items.push({
          nombre: colE,
          especificacion: colF || null,
          seccion: seccionDer || 'GENERAL',
          tipo: tipoDefault,
          cantidad_requerida: cantidad
        });
      }
    }
  }

  return { items, equipoNombre };
};

/**
 * Detecta si una hoja es de herramientas o materiales por su nombre.
 */
const detectarTipoHoja = (nombreHoja) => {
  const n = nombreHoja.toUpperCase();
  if (n.includes('MATERIAL')) return 'material';
  if (n.includes('HERRAMIENTA')) return 'herramienta';
  return 'herramienta';
};

const ImportarChecklistModal = ({ isOpen, onClose, onImportado }) => {
  const [archivo, setArchivo] = useState(null);
  const [hojas, setHojas] = useState([]); // { nombre, tipo, items, equipoNombre, equipoId, expanded }
  const [importando, setImportando] = useState(false);
  const [paso, setPaso] = useState(1); // 1: seleccionar, 2: mapear hojas, 3: preview
  const [equipos, setEquipos] = useState([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);

  useEffect(() => {
    if (isOpen) {
      cargarEquipos();
    }
  }, [isOpen]);

  const cargarEquipos = async () => {
    setCargandoEquipos(true);
    try {
      const response = await camionetasService.obtenerTodos();
      const data = response.data || response;
      setEquipos(data.camionetas || []);
    } catch (error) {
      console.error('Error al cargar equipos:', error);
    } finally {
      setCargandoEquipos(false);
    }
  };

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArchivo(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const hojasDetectadas = workbook.SheetNames.map((nombre) => {
          const tipo = detectarTipoHoja(nombre);
          const sheet = workbook.Sheets[nombre];
          const { items, equipoNombre } = parsearHoja(sheet, tipo);

          return {
            nombre,
            tipo,
            items,
            equipoNombre,
            equipoId: '', // el usuario lo asigna
            expanded: false
          };
        }).filter(h => h.items.length > 0);

        if (hojasDetectadas.length === 0) {
          toast.error('No se encontraron ítems en el archivo');
          return;
        }

        setHojas(hojasDetectadas);
        setPaso(2);

        const totalItems = hojasDetectadas.reduce((s, h) => s + h.items.length, 0);
        toast.success(`${totalItems} ítems en ${hojasDetectadas.length} hojas`);
      } catch (error) {
        console.error('Error al parsear Excel:', error);
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const setEquipoParaHoja = (idx, equipoId) => {
    setHojas(prev => prev.map((h, i) => i === idx ? { ...h, equipoId } : h));
  };

  const toggleHojaExpanded = (idx) => {
    setHojas(prev => prev.map((h, i) => i === idx ? { ...h, expanded: !h.expanded } : h));
  };

  const handleImportar = async () => {
    setImportando(true);
    try {
      // 1. Recopilar todos los ítems únicos y enviarlos al catálogo
      const todosLosItems = [];
      const itemsYaAgregados = new Set();

      hojas.forEach((hoja) => {
        hoja.items.forEach((item) => {
          const key = `${item.nombre}|${item.especificacion || ''}|${item.tipo}`;
          if (!itemsYaAgregados.has(key)) {
            itemsYaAgregados.add(key);
            todosLosItems.push(item);
          }
        });
      });

      // Importar al catálogo global
      await checklistService.importarItems(todosLosItems);

      // 2. Refetch para obtener IDs
      const respItems = await checklistService.listarItems();
      const itemsDB = respItems.data?.items || respItems.items || [];

      // 3. Asignar a cada equipo
      let equiposAsignados = 0;
      for (const hoja of hojas) {
        if (!hoja.equipoId) continue;

        const asignaciones = [];
        for (const item of hoja.items) {
          // Buscar el ítem en la BD por nombre + especificación
          const match = itemsDB.find(db =>
            db.nombre === item.nombre &&
            (db.especificacion || null) === (item.especificacion || null)
          );
          if (match) {
            asignaciones.push({
              checklist_item_id: match.id,
              cantidad_requerida: item.cantidad_requerida
            });
          }
        }

        if (asignaciones.length > 0) {
          await checklistService.asignarItemsAEquipo(hoja.equipoId, asignaciones);
          equiposAsignados++;
        }
      }

      const totalItems = todosLosItems.length;
      if (equiposAsignados > 0) {
        toast.success(`${totalItems} ítems importados y asignados a ${equiposAsignados} equipo${equiposAsignados > 1 ? 's' : ''}`);
      } else {
        toast.success(`${totalItems} ítems importados al catálogo`);
      }

      onImportado?.();
      onClose();
    } catch (error) {
      console.error('Error al importar:', error);
      toast.error('Error al importar ítems');
    } finally {
      setImportando(false);
    }
  };

  const resetear = () => {
    setArchivo(null);
    setHojas([]);
    setPaso(1);
  };

  if (!isOpen) return null;

  const hojasHerramienta = hojas.filter(h => h.tipo === 'herramienta');
  const hojasMaterial = hojas.filter(h => h.tipo === 'material');
  const totalItems = hojas.reduce((s, h) => s + h.items.length, 0);
  const hojasConEquipo = hojas.filter(h => h.equipoId);

  return (
    <CajonImportarChecklist onClose={() => { resetear(); onClose(); }} paso={paso} hojas={hojas} totalItems={totalItems}
      hojasHerramienta={hojasHerramienta} hojasMaterial={hojasMaterial} hojasConEquipo={hojasConEquipo} equipos={equipos}
      importando={importando} handleFileChange={handleFileChange} setEquipoParaHoja={setEquipoParaHoja}
      toggleHojaExpanded={toggleHojaExpanded} handleImportar={handleImportar} resetear={resetear} />
  );
};

export default ImportarChecklistModal;
