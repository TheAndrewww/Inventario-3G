/**
 * Avisos a WhatsApp.
 *
 * El Inventario no tiene sesión de WhatsApp propia: deja el aviso en una cola
 * y el bot contable —que sí la tiene— la consulta cada minuto y lo publica.
 *
 * Va en ese sentido (el bot jala) porque el VPS del bot no expone puertos a
 * internet y su panel no tiene contraseña; el inventario, en cambio, ya está
 * publicado con HTTPS. De paso, si el bot está caído los avisos se acumulan
 * en lugar de perderse.
 */

import { AvisoWhatsApp } from '../models/index.js';

// 'requisiciones' = grupo de ALMACÉN/CALIDAD. Ahí no puede salir ni un precio: está
// separado de Compras justo para que quien recibe el material no vea cotizaciones ni
// transferencias. Todo lo que se manda a este destino va sin importes.
const DESTINOS_VALIDOS = ['compras', 'contable', 'produccion', 'requisiciones'];

export const isWhatsAppEnabled = () => !!process.env.WHATSAPP_PUENTE_TOKEN;

/**
 * Encola un mensaje de WhatsApp. Nunca lanza excepción: un aviso que no salió
 * no debe tumbar una recepción de mercancía.
 *
 * @param {string} mensaje - Texto a enviar
 * @param {string} destino - Destino lógico: compras | contable | produccion
 * @returns {Promise<boolean>} - true si quedó encolado
 */
export const enviarWhatsApp = async (mensaje, destino = 'compras') => {
    if (!isWhatsAppEnabled()) {
        console.log('ℹ️ Puente de WhatsApp no configurado, se omite el aviso');
        return false;
    }

    if (!DESTINOS_VALIDOS.includes(destino)) {
        console.error(`⚠️ Destino de WhatsApp no permitido: ${destino}`);
        return false;
    }

    try {
        await AvisoWhatsApp.create({ destino, mensaje: String(mensaje).slice(0, 4000) });
        console.log(`📨 Aviso de WhatsApp encolado (${destino})`);
        return true;
    } catch (error) {
        console.error('⚠️ No se pudo encolar el aviso de WhatsApp:', error.message);
        return false;
    }
};

/**
 * Publica una orden de compra en el grupo para que la autoricen ahí mismo.
 * Va sin importes: al grupo solo le interesa qué se está pidiendo y cuánto.
 */
export const pedirAutorizacionOrden = async (orden) => {
    if (!isWhatsAppEnabled()) return false;

    const articulos = (orden.detalles || []).map(d => {
        const nombre = d.articulo?.nombre || 'Artículo';
        const cantidad = parseFloat(d.cantidad_solicitada) || 0;
        const unidad = d.articulo?.unidad || '';
        return `• ${nombre}: ${cantidad} ${unidad}`.trimEnd();
    });

    const lineas = [
        `🛒 *Orden de compra por autorizar*`,
        `Folio: ${orden.ticket_id}`,
        `Proveedor: ${orden.proveedor?.nombre || 'Sin proveedor'}`,
        orden.creador?.nombre ? `La pidió: ${orden.creador.nombre}` : null,
        '',
        ...articulos,
        '',
        'Reacciona ✅ para autorizar o ❌ para rechazar.'
    ].filter(l => l !== null);

    try {
        await AvisoWhatsApp.create({
            destino: 'compras',
            tipo: 'aprobacion_orden',
            referencia_id: orden.id,
            mensaje: lineas.join('\n').slice(0, 4000)
        });
        console.log(`📨 Orden ${orden.ticket_id} encolada para autorizar por WhatsApp`);
        return true;
    } catch (error) {
        console.error('⚠️ No se pudo encolar la autorización:', error.message);
        return false;
    }
};

// Cuántos artículos se enumeran antes de resumir el resto: el grupo necesita
// saber qué llegó, no leer una orden de 40 renglones en el celular.
const MAX_ARTICULOS_EN_AVISO = 8;

export const construirAvisoLlegoMaterial = ({
    proveedor, ticketOrden, folioFactura, articulos, sinIdentificar, detalle = [], ventanaConteo = false
}) => {
    const mostrados = detalle.slice(0, MAX_ARTICULOS_EN_AVISO).map(a => {
        const cantidad = parseFloat(a.cantidad) || 0;
        const unidad = a.unidad ? ` ${a.unidad}` : '';
        return `• ${a.nombre}: ${cantidad}${unidad}`;
    });
    const restantes = detalle.length - mostrados.length;

    const lineas = [
        `📦 *Llegó material* — ${proveedor || 'proveedor sin identificar'}`,
        `Orden: ${ticketOrden}`,
        folioFactura ? `Factura: ${folioFactura}` : null,
        '',
        ...(mostrados.length > 0 ? mostrados : [`Artículos registrados: ${articulos}`]),
        restantes > 0 ? `…y ${restantes} artículo(s) más (${detalle.length} en total)` : null,
        sinIdentificar > 0 ? `⚠️ ${sinIdentificar} renglón(es) quedaron sin identificar` : null,
        ventanaConteo ? '' : null,
        ventanaConteo
            ? 'El conteo individual se hace durante los próximos 7 días; al cerrar se avisan los faltantes.'
            : null
    ].filter(l => l !== null); // ojo: filter(Boolean) borraría también los renglones en blanco

    return lineas.join('\n');
};

