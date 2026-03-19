import React, { useState, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import checklistService from '../../services/checklist.service';

/**
 * Parsea el Excel de Material y Herramienta con formato de 2 columnas lado a lado.
 * Columnas: A=HERRAMIENTA, B=spec, C=CANTIDAD, D=vacío, E=HERRAMIENTA, F=spec, G=CANTIDAD
 */
const parsearExcel = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const items = [];
  let seccionIzq = '';
  let seccionDer = '';

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;

    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim();
    const colC = String(row[2] || '').trim();
    const colE = String(row[4] || '').trim();
    const colF = String(row[5] || '').trim();
    const colG = String(row[6] || '').trim();

    // Detectar headers de sección (tienen texto en A pero no cantidad en C)
    // y no es un ítem normal
    const esHeaderIzq = colA && !colC && !colB && colA === colA.toUpperCase() && colA.length > 2;
    const esHeaderDer = colE && !colG && !colF && colE === colE.toUpperCase() && colE.length > 2;

    if (esHeaderIzq) {
      seccionIzq = colA;
    }

    if (esHeaderDer) {
      seccionDer = colE;
    }

    // Procesar lado izquierdo
    if (colA && colC && !esHeaderIzq) {
      const cantidad = parseInt(colC) || 1;
      if (cantidad > 0 && colA !== 'LISTA DE HERRAMIENTA' && !colA.includes('INSTALACIÓN')) {
        items.push({
          nombre: colA,
          especificacion: colB || null,
          seccion: seccionIzq || 'GENERAL',
          tipo: determinarTipo(seccionIzq, colA),
          cantidad_requerida: cantidad
        });
      }
    }

    // Procesar lado derecho
    if (colE && colG && !esHeaderDer) {
      const cantidad = parseInt(colG) || 1;
      if (cantidad > 0 && colE !== 'FIRMA') {
        items.push({
          nombre: colE,
          especificacion: colF || null,
          seccion: seccionDer || 'GENERAL',
          tipo: determinarTipo(seccionDer, colE),
          cantidad_requerida: cantidad
        });
      }
    }
  }

  return items;
};

const determinarTipo = (seccion, nombre) => {
  const sec = (seccion || '').toUpperCase();
  const nom = (nombre || '').toUpperCase();

  if (sec.includes('BROCA') || sec.includes('PUNTA') || nom.includes('DISCO')) return 'material';
  if (sec.includes('EPP') || sec.includes('PROTECCION')) return 'herramienta';
  return 'herramienta';
};

const ImportarChecklistModal = ({ isOpen, onClose, onImportado }) => {
  const [archivo, setArchivo] = useState(null);
  const [itemsPreview, setItemsPreview] = useState([]);
  const [importando, setImportando] = useState(false);
  const [paso, setPaso] = useState(1); // 1: seleccionar archivo, 2: preview

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArchivo(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const items = parsearExcel(workbook);

        if (items.length === 0) {
          toast.error('No se encontraron ítems en el archivo');
          return;
        }

        setItemsPreview(items);
        setPaso(2);
        toast.success(`${items.length} ítems encontrados`);
      } catch (error) {
        console.error('Error al parsear Excel:', error);
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImportar = async () => {
    if (itemsPreview.length === 0) return;

    setImportando(true);
    try {
      const response = await checklistService.importarItems(itemsPreview);
      toast.success(response.data?.message || `${itemsPreview.length} ítems importados`);
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
    setItemsPreview([]);
    setPaso(1);
  };

  if (!isOpen) return null;

  // Agrupar por sección para preview
  const porSeccion = itemsPreview.reduce((acc, item) => {
    const sec = item.seccion || 'SIN SECCIÓN';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <FileSpreadsheet size={22} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Importar Checklist desde Excel</h2>
              <p className="text-sm text-gray-500">Paso {paso} de 2</p>
            </div>
          </div>
          <button onClick={() => { resetear(); onClose(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {paso === 1 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                <Upload size={32} className="text-emerald-500" />
              </div>
              <p className="text-gray-600 text-center max-w-sm">
                Selecciona el archivo Excel con la lista de herramientas y materiales del equipo
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
              {archivo && (
                <p className="text-sm text-gray-500 mt-2">📄 {archivo.name}</p>
              )}
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-sm text-blue-700">
                <AlertTriangle size={16} />
                Se encontraron <strong>{itemsPreview.length}</strong> ítems en <strong>{Object.keys(porSeccion).length}</strong> secciones
              </div>

              {Object.entries(porSeccion).map(([seccion, items]) => (
                <div key={seccion} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-700 uppercase tracking-wider">
                    {seccion} ({items.length})
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                            item.tipo === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.tipo === 'material' ? 'M' : 'H'}
                          </span>
                          <span className="font-medium text-gray-800">{item.nombre}</span>
                          {item.especificacion && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {item.especificacion}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          ×{item.cantidad_requerida}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {paso === 2 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button onClick={resetear} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">
              ← Cambiar archivo
            </button>
            <button
              onClick={handleImportar}
              disabled={importando}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
            >
              {importando ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Importando...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Importar {itemsPreview.length} ítems
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportarChecklistModal;
