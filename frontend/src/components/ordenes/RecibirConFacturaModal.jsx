import React, { useMemo, useRef, useState } from 'react';
import { X, Camera, Upload, Sparkles, AlertTriangle, CheckCircle2, HelpCircle, Trash2, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';

const ESTADOS = {
    identificado: { texto: 'Identificado', clase: 'bg-green-100 text-green-800 border-green-200', Icono: CheckCircle2 },
    revisar: { texto: 'Revisar', clase: 'bg-yellow-100 text-yellow-800 border-yellow-200', Icono: HelpCircle },
    sin_identificar: { texto: 'Sin identificar', clase: 'bg-red-100 text-red-800 border-red-200', Icono: AlertTriangle }
};

const formatCantidad = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
};

const RecibirConFacturaModal = ({ isOpen, onClose, orden, onSuccess }) => {
    const [archivos, setArchivos] = useState([]);
    const [analizando, setAnalizando] = useState(false);
    const [registrando, setRegistrando] = useState(false);
    const [lectura, setLectura] = useState(null);
    const [renglones, setRenglones] = useState([]);
    const inputArchivoRef = useRef(null);

    if (!isOpen) return null;

    const agregarArchivos = (lista) => {
        const nuevos = Array.from(lista || []).filter(f => f.type.startsWith('image/'));
        if (nuevos.length === 0) return;
        setArchivos(prev => [...prev, ...nuevos].slice(0, 5));
    };

    const analizar = async () => {
        if (archivos.length === 0) {
            toast.error('Toma o sube la foto de la factura');
            return;
        }

        try {
            setAnalizando(true);
            const data = await ordenesCompraService.analizarFactura(orden.id, archivos);
            setLectura(data);
            setRenglones(data.renglones.map((r, idx) => ({
                ...r,
                key: idx,
                incluir: r.estado !== 'sin_identificar',
                cantidad_recibida: r.cantidad
            })));

            const { identificados, revisar, sin_identificar } = data.resumen;
            if (sin_identificar > 0 || revisar > 0) {
                toast(`${identificados} identificados · ${revisar + sin_identificar} por confirmar`, { icon: '🔎' });
            } else {
                toast.success(`${identificados} renglón(es) identificados`);
            }
        } catch (error) {
            console.error('Error al analizar factura:', error);
            toast.error(error.response?.data?.message || 'No se pudo leer la factura');
        } finally {
            setAnalizando(false);
        }
    };

    const actualizarRenglon = (key, cambios) => {
        setRenglones(prev => prev.map(r => r.key === key ? { ...r, ...cambios } : r));
    };

    // Al reasignar a mano, el renglón pasa a estar identificado
    const asignarArticulo = (key, detalleId) => {
        const destino = lectura.articulos_orden.find(a => a.detalle_id === parseInt(detalleId));
        if (!destino) {
            actualizarRenglon(key, {
                detalle_id: null, articulo_id: null, articulo_nombre: null,
                estado: 'sin_identificar', incluir: false
            });
            return;
        }
        actualizarRenglon(key, {
            detalle_id: destino.detalle_id,
            articulo_id: destino.articulo_id,
            articulo_nombre: destino.nombre,
            articulo_unidad: destino.unidad,
            cantidad_pendiente: destino.cantidad_pendiente,
            estado: 'identificado',
            origen: 'manual',
            incluir: true
        });
    };

    const incluidos = useMemo(
        () => renglones.filter(r => r.incluir && r.detalle_id && parseFloat(r.cantidad_recibida) > 0),
        [renglones]
    );

    const excedidos = useMemo(
        () => incluidos.filter(r => r.cantidad_pendiente != null && parseFloat(r.cantidad_recibida) > r.cantidad_pendiente),
        [incluidos]
    );

    const registrar = async () => {
        if (incluidos.length === 0) {
            toast.error('No hay renglones para registrar');
            return;
        }
        if (excedidos.length > 0) {
            toast.error(`"${excedidos[0].articulo_nombre}" excede lo pendiente de la orden`);
            return;
        }

        try {
            setRegistrando(true);

            // 1) Aprender las equivalencias (si falla, la recepción sigue)
            try {
                await ordenesCompraService.aprenderCruce(orden.id, incluidos.map(r => ({
                    articulo_id: r.articulo_id,
                    descripcion_proveedor: r.descripcion,
                    codigo_proveedor: r.codigo_proveedor,
                    codigo_barras: r.codigo_barras,
                    precio_unitario: r.precio_unitario
                })));
            } catch (aprendError) {
                console.error('No se pudieron guardar las equivalencias:', aprendError);
            }

            // 2) Registrar la recepción con el flujo de siempre
            const respuesta = await ordenesCompraService.recibirMercancia(orden.id, {
                articulos: incluidos.map(r => ({
                    detalle_id: r.detalle_id,
                    cantidad_recibida: parseFloat(r.cantidad_recibida),
                    observaciones: r.descripcion ? `Factura: ${r.descripcion}` : null
                })),
                observaciones_generales: lectura?.factura?.folio
                    ? `Recepción por factura ${lectura.factura.folio}`
                    : 'Recepción por foto de factura',
                // Solo esta vía abre la ventana de 7 días para contar y reclamar
                origen: 'factura',
                folio_factura: lectura?.factura?.folio || null,
                renglones_sin_identificar: renglones.filter(r => !r.detalle_id).length
            });

            toast.success(respuesta.message || 'Recepción registrada');
            if (onSuccess) onSuccess(respuesta.data);
            onClose();
        } catch (error) {
            console.error('Error al registrar recepción:', error);
            toast.error(error.response?.data?.message || 'Error al registrar la recepción');
        } finally {
            setRegistrando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Encabezado */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles size={20} className="text-purple-600" />
                            Recibir con factura
                        </h2>
                        <p className="text-sm text-gray-500 truncate">
                            {orden.ticket_id} · {orden.proveedor?.nombre || 'Sin proveedor'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {/* Paso 1: la foto */}
                    {!lectura && (
                        <div>
                            <p className="text-sm text-gray-600 mb-4">
                                Toma la foto de la factura o remisión que entregó el proveedor. La IA la lee,
                                la cruza contra esta orden y solo te pregunta lo que no pueda identificar.
                            </p>

                            <div
                                onClick={() => inputArchivoRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/40 transition-colors"
                            >
                                <Camera size={40} className="mx-auto text-gray-400 mb-3" />
                                <p className="font-medium text-gray-700">Toca para tomar la foto o subir el archivo</p>
                                <p className="text-xs text-gray-500 mt-1">Hasta 5 fotos si la factura tiene varias hojas</p>
                            </div>

                            <input
                                ref={inputArchivoRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                className="hidden"
                                onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ''; }}
                            />

                            {archivos.length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                                    {archivos.map((archivo, idx) => (
                                        <div key={idx} className="relative group">
                                            <img
                                                src={URL.createObjectURL(archivo)}
                                                alt={`Factura ${idx + 1}`}
                                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                            />
                                            <button
                                                onClick={() => setArchivos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Paso 2: relacionar */}
                    {lectura && (
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                                    Factura {lectura.factura.folio || 's/folio'}
                                </span>
                                {lectura.factura.proveedor && (
                                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                                        {lectura.factura.proveedor}
                                    </span>
                                )}
                                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800">
                                    {lectura.resumen.identificados} identificados
                                </span>
                                {lectura.resumen.revisar > 0 && (
                                    <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                        {lectura.resumen.revisar} por confirmar
                                    </span>
                                )}
                                {lectura.resumen.sin_identificar > 0 && (
                                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800">
                                        {lectura.resumen.sin_identificar} sin identificar
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                {renglones.map(r => {
                                    const info = ESTADOS[r.estado] || ESTADOS.sin_identificar;
                                    const Icono = info.Icono;
                                    const excede = r.cantidad_pendiente != null && parseFloat(r.cantidad_recibida) > r.cantidad_pendiente;

                                    return (
                                        <div
                                            key={r.key}
                                            className={`border rounded-lg p-3 ${r.incluir ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-60'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={r.incluir}
                                                    disabled={!r.detalle_id}
                                                    onChange={(e) => actualizarRenglon(r.key, { incluir: e.target.checked })}
                                                    className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    {/* Lo que dice la factura */}
                                                    <p className="font-medium text-gray-900">{r.descripcion}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Factura: {formatCantidad(r.cantidad)} {r.unidad || ''}
                                                        {r.precio_unitario > 0 && ` · $${r.precio_unitario}`}
                                                        {r.codigo_proveedor && ` · cód. ${r.codigo_proveedor}`}
                                                        {r.codigo_barras && ` · barras ${r.codigo_barras}`}
                                                    </p>

                                                    {/* Con qué artículo se cruzó */}
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${info.clase}`}>
                                                            <Icono size={12} />
                                                            {info.texto}
                                                        </span>

                                                        <select
                                                            value={r.detalle_id || ''}
                                                            onChange={(e) => asignarArticulo(r.key, e.target.value)}
                                                            className={`text-sm border rounded-lg px-2 py-1.5 flex-1 min-w-[200px] ${r.detalle_id ? 'border-gray-300' : 'border-red-300 bg-red-50'}`}
                                                        >
                                                            <option value="">— Elegir artículo de la orden —</option>
                                                            {lectura.articulos_orden.map(a => (
                                                                <option key={a.detalle_id} value={a.detalle_id}>
                                                                    {a.nombre} (pendiente {formatCantidad(a.cantidad_pendiente)} {a.unidad})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {r.motivo && r.estado !== 'identificado' && (
                                                        <p className="text-xs text-gray-500 mt-1 italic">{r.motivo}</p>
                                                    )}
                                                </div>

                                                {/* Cantidad que entra al stock */}
                                                <div className="shrink-0 text-right">
                                                    <label className="block text-[11px] text-gray-500 mb-1">Entra</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={r.cantidad_recibida}
                                                        onChange={(e) => actualizarRenglon(r.key, { cantidad_recibida: e.target.value })}
                                                        disabled={!r.detalle_id}
                                                        className={`w-24 px-2 py-1.5 text-right border rounded-lg font-semibold ${excede ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                                                    />
                                                    {r.cantidad_pendiente != null && (
                                                        <p className={`text-[11px] mt-1 ${excede ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                                                            pendiente {formatCantidad(r.cantidad_pendiente)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-xs text-gray-500 mt-4">
                                Al registrar se guarda cómo le llama este proveedor a cada artículo, para que la próxima
                                factura se cruce sola. Si la factura trae un código de barras distinto al nuestro, se le
                                manda al administrador para que él decida si lo reemplaza.
                            </p>
                        </div>
                    )}
                </div>

                {/* Pie */}
                <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-500 min-w-0">
                        {lectura
                            ? `${incluidos.length} renglón(es) entran al stock`
                            : `${archivos.length} foto(s) seleccionada(s)`}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancelar
                        </button>
                        {!lectura ? (
                            <button
                                onClick={analizar}
                                disabled={analizando || archivos.length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                <Sparkles size={18} className={analizando ? 'animate-pulse' : ''} />
                                {analizando ? 'Leyendo la factura...' : 'Leer factura'}
                            </button>
                        ) : (
                            <button
                                onClick={registrar}
                                disabled={registrando || incluidos.length === 0 || excedidos.length > 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                <PackageCheck size={18} />
                                {registrando ? 'Registrando...' : 'Registrar recepción'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecibirConFacturaModal;