export const avisarComprasLlegoMaterial = async (datos) => {
    const mensaje = construirAvisoLlegoMaterial(datos);
    // El mismo aviso va a los dos grupos: Compras lo necesita para la factura y almacén
    // para contar. Ya viene sin importes, así que se manda tal cual.
    const ok = await enviarWhatsApp(mensaje);
    await enviarWhatsApp(mensaje, 'requisiciones');
    return ok;
};

/**
 * Corte semanal de los conteos cíclicos: qué días de lunes a viernes se
 * cumplieron. Sábado y domingo no cuentan, no se conta en fin de semana.
 *
 * @param {{periodo: string, dias: Array<{nombre: string, cumplio: boolean, contados: number, asignados: number, abierto: boolean}>}}
 */
export const construirReporteConteosCiclicos = ({ periodo, dias }) => {
    const faltaron = dias.filter(d => !d.cumplio);

    const lineas = [`🗓️ *Conteos cíclicos* — semana del ${periodo}`, ''];

    if (faltaron.length === 0) {
        lineas.push('✅ Conteos cíclicos completos');
    } else {
        const nombres = faltaron.map(d => d.nombre);
        const listado = nombres.length === 1
            ? nombres[0]
            : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

        lineas.push(`⚠️ Faltó el conteo cíclico del ${listado}`);
        lineas.push('');
        faltaron.forEach(d => {
            lineas.push(d.abierto
                ? `• ${d.nombre}: ${d.contados} de ${d.asignados} artículo(s)`
                : `• ${d.nombre}: no se abrió el conteo`);
        });
    }

    return lineas.join('\n');
};

export const avisarConteosCiclicosSemana = async (datos) => {
    const mensaje = construirReporteConteosCiclicos(datos);
    const ok = await enviarWhatsApp(mensaje);
    await enviarWhatsApp(mensaje, 'requisiciones');   // el conteo lo hace almacén: es su corte
    return ok;
};

export const avisarComprasFaltantes = async ({ proveedor, ticketOrden, faltantes, sobrantes }) => {
    const lineas = [
        `🔎 *Conteo terminado* — ${proveedor || 'proveedor'}`,
        `Orden: ${ticketOrden}`,
        ''
    ];

    if (faltantes.length === 0 && sobrantes.length === 0) {
        lineas.push('✅ Todo cuadró con lo facturado.');
    } else {
        if (faltantes.length > 0) {
            lineas.push('*Faltantes:*');
            faltantes.forEach(f => lineas.push(`• ${f.nombre}: faltaron ${f.diferencia} ${f.unidad}`));
        }
        if (sobrantes.length > 0) {
            lineas.push('*Sobrantes:*');
            sobrantes.forEach(s => lineas.push(`• ${s.nombre}: llegaron ${s.diferencia} ${s.unidad} de más`));
        }
        lineas.push('', 'Compras: evaluar reclamo al proveedor o cerrar la compra.');
    }

    const mensaje = lineas.join('\n');
    const ok = await enviarWhatsApp(mensaje);
    await enviarWhatsApp(mensaje, 'requisiciones');   // quien contó tiene que ver en qué acabó
    return ok;
};

/**
 * Avisa a ALMACÉN que una orden ya se autorizó: qué se pidió y cuándo se espera.
 * Va sin importes ni proveedor de más: es para que sepan qué va a llegar y lo esperen.
 */
export const avisarRequisicionesOrdenAprobada = async (orden) => {
    if (!isWhatsAppEnabled() || !orden) return false;

    const articulos = (orden.detalles || []).map(d => {
        const nombre = d.articulo?.nombre || 'Artículo';
        const cantidad = parseFloat(d.cantidad_solicitada) || 0;
        const unidad = d.articulo?.unidad || '';
        return `• ${nombre}: ${cantidad} ${unidad}`.trimEnd();
    });

    const llegada = orden.fecha_llegada_estimada
        ? new Date(orden.fecha_llegada_estimada).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
        : null;

    const lineas = [
        '🛒 *Se pidió* — ' + (orden.proveedor?.nombre || 'proveedor por asignar'),
        `Orden: ${orden.ticket_id}`,
        '',
        ...articulos,
        '',
        llegada ? `📅 Llegada estimada: ${llegada}` : '📅 Sin fecha de llegada capturada'
    ].filter(l => l !== null);

    return enviarWhatsApp(lineas.join('\n'), 'requisiciones');
};

export default {
    isWhatsAppEnabled,
    enviarWhatsApp,
    avisarComprasLlegoMaterial,
    avisarComprasFaltantes,
    avisarConteosCiclicosSemana,
    avisarRequisicionesOrdenAprobada
};
