/**
 * Avisos al grupo de WhatsApp de PRODUCCIÓN.
 *
 * Antes, cuando alguien subía un plano o un ticket a la carpeta del proyecto en
 * Drive, o cuando se cerraba una etapa en el dashboard, nadie se enteraba: había
 * que estar entrando a ver. Estos avisos cuentan al grupo lo que va pasando.
 *
 * Los mensajes se arman aquí y se encolan; el bot contable —que es el que tiene
 * la sesión de WhatsApp— los publica. Ninguno de estos avisos debe tumbar la
 * operación: si algo falla, se registra y se sigue.
 */
import { enviarWhatsApp } from './whatsapp.service.js';

const DESTINO = 'produccion';

// Cuántos archivos se enumeran antes de resumir: al grupo le sirve saber qué
// llegó, no leer veinte renglones en el celular.
const MAX_ARCHIVOS_EN_AVISO = 6;

const listar = (nombres) => {
    const mostrados = nombres.slice(0, MAX_ARCHIVOS_EN_AVISO).map(n => `• ${n}`);
    const restantes = nombres.length - mostrados.length;
    if (restantes > 0) mostrados.push(`…y ${restantes} más (${nombres.length} en total)`);
    return mostrados;
};

/**
 * Se subió algo a la carpeta del proyecto en Drive.
 *
 * @param {Object} datos
 * @param {string} datos.proyecto
 * @param {Array<string>} [datos.manufactura] - Nombres de los archivos nuevos
 * @param {Array<string>} [datos.herreria]
 * @returns {string|null} - null si no hay nada que avisar
 */
export const construirAvisoArchivosNuevos = ({ proyecto, manufactura = [], herreria = [] }) => {
    if (manufactura.length === 0 && herreria.length === 0) return null;

    // El encabezado dice de qué es la producción que se subió, que es lo
    // primero que el grupo necesita saber.
    const areas = [];
    if (manufactura.length > 0) areas.push('MANUFACTURA');
    if (herreria.length > 0) areas.push('HERRERÍA');

    const lineas = [
        `📐 *Se subió producción de ${areas.join(' y ')}*`,
        proyecto,
        ''
    ];

    if (manufactura.length > 0) {
        if (areas.length > 1) lineas.push('*Manufactura:*');
        lineas.push(...listar(manufactura));
    }

    if (herreria.length > 0) {
        if (areas.length > 1) {
            if (manufactura.length > 0) lineas.push('');
            lineas.push('*Herrería:*');
        }
        lineas.push(...listar(herreria));
    }

    return lineas.join('\n');
};

export const avisarArchivosNuevos = async (datos) => {
    const mensaje = construirAvisoArchivosNuevos(datos);
    if (!mensaje) return false;
    return enviarWhatsApp(mensaje, DESTINO);
};

/**
 * Se subió el ticket de salida de almacén a la carpeta del proyecto.
 *
 * El ticket se nombra por su proyecto, no por su folio: al grupo el código
 * (PED-260826-0410-02) no le dice nada, el nombre del proyecto sí.
 */
export const construirAvisoTicketSubido = ({ proyecto }) =>
    [
        '🎫 *Se subió ticket de salida*',
        proyecto
    ].join('\n');

export const avisarTicketSubido = async (datos) =>
    enviarWhatsApp(construirAvisoTicketSubido(datos), DESTINO);

/**
 * Se cerró (se entregó) el ticket de salida de un proyecto.
 */
export const construirAvisoTicketCerrado = ({ proyecto, recibio }) =>
    [
        '✅ *Ticket cerrado*',
        proyecto || 'Sin proyecto',
        recibio ? `Lo recibió: ${recibio}` : null
    ].filter(l => l !== null).join('\n');

export const avisarTicketCerrado = async (datos) =>
    enviarWhatsApp(construirAvisoTicketCerrado(datos), DESTINO);

/**
 * Nombre con el que el grupo conoce cada etapa y sub-etapa.
 * Las claves son las que usan los endpoints del dashboard y las terminales.
 */
export const NOMBRES_ETAPA = {
    diseno: 'Diseño',
    compras: 'Compras',
    produccion: 'Producción',
    manufactura: 'Manufactura',
    herreria: 'Herrería',
    herreria_armado: 'Soldadura',
    herreria_pintado: 'Pintura',
    instalacion: 'Preparado'
};

/**
 * Se completó una etapa o sub-etapa del proyecto.
 */
export const construirAvisoEtapaCompletada = ({ proyecto, etapa, usuario }) => {
    const nombre = NOMBRES_ETAPA[etapa] || etapa;
    return [
        `✅ *Se completó etapa ${nombre.toUpperCase()}*`,
        proyecto,
        usuario ? `Lo marcó: ${usuario}` : null
    ].filter(l => l !== null).join('\n');
};

export const avisarEtapaCompletada = async (datos) =>
    enviarWhatsApp(construirAvisoEtapaCompletada(datos), DESTINO);

/**
 * El proyecto terminó producción y se movió a Completados.
 */
export const construirAvisoProyectoCompletado = ({ proyecto }) =>
    [
        '🏁 *Proyecto completado*',
        '',
        `Ya puede confirmarse en calendario de ${proyecto}.`
    ].join('\n');

export const avisarProyectoCompletado = async (datos) =>
    enviarWhatsApp(construirAvisoProyectoCompletado(datos), DESTINO);

export default {
    avisarArchivosNuevos,
    avisarTicketSubido,
    avisarTicketCerrado,
    avisarEtapaCompletada,
    avisarProyectoCompletado,
    NOMBRES_ETAPA
};
