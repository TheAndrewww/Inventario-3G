import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { confirmarG3 } from '../../diseno-3g/dialogosG3';
import CajonConteoR2 from '../../rediseno2/compras/CajonConteo';

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
        // Diseño 3G: vista previa con las diferencias que ya calculó la pantalla; la petición de después es la misma
        if (!(await confirmarG3({
            titulo: '¿Cerrar el conteo?',
            texto: diferencias.length === 0 ? 'Todo cuadra con lo facturado.' : undefined,
            cambios: diferencias.slice(0, 8).map(d => ({ campo: d.nombre, antes: `${formatCantidad(d.cantidad_recibida)} facturado`, despues: `${formatCantidad(d.real)} contado` })),
            datos: diferencias.length > 8 ? [['Además', `${diferencias.length - 8} artículo(s) más con diferencia`]] : [],
            pasa: diferencias.length === 0 ? [] : [`Se ajustarán ${diferencias.length} artículo(s) y se avisará a Compras.`],
            confirmar: 'Cerrar conteo', cancelar: 'Regresar',
        }))) return;

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
        <CajonConteoR2 onClose={onClose} conteo={conteo} contados={contados} setContados={setContados}
            faltantes={faltantes} sobrantes={sobrantes} guardando={guardando} cerrarConteo={cerrar} />
    );
};

export default ConteoRecepcionModal;
