/**
 * B1 paso 1 · PLA-14 — POST /api/sistemas/v1/bitacora-avisos (origen «finanzas», alcance «bitacora.escribir»).
 *
 * Finanzas (Julia, FIN-09) anota aquí cada aviso que Carla o Julia mandaron a Producción y que SÍ salió. Planta solo
 * lo guarda para mostrarlo en Producción › Avisos: no manda nada ni cambia ningún mensaje.
 *
 * Cuerpo (contrato §4.4 del plan):
 *   { origen: "carla"|"julia", destino: "produccion"|"charly"|"susana"|"asesor", texto, enviadoEn (ISO),
 *     proyecto?, obra? (ID 3G «3G-AA-NNNN»), referencia? }
 * Respuestas: 201 { ok, id, duplicado: false, recibido } · 200 { ok, id, duplicado: true } si esa misma entrega ya
 * estaba (misma huella, aunque llegue con otra Idempotency-Key) · 400 { error } si falta o sobra algo.
 * La Idempotency-Key la exige la puerta (routes/sistemas/index.js): la misma llave devuelve la misma respuesta.
 */
import crypto from 'crypto';
import BitacoraAviso from '../../models/BitacoraAviso.js';
import { isoMexico } from '../../utils/revisarConfig.js';

export const ORIGENES_BITACORA = ['carla', 'julia'];
export const DESTINOS_BITACORA = ['produccion', 'charly', 'susana', 'asesor'];
export const RE_OBRA = /^3G-\d{2}-\d{4,5}$/;
const MAX_TEXTO = 4000;
const FUTURO_MS = 5 * 60 * 1000; // relojes un poco adelantados

/** Teléfonos de 10 dígitos o más (con espacios o guiones) → «•••». Fechas y montos no se tocan. */
export const sinTelefonos = (texto) => String(texto ?? '')
    .replace(/\+?\d[\d -]{8,}\d/g, (m) => (m.replace(/\D/g, '').length >= 10 ? '•••' : m));

const textoOpcional = (v, max) => {
    if (v === undefined || v === null || v === '') return { valor: null };
    if (typeof v !== 'string') return { error: true };
    const t = v.trim();
    if (t.length > max) return { error: true };
    return { valor: t || null };
};

/** Revisa el cuerpo; devuelve { errores: [] } o { datos }. Exportada para las pruebas. */
export const leerBitacora = (b, ahora = new Date()) => {
    const errores = [];
    const origen = String(b?.origen ?? '').trim().toLowerCase();
    if (!ORIGENES_BITACORA.includes(origen)) errores.push('«origen» debe ser carla o julia');
    const destino = String(b?.destino ?? '').trim().toLowerCase();
    if (!DESTINOS_BITACORA.includes(destino)) errores.push('«destino» debe ser produccion, charly, susana o asesor');
    const texto = typeof b?.texto === 'string' ? b.texto.trim() : '';
    if (!texto) errores.push('Falta «texto»');
    else if (texto.length > MAX_TEXTO) errores.push(`«texto» pasa de ${MAX_TEXTO} caracteres`);
    const enviado = typeof b?.enviadoEn === 'string' ? new Date(b.enviadoEn) : null;
    if (!enviado || Number.isNaN(enviado.getTime())) errores.push('«enviadoEn» debe ser una fecha ISO');
    else if (enviado.getTime() > ahora.getTime() + FUTURO_MS) errores.push('«enviadoEn» está en el futuro');
    const proyecto = textoOpcional(b?.proyecto, 200);
    if (proyecto.error) errores.push('«proyecto» debe ser texto de hasta 200 caracteres');
    const referencia = textoOpcional(b?.referencia, 100);
    if (referencia.error) errores.push('«referencia» debe ser texto de hasta 100 caracteres');
    const obra = textoOpcional(b?.obra, 12);
    if (obra.error || (obra.valor && !RE_OBRA.test(obra.valor))) errores.push('«obra» debe ser un ID 3G (3G-AA-NNNN)');
    if (errores.length) return { errores };
    const limpio = sinTelefonos(texto);
    const huella = crypto.createHash('sha256').update(`${origen}|${destino}|${enviado.toISOString()}|${limpio}`, 'utf8').digest('hex');
    return {
        errores: [],
        datos: { origen, destino, texto: limpio, enviado_en: enviado, proyecto: proyecto.valor, obra_id: obra.valor, referencia: referencia.valor, huella }
    };
};

/** Guarda una entrega. Devuelve { codigo, cuerpo } para la puerta. */
export const registrarBitacora = async (cuerpo) => {
    const { errores, datos } = leerBitacora(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se anotó: ${errores.join('; ')}.` } };
    const previa = await BitacoraAviso.findOne({ where: { huella: datos.huella }, attributes: ['id'] });
    if (previa) return { codigo: 200, cuerpo: { ok: true, id: `bitacora-${previa.id}`, duplicado: true } };
    try {
        const fila = await BitacoraAviso.create(datos);
        return { codigo: 201, cuerpo: { ok: true, id: `bitacora-${fila.id}`, duplicado: false, recibido: isoMexico() } };
    } catch (e) {
        // Dos entregas iguales al mismo tiempo: la segunda choca con la huella única y es la misma.
        if (e?.name === 'SequelizeUniqueConstraintError') {
            const otra = await BitacoraAviso.findOne({ where: { huella: datos.huella }, attributes: ['id'] });
            return { codigo: 200, cuerpo: { ok: true, id: otra ? `bitacora-${otra.id}` : null, duplicado: true } };
        }
        throw e;
    }
};
