import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { Cajon as CajonR2, CajonCabecera as CajonCabeceraR2 } from '../../rediseno2/fundacion';
import RecibirFacturaR2 from '../../rediseno2/compras/RecibirFactura';

const RecibirConFacturaModal = ({ isOpen, onClose, orden, onSuccess, incrustado = false, alPie = null }) => {
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
                toast(`${identificados} identificados · ${revisar + sin_identificar} por confirmar`, undefined);
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
                renglones_sin_identificar: renglones.filter(r => !r.detalle_id).length,
                // C4 paso 3 · PLA-16: la foto que guardó la lectura (solo con LLEGADA_CON_DATOS en el servidor)
                ...(lectura?.factura?.fotos?.length ? { fotos_factura: lectura.factura.fotos } : {})
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

    const contenidoR2 = (
        <RecibirFacturaR2
            archivos={archivos}
            setArchivos={setArchivos}
            agregarArchivos={agregarArchivos}
            inputArchivoRef={inputArchivoRef}
            analizando={analizando}
            analizar={analizar}
            lectura={lectura}
            renglones={renglones}
            actualizarRenglon={actualizarRenglon}
            asignarArticulo={asignarArticulo}
            incluidos={incluidos}
            excedidos={excedidos}
            registrando={registrando}
            registrar={registrar}
            onClose={onClose}
            alPie={alPie}
        />
    );
    if (incrustado) return contenidoR2;
    return (
        <CajonR2 abierto alCerrar={onClose} ancho="ancho" etiqueta={`Recibir ${orden.ticket_id} con factura`}>
            <CajonCabeceraR2 titulo={`Recibir ${orden.ticket_id}`} dato={orden.proveedor?.nombre || 'Sin proveedor'} alCerrar={onClose} />
            {contenidoR2}
        </CajonR2>
    );
};

export default RecibirConFacturaModal;
