/**
 * Envío de avisos a WhatsApp a través del bot contable (WAHA).
 *
 * El Inventario no tiene sesión de WhatsApp propia: le pide al bot que ya
 * está conectado que publique el mensaje en el grupo correspondiente.
 * Si no está configurado, no truena nada — simplemente no manda WhatsApp
 * y los avisos siguen llegando por push y correo.
 */

import axios from 'axios';

const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL;
const WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN;

export const isWhatsAppEnabled = () => !!(WEBHOOK_URL && WEBHOOK_TOKEN);

/**
 * Manda un mensaje a WhatsApp. Nunca lanza excepción: un aviso que no salió
 * no debe tumbar una recepción de mercancía.
 *
 * El destino es lógico ('compras', 'contable'), no un número: el bot contable
 * es quien sabe a qué grupo corresponde. Así el inventario no puede escribirle
 * a un chat arbitrario ni necesita conocer los JID.
 *
 * @param {string} mensaje - Texto a enviar
 * @param {string} destino - Destino lógico (default: compras)
 * @returns {Promise<boolean>} - true si se envió
 */
export const enviarWhatsApp = async (mensaje, destino = 'compras') => {
    if (!isWhatsAppEnabled()) {
        console.log('ℹ️ WhatsApp no configurado, se omite el aviso');
        return false;
    }

    try {
        await axios.post(
            WEBHOOK_URL,
            { destino, mensaje, origen: 'inventario-3g' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${WEBHOOK_TOKEN}`
                },
                timeout: 15000
            }
        );
        console.log(`✅ Aviso enviado por WhatsApp (${destino})`);
        return true;
    } catch (error) {
        const detalle = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error('⚠️ No se pudo enviar el WhatsApp:', detalle);
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
