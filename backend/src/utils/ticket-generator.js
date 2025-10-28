/**
 * Genera un ID único para un ticket de movimiento
 * Formato: DDMMYY-HHMM-NN
 * Ejemplo: 281025-1430-01
 * @param {number} consecutivo - Número consecutivo del día (opcional)
 * @returns {string} - ID del ticket
 */
export const generarTicketID = (consecutivo = null) => {
    const now = new Date();

    // Día (DD)
    const dia = String(now.getDate()).padStart(2, '0');

    // Mes (MM)
    const mes = String(now.getMonth() + 1).padStart(2, '0');

    // Año (YY) - últimos 2 dígitos
    const anio = String(now.getFullYear()).slice(-2);

    // Hora (HH)
    const hora = String(now.getHours()).padStart(2, '0');

    // Minutos (MM)
    const minutos = String(now.getMinutes()).padStart(2, '0');

    // Consecutivo (NN) - si no se proporciona, usar segundos
    let num;
    if (consecutivo !== null) {
        num = String(consecutivo).padStart(2, '0');
    } else {
        num = String(now.getSeconds()).padStart(2, '0');
    }

    // Formato final: DDMMYY-HHMM-NN
    return `${dia}${mes}${anio}-${hora}${minutos}-${num}`;
};

/**
 * Genera un código alfanumérico único
 * Útil como alternativa o complemento al ticket ID
 * @param {number} length - Longitud del código (default: 8)
 * @returns {string} - Código único
 */
export const generarCodigoUnico = (length = 8) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin caracteres ambiguos (I, O, 0, 1)
    let codigo = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        codigo += chars[randomIndex];
    }

    return codigo;
};

/**
 * Valida el formato de un ticket ID
 * @param {string} ticketId - ID del ticket a validar
 * @returns {Object} - Resultado de la validación
 */
export const validarTicketID = (ticketId) => {
    // Formato esperado: DDMMYY-HHMM-NN
    const regex = /^(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})-(\d{2})$/;
    const match = ticketId.match(regex);

    if (!match) {
        return {
            valid: false,
            error: 'Formato de ticket inválido'
        };
    }

    const [, dia, mes, anio, hora, minutos, consecutivo] = match;

    // Validar rangos
    if (parseInt(dia) < 1 || parseInt(dia) > 31) {
        return { valid: false, error: 'Día inválido' };
    }
    if (parseInt(mes) < 1 || parseInt(mes) > 12) {
        return { valid: false, error: 'Mes inválido' };
    }
    if (parseInt(hora) > 23) {
        return { valid: false, error: 'Hora inválida' };
    }
    if (parseInt(minutos) > 59) {
        return { valid: false, error: 'Minutos inválidos' };
    }

    return {
        valid: true,
        data: {
            dia: parseInt(dia),
            mes: parseInt(mes),
            anio: parseInt(anio) + 2000, // Convertir a año completo
            hora: parseInt(hora),
            minutos: parseInt(minutos),
            consecutivo: parseInt(consecutivo)
        }
    };
};

/**
 * Extrae información de fecha de un ticket ID
 * @param {string} ticketId - ID del ticket
 * @returns {Date|null} - Fecha del ticket o null si es inválido
 */
export const extraerFechaDeTicket = (ticketId) => {
    const validacion = validarTicketID(ticketId);

    if (!validacion.valid) {
        return null;
    }

    const { dia, mes, anio, hora, minutos } = validacion.data;

    return new Date(anio, mes - 1, dia, hora, minutos);
};

/**
 * Genera un número de folio secuencial
 * @param {number} numero - Número de folio
 * @param {number} length - Longitud del folio (default: 6)
 * @returns {string} - Folio formateado
 */
export const generarFolio = (numero, length = 6) => {
    return String(numero).padStart(length, '0');
};

export default {
    generarTicketID,
    generarCodigoUnico,
    validarTicketID,
    extraerFechaDeTicket,
    generarFolio
};
