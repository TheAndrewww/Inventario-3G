import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertTriangle, Wrench, Package, ChevronDown, ChevronRight, Users, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';
import camionetasService from '../../services/camionetas.service';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <FileSpreadsheet size={22} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Importar desde Excel</h2>
              <p className="text-sm text-gray-500">
                {paso === 1 ? 'Selecciona tu archivo' : `${hojas.length} hojas · ${totalItems} ítems detectados`}
              </p>
            </div>
          </div>
          <button onClick={() => { resetear(); onClose(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Paso 1: Seleccionar archivo */}
          {paso === 1 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                <Upload size={32} className="text-emerald-500" />
              </div>
              <p className="text-gray-600 text-center max-w-sm">
                Selecciona tu archivo Excel. Se detectarán automáticamente las hojas de <strong>herramientas</strong> y <strong>materiales</strong>.
              </p>
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center gap-2">
                <Upload size={18} />
                Seleccionar archivo .xlsx
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Paso 2: Mapear hojas a equipos */}
          {paso === 2 && (
            <div className="space-y-4">
              {/* Info */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-sm text-blue-700">
                <AlertTriangle size={16} />
                Asigna cada hoja al equipo correspondiente. Si dejas vacío, los ítems solo se importarán al catálogo global.
              </div>

              {/* Resumen rápido */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <Wrench size={20} className="text-blue-600" />
                  <div>
                    <p className="font-bold text-blue-800">{hojasHerramienta.length} hoja{hojasHerramienta.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-blue-600">Herramientas</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                  <Package size={20} className="text-amber-600" />
                  <div>
                    <p className="font-bold text-amber-800">{hojasMaterial.length} hoja{hojasMaterial.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-amber-600">Materiales (stock mínimo)</p>
                  </div>
                </div>
              </div>

              {/* Lista de hojas */}
              <div className="space-y-2">
                {hojas.map((hoja, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Hoja header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <button onClick={() => toggleHojaExpanded(idx)} className="text-gray-500 hover:text-gray-700">
                        {hoja.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                        hoja.tipo === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {hoja.tipo === 'material' ? 'M' : 'H'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{hoja.nombre}</p>
                        <p className="text-xs text-gray-400">{hoja.items.length} ítems · {hoja.equipoNombre || 'Sin equipo detectado'}</p>
                      </div>
                      <select
                        value={hoja.equipoId}
                        onChange={(e) => setEquipoParaHoja(idx, e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-[180px]"
                      >
                        <option value="">— Solo catálogo —</option>
                        {equipos.map((eq) => (
                          <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Items preview */}
                    {hoja.expanded && (
                      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {hoja.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{item.nombre}</span>
                              {item.especificacion && (
                                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.especificacion}</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-gray-500">×{item.cantidad_requerida}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {paso === 2 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button onClick={resetear} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">
              ← Cambiar archivo
            </button>
            <div className="flex items-center gap-3">
              {hojasConEquipo.length > 0 && (
                <span className="text-sm text-gray-500">
                  <Users size={14} className="inline mr-1" />
                  {hojasConEquipo.length} hoja{hojasConEquipo.length > 1 ? 's' : ''} con equipo asignado
                </span>
              )}
              <button
                onClick={handleImportar}
                disabled={importando}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
              >
                {importando ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Importar {totalItems} ítems
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportarChecklistModal;
