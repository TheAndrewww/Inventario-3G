/**
 * Servicio de lectura de facturas de proveedor con Gemini.
 *
 * Recibe la foto de la factura que entrega el proveedor al descargar el
 * material y devuelve sus renglones ya cruzados contra los artículos de la
 * orden de compra, para que almacén no tenga que capturar SKU por SKU.
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Modelo de texto/visión (distinto al de generación de imágenes de artículos)
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export const isLecturaFacturaEnabled = () => {
    if (!GEMINI_API_KEY) {
        console.log('⚠️ Lectura de facturas no disponible: falta GEMINI_API_KEY');
        return false;
    }
    return true;
};

/**
 * Esquema que se le exige a Gemini. Al forzar JSON evitamos parsear texto libre.
 */
const ESQUEMA_RESPUESTA = {
    type: 'OBJECT',
    properties: {
        proveedor: { type: 'STRING' },
        folio: { type: 'STRING' },
        fecha: { type: 'STRING' },
        total: { type: 'NUMBER' },
        renglones: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    descripcion: { type: 'STRING' },
                    cantidad: { type: 'NUMBER' },
                    unidad: { type: 'STRING' },
                    precio_unitario: { type: 'NUMBER' },
                    codigo_proveedor: { type: 'STRING' },
                    codigo_barras: { type: 'STRING' },
                    detalle_id: { type: 'INTEGER' },
                    confianza: { type: 'NUMBER' },
                    motivo: { type: 'STRING' }
                },
                required: ['descripcion', 'cantidad', 'confianza']
            }
        }
    },
    required: ['renglones']
};

const construirPrompt = (articulosOrden, aprendidos) => {
    const catalogo = articulosOrden.map(a => (
        `- detalle_id: ${a.detalle_id} | artículo: "${a.nombre}"${a.sku ? ` | SKU interno: ${a.sku}` : ''}` +
        ` | unidad: ${a.unidad} | pedido: ${a.cantidad_solicitada} | pendiente por recibir: ${a.cantidad_pendiente}`
    )).join('\n');

    const equivalencias = aprendidos.length > 0
        ? `\nEquivalencias ya confirmadas antes con este proveedor (úsalas como verdad):\n` +
          aprendidos.map(e => `- El proveedor le llama "${e.sku_proveedor}" al detalle_id ${e.detalle_id}`).join('\n')
        : '';

    return `Eres el auxiliar de almacén de una empresa de lonas y estructuras en México.
Estás leyendo la FACTURA o REMISIÓN que el proveedor entregó al dejar el material.

Tu trabajo tiene dos partes:

1) Transcribir cada renglón de la factura: descripción tal como viene escrita,
   cantidad, unidad, precio unitario, y si aparece, el código del proveedor y el
   código de barras del producto.

2) Cruzar cada renglón contra la orden de compra de abajo. El proveedor usa
   nombres más largos que nosotros: "TUERCA HEXAGONAL GALVANIZADA 1/2\\"" es
   nuestra "TUERCA 1/2". Fíjate en medidas, material y tipo de pieza.
   - Si identificas el artículo, pon su detalle_id.
   - Si NO estás seguro, pon detalle_id: 0 y explica en "motivo" por qué dudas.
     Es mucho mejor dejarlo en 0 que adivinar mal: un cruce equivocado mete
     stock al artículo que no era.
   - "confianza" va de 0 a 1: usa 0.9 o más solo cuando la medida y el tipo de
     pieza coincidan sin ambigüedad.

Artículos de la orden de compra:
${catalogo}
${equivalencias}

Reglas:
- No inventes renglones que no estén en la foto.
- Las cantidades son las de la FACTURA, no las de la orden.
- Ignora fletes, IVA, descuentos y cualquier renglón que no sea material.
- Si la foto está borrosa o incompleta, transcribe solo lo que se lea con claridad.`;
};

