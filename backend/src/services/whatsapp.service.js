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

const DESTINOS_VALIDOS = ['compras', 'contable'];

export const isWhatsAppEnabled = () => !!process.env.WHATSAPP_PUENTE_TOKEN;

/**
 * Encola un mensaje de WhatsApp. Nunca lanza excepción: un aviso que no salió
 * no debe tumbar una recepción de mercancía.
 *
 * @param {string} mensaje - Texto a enviar
 * @param {string} destino - Destino lógico: compras | contable
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

export const avisarComprasLlegoMaterial = async ({ proveedor, ticketOrden, folioFactura, articulos, sinIdentificar }) => {
    const lineas = [
        `📦 *Llegó material* — ${proveedor || 'proveedor sin identificar'}`,
        `Orden: ${ticketOrden}`,
        folioFactura ? `Factura: ${folioFactura}` : null,
        `Artículos registrados: ${articulos}`,
        sinIdentificar > 0 ? `⚠️ ${sinIdentificar} renglón(es) quedaron sin identificar` : null,
        '',
        'El conteo individual se hace durante los próximos 7 días; al cerrar se avisan los faltantes.'
    ].filter(l => l !== null); // ojo: filter(Boolean) borraría también los renglones en blanco

    return enviarWhatsApp(lineas.join('\n'));
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

    return enviarWhatsApp(lineas.join('\n'));
};

export default { isWhatsAppEnabled, enviarWhatsApp, avisarComprasLlegoMaterial, avisarComprasFaltantes };
