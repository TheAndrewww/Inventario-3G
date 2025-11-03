/**
 * Detector automático de tipos de códigos de barras
 * Analiza un código escaneado y determina su tipo
 */

/**
 * Detecta automáticamente el tipo de código de barras
 * @param {string} code - El código escaneado
 * @returns {string} - El tipo detectado (EAN13, EAN8, UPCA, etc.)
 */
export const detectBarcodeType = (code) => {
  if (!code || typeof code !== 'string') {
    return 'EAN13'; // Valor por defecto
  }

  const trimmedCode = code.trim();

  // EAN-13: Exactamente 13 dígitos numéricos
  if (/^[0-9]{13}$/.test(trimmedCode)) {
    return 'EAN13';
  }

  // EAN-8: Exactamente 8 dígitos numéricos
  if (/^[0-9]{8}$/.test(trimmedCode)) {
    return 'EAN8';
  }

  // UPC-A: Exactamente 12 dígitos numéricos
  if (/^[0-9]{12}$/.test(trimmedCode)) {
    return 'UPCA';
  }

  // UPC-E: 6 a 8 dígitos numéricos
  if (/^[0-9]{6,8}$/.test(trimmedCode)) {
    return 'UPCE';
  }

  // Code 39: Letras mayúsculas, números y caracteres especiales (-.$/+%)
  // Generalmente empieza y termina con *
  if (/^[0-9A-Z\-. $/+%*]+$/.test(trimmedCode)) {
    // Si tiene asteriscos al inicio/final, es muy probable Code 39
    if (trimmedCode.startsWith('*') && trimmedCode.endsWith('*')) {
      return 'CODE39';
    }
    // Si solo tiene caracteres válidos de Code 39 pero sin asteriscos
    if (/^[0-9A-Z\-. $/+%]+$/.test(trimmedCode)) {
      return 'CODE39';
    }
  }

  // QR Code: Generalmente contiene URLs, texto largo, o caracteres especiales
  // QR puede contener casi cualquier carácter
  if (trimmedCode.length > 50) {
    return 'QRCODE';
  }

  // Detectar URLs (común en QR Codes)
  if (/^(https?:\/\/|www\.)/i.test(trimmedCode)) {
    return 'QRCODE';
  }

  // Detectar email (común en QR Codes)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedCode)) {
    return 'QRCODE';
  }

  // Detectar formato de vCard (común en QR Codes)
  if (trimmedCode.startsWith('BEGIN:VCARD')) {
    return 'QRCODE';
  }

  // DataMatrix: Similar a QR pero generalmente más corto
  // Difícil de distinguir solo por el contenido, pero si tiene caracteres especiales
  // y es relativamente corto (menos de 50 caracteres)
  if (/[^0-9A-Za-z]/.test(trimmedCode) && trimmedCode.length <= 50 && trimmedCode.length > 15) {
    return 'DATAMATRIX';
  }

  // Code 128: Puede contener cualquier carácter ASCII
  // Si tiene mezcla de mayúsculas, minúsculas y/o caracteres especiales
  // y no coincide con otros formatos
  if (/[a-z]/.test(trimmedCode) || /[^0-9A-Z\-. $/+%]/.test(trimmedCode)) {
    // Si tiene caracteres especiales complejos, probablemente Code 128
    if (trimmedCode.length > 8 && trimmedCode.length <= 50) {
      return 'CODE128';
    }
  }

  // Si solo tiene números pero no coincide con ningún formato específico
  if (/^[0-9]+$/.test(trimmedCode)) {
    if (trimmedCode.length < 6) {
      return 'CODE39'; // Códigos numéricos cortos
    }
    if (trimmedCode.length > 13) {
      return 'CODE128'; // Códigos numéricos largos
    }
  }

  // Por defecto, si es alfanumérico mixto, asumimos Code 128
  return 'CODE128';
};

/**
 * Obtiene el nombre legible del tipo de código
 * @param {string} type - El tipo de código (EAN13, EAN8, etc.)
 * @returns {string} - Nombre legible
 */
export const getBarcodeTypeName = (type) => {
  const names = {
    'EAN13': 'EAN-13 (13 dígitos)',
    'EAN8': 'EAN-8 (8 dígitos)',
    'UPCA': 'UPC-A (12 dígitos)',
    'UPCE': 'UPC-E (6-8 dígitos)',
    'CODE128': 'Code 128 (alfanumérico)',
    'CODE39': 'Code 39 (alfanumérico)',
    'QRCODE': 'QR Code',
    'DATAMATRIX': 'DataMatrix'
  };
  return names[type] || type;
};

/**
 * Valida si un código es válido para el tipo especificado
 * @param {string} code - El código a validar
 * @param {string} type - El tipo de código
 * @returns {boolean} - true si es válido
 */
export const validateCodeForType = (code, type) => {
  if (!code) return false;

  const validations = {
    'EAN13': /^[0-9]{13}$/,
    'EAN8': /^[0-9]{8}$/,
    'UPCA': /^[0-9]{12}$/,
    'UPCE': /^[0-9]{6,8}$/,
    'CODE128': (c) => c.length > 0 && c.length <= 50,
    'CODE39': /^[0-9A-Z\-. $/+%*]+$/,
    'QRCODE': (c) => c.length > 0 && c.length <= 4296,
    'DATAMATRIX': (c) => c.length > 0 && c.length <= 2335
  };

  const validation = validations[type];
  if (typeof validation === 'function') {
    return validation(code);
  }
  return validation ? validation.test(code) : true;
};

export default {
  detectBarcodeType,
  getBarcodeTypeName,
  validateCodeForType
};
