import React, { useMemo, useState } from 'react';
import { X, ClipboardCheck, AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';

const formatCantidad = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
};

/**
 * Conteo individual de una recepción: almacén captura lo que realmente contó
 * y el sistema ajusta el stock y reporta faltantes a compras.
 */
const ConteoRecepcionModal = ({ isOpen, onClose, conteo, onSuccess }) => {
    const [contados, setContados] = useState(() => {
        const inicial = {};
        (conteo?.articulos || []).forEach(a => { inicial[a.detalle_id] = a.cantidad_recibida; });
        return inicial;
    });
    const [guardando, setGuardando] = useState(false);

    if (!isOpen || !conteo) return null;

    const diferencias = useMemo(() => (
        conteo.articulos
            .map(a => {
                const real = parseFloat(contados[a.detalle_id]);
                if (isNaN(real)) return null;
                const diferencia = parseFloat((real - a.cantidad_recibida).toFixed(2));
                return diferencia === 0 ? null : { ...a, real, diferencia };
            })
            .filter(Boolean)
    ), [contados, conteo.articulos]);

    const faltantes = diferencias.filter(d => d.diferencia < 0);
    const sobrantes = diferencias.filter(d => d.diferencia > 0);

    const cerrar = async () => {
        const mensaje = diferencias.length === 0
            ? '¿Cerrar el conteo? Todo cuadra con lo facturado.'
            : `¿Cerrar el conteo? Se ajustarán ${diferencias.length} artículo(s) y se avisará a Compras.`;
        if (!window.confirm(mensaje)) return;

        try {
            setGuardando(true);
            const respuesta = await ordenesCompraService.cerrarConteo(
                conteo.id,
                conteo.articulos.map(a => ({
                    detalle_id: a.detalle_id,
                    cantidad_real: parseFloat(contados[a.detalle_id]) || 0
                }))
            );
            toast.success(respuesta.message || 'Conteo cerrado');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error al cerrar el conteo:', error);
            toast.error(error.response?.data?.message || 'Error al cerrar el conteo');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardCheck size={20} className="text-blue-600" />
                            Conteo de {conteo.ticket_id}
                        </h2>
                        <p className="text-sm text-gray-500 truncate">
                            {conteo.proveedor || 'Sin proveedor'} ·{' '}
                            {conteo.vencido
                                ? 'Ventana vencida'
                                : `${conteo.dias_restantes} día(s) para reclamar`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <p className="text-sm text-gray-600 mb-4">
                        Captura lo que realmente contaste. Lo que difiera de la factura se ajusta en el
                        inventario y se le reporta a Compras para reclamar al proveedor.
                    </p>

                    <div className="space-y-2">
                        {conteo.articulos.map(a => {
                            const real = parseFloat(contados[a.detalle_id]);
                            const diferencia = isNaN(real) ? 0 : parseFloat((real - a.cantidad_recibida).toFixed(2));

                            return (
                                <div
                                    key={a.detalle_id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${diferencia < 0 ? 'border-red-200 bg-red-50'
                                        : diferencia > 0 ? 'border-amber-200 bg-amber-50'
                                            : 'border-gray-200'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 truncate">{a.nombre}</p>
                                        <p className="text-xs text-gray-500">
                                            Facturado: {formatCantidad(a.cantidad_recibida)} {a.unidad}
                                            {' · '}pedido {formatCantidad(a.cantidad_solicitada)}
                                        </p>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <label className="block text-[11px] text-gray-500 mb-1">Contado</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={contados[a.detalle_id] ?? ''}
                                            onChange={(e) => setContados(prev => ({ ...prev, [a.detalle_id]: e.target.value }))}
                                            className="w-24 px-2 py-1.5 text-right border border-gray-300 rounded-lg font-semibold"
                                        />
                                    </div>

                                    <div className="w-20 text-right shrink-0">
                                        {diferencia !== 0 && (
                                            <span className={`text-sm font-semibold ${diferencia < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                                {diferencia > 0 ? '+' : ''}{formatCantidad(diferencia)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {(faltantes.length > 0 || sobrantes.length > 0) && (
                        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                            <p className="font-medium text-gray-900 flex items-center gap-2 mb-1">
                                <AlertTriangle size={16} className="text-amber-600" />
                                Se reportará a Compras
                            </p>
                            {faltantes.length > 0 && (
                                <p className="text-gray-600">
                                    Faltantes: {faltantes.map(f => `${f.nombre} (${formatCantidad(Math.abs(f.diferencia))} ${f.unidad})`).join(', ')}
                                </p>
                            )}
                            {sobrantes.length > 0 && (
                                <p className="text-gray-600">
                                    Sobrantes: {sobrantes.map(s => `${s.nombre} (${formatCantidad(s.diferencia)} ${s.unidad})`).join(', ')}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={14} />
                        Si no lo cierras, se cierra solo al cumplir los 7 días
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancelar
                        </button>
                        <button
                            onClick={cerrar}
                            disabled={guardando}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                        >
                            <ClipboardCheck size={18} />
                            {guardando ? 'Cerrando...' : 'Cerrar conteo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConteoRecepcionModal;