/**
 * Lee una o varias fotos de la factura y devuelve los renglones cruzados.
 *
 * @param {Array<{buffer: Buffer, mimetype: string}>} imagenes
 * @param {Array} articulosOrden - detalles de la orden con su detalle_id
 * @param {Array} aprendidos - equivalencias previas {sku_proveedor, detalle_id}
 */
export const leerFacturaProveedor = async (imagenes, articulosOrden, aprendidos = []) => {
    if (!isLecturaFacturaEnabled()) {
        throw new Error('La lectura de facturas no está configurada. Falta GEMINI_API_KEY.');
    }

    if (!imagenes || imagenes.length === 0) {
        throw new Error('No se recibió ninguna foto de la factura');
    }

    const partes = [{ text: construirPrompt(articulosOrden, aprendidos) }];

    for (const img of imagenes) {
        partes.push({
            inline_data: {
                mime_type: img.mimetype || 'image/jpeg',
                data: img.buffer.toString('base64')
            }
        });
    }

    const payload = {
        contents: [{ parts: partes }],
        generationConfig: {
            temperature: 0.1, // lectura de documento: queremos literalidad, no creatividad
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: ESQUEMA_RESPUESTA
        }
    };

    console.log(`📄 Leyendo factura con Gemini (${GEMINI_TEXT_MODEL}) · ${imagenes.length} foto(s)`);

    let response;
    try {
        response = await axios.post(
            `${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`,
            payload,
            { headers: { 'Content-Type': 'application/json' }, timeout: 90000 }
        );
    } catch (error) {
        // Los errores de Gemini vienen en el cuerpo; sin esto el almacenista
        // solo vería "Request failed with status code 400".
        const detalle = error.response?.data?.error;
        console.error('❌ Gemini rechazó la lectura:', JSON.stringify(detalle || error.message).substring(0, 300));

        if (detalle?.reason === 'API_KEY_INVALID' || detalle?.message?.includes('API key not valid')) {
            throw new Error('La llave de Gemini no es válida. Revisa GEMINI_API_KEY en el servidor.');
        }
        if (error.response?.status === 429) {
            throw new Error('Gemini está saturado en este momento. Intenta de nuevo en un minuto.');
        }
        if (error.code === 'ECONNABORTED') {
            throw new Error('La lectura de la factura tardó demasiado. Intenta con una foto más ligera.');
        }
        throw new Error(detalle?.message || 'No se pudo leer la factura con la IA');
    }

    const texto = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
        const motivo = response.data?.candidates?.[0]?.finishReason || 'sin contenido';
        throw new Error(`Gemini no devolvió lectura de la factura (${motivo})`);
    }

    let lectura;
    try {
        lectura = JSON.parse(texto);
    } catch (parseError) {
        console.error('Respuesta no parseable de Gemini:', texto.substring(0, 400));
        throw new Error('No se pudo interpretar la lectura de la factura');
    }

    const renglones = (lectura.renglones || []).map(r => ({
        descripcion: (r.descripcion || '').trim(),
        cantidad: parseFloat(r.cantidad) || 0,
        unidad: r.unidad || null,
        precio_unitario: parseFloat(r.precio_unitario) || 0,
        codigo_proveedor: r.codigo_proveedor?.trim() || null,
        codigo_barras: r.codigo_barras?.trim() || null,
        detalle_id: parseInt(r.detalle_id) || null,
        confianza: Math.max(0, Math.min(1, parseFloat(r.confianza) || 0)),
        motivo: r.motivo?.trim() || null
    })).filter(r => r.descripcion && r.cantidad > 0);

    console.log(`✅ Factura leída: ${renglones.length} renglón(es), ${renglones.filter(r => r.detalle_id).length} identificado(s)`);

    return {
        proveedor: lectura.proveedor?.trim() || null,
        folio: lectura.folio?.trim() || null,
        fecha: lectura.fecha?.trim() || null,
        total: parseFloat(lectura.total) || null,
        renglones
    };
};

export default { isLecturaFacturaEnabled, leerFacturaProveedor };
