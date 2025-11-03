/**
 * Generador de códigos EAN-13
 * Genera códigos EAN-13 válidos con dígito verificador
 */

/**
 * Calcula el dígito verificador de un código EAN-13
 * @param {string} code - Los primeros 12 dígitos del código EAN-13
 * @returns {string} - El dígito verificador (1 dígito)
 */
const calcularDigitoVerificador = (code) => {
    if (code.length !== 12) {
        throw new Error('El código debe tener exactamente 12 dígitos');
    }

    let suma = 0;
    for (let i = 0; i < 12; i++) {
        const digito = parseInt(code[i]);
        // Posiciones impares (0, 2, 4, 6, 8, 10) se multiplican por 1
        // Posiciones pares (1, 3, 5, 7, 9, 11) se multiplican por 3
        suma += i % 2 === 0 ? digito : digito * 3;
    }

    const modulo = suma % 10;
    const digitoVerificador = modulo === 0 ? 0 : 10 - modulo;

    return digitoVerificador.toString();
};

/**
 * Genera un código EAN-13 válido basado en un ID
 * @param {number} id - ID del artículo
 * @returns {string} - Código EAN-13 completo (13 dígitos)
 */
export const generarCodigoEAN13 = (id) => {
    // Prefijo '200' es para uso interno (código de artículos locales)
    // El resto se rellena con ceros y el ID
    const prefijo = '200';
    const idStr = id.toString().padStart(9, '0'); // 9 dígitos para el ID
    const codigo12Digitos = prefijo + idStr; // 12 dígitos en total

    // Calcular dígito verificador
    const digitoVerificador = calcularDigitoVerificador(codigo12Digitos);

    // Retornar código completo de 13 dígitos
    return codigo12Digitos + digitoVerificador;
};

/**
 * Valida si un código EAN-13 es válido
 * @param {string} ean13 - Código EAN-13 a validar
 * @returns {boolean} - true si es válido, false si no
 */
export const validarCodigoEAN13 = (ean13) => {
    // Validar formato
    if (!/^[0-9]{13}$/.test(ean13)) {
        return false;
    }

    // Validar dígito verificador
    const codigo12Digitos = ean13.substring(0, 12);
    const digitoVerificadorEsperado = calcularDigitoVerificador(codigo12Digitos);
    const digitoVerificadorActual = ean13[12];

    return digitoVerificadorEsperado === digitoVerificadorActual;
};

/**
 * Genera un código EAN-13 temporal antes de conocer el ID
 * Útil para crear un placeholder antes de insertar en BD
 * @returns {string} - Código EAN-13 temporal
 */
export const generarCodigoEAN13Temporal = () => {
    const timestamp = Date.now().toString().slice(-9); // Últimos 9 dígitos del timestamp
    const prefijo = '200';
    const codigo12Digitos = prefijo + timestamp;
    const digitoVerificador = calcularDigitoVerificador(codigo12Digitos);

    return codigo12Digitos + digitoVerificador;
};

export default {
    generarCodigoEAN13,
    validarCodigoEAN13,
    generarCodigoEAN13Temporal,
    calcularDigitoVerificador
};
