/**
 * Servicio para gestionar la configuración y firma del lector de códigos
 *
 * La "firma" es un conjunto de características únicas del lector:
 * - Timing promedio entre teclas
 * - Variación del timing
 * - Presencia de prefijos/sufijos
 * - Caracteres finales (Enter, Tab, etc.)
 */

const STORAGE_KEY = 'barcode_scanner_config';

/**
 * Estructura de la configuración:
 * {
 *   enabled: boolean,
 *   deviceSignature: {
 *     avgKeyInterval: number,  // Promedio de ms entre teclas
 *     maxKeyInterval: number,  // Máximo ms entre teclas aceptable
 *     minKeyInterval: number,  // Mínimo ms entre teclas
 *     hasEnterSuffix: boolean, // Si termina con Enter
 *     hasPrefix: string,       // Prefijo si existe
 *     hasSuffix: string,       // Sufijo si existe (además de Enter)
 *     minLength: number,       // Longitud mínima del código
 *     maxLength: number,       // Longitud máxima del código
 *     testCode: string,        // Código de prueba usado para calibrar
 *     calibratedAt: string     // Timestamp de calibración
 *   },
 *   name: string // Nombre personalizado del lector
 * }
 */

/**
 * Obtiene la configuración guardada del lector
 */
export const getScannerConfig = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error al leer configuración del lector:', error);
  }
  return null;
};

/**
 * Guarda la configuración del lector
 */
export const saveScannerConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error al guardar configuración del lector:', error);
    return false;
  }
};

/**
 * Elimina la configuración del lector
 */
export const clearScannerConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error al eliminar configuración del lector:', error);
    return false;
  }
};

/**
 * Analiza una secuencia de pulsaciones de teclas y genera una firma del dispositivo
 * @param {Array} keyEvents - Array de eventos: [{ key: string, timestamp: number }, ...]
 * @returns {Object} Firma del dispositivo
 */
export const generateDeviceSignature = (keyEvents) => {
  if (!keyEvents || keyEvents.length < 2) {
    throw new Error('Se necesitan al menos 2 eventos de teclas para generar la firma');
  }

  // Calcular intervalos entre teclas
  const intervals = [];
  for (let i = 1; i < keyEvents.length; i++) {
    const interval = keyEvents[i].timestamp - keyEvents[i - 1].timestamp;
    intervals.push(interval);
  }

  // Calcular estadísticas
  const avgKeyInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const minKeyInterval = Math.min(...intervals);
  const maxKeyInterval = Math.max(...intervals);

  // Extraer el código completo (sin el Enter final si existe)
  let fullCode = keyEvents.map(e => e.key).join('');
  const hasEnterSuffix = keyEvents[keyEvents.length - 1].key === 'Enter';

  if (hasEnterSuffix) {
    fullCode = fullCode.slice(0, -5); // Remover "Enter" del string
  }

  // Detectar posibles prefijos/sufijos (caracteres especiales al inicio/final)
  let detectedPrefix = '';
  let detectedSuffix = '';
  let coreCode = fullCode;

  // Buscar prefijos comunes (caracteres no alfanuméricos al inicio)
  const prefixMatch = fullCode.match(/^([^a-zA-Z0-9]+)/);
  if (prefixMatch) {
    detectedPrefix = prefixMatch[1];
    coreCode = fullCode.substring(detectedPrefix.length);
  }

  // Buscar sufijos comunes (caracteres no alfanuméricos al final, excepto Enter)
  const suffixMatch = coreCode.match(/([^a-zA-Z0-9]+)$/);
  if (suffixMatch) {
    detectedSuffix = suffixMatch[1];
    coreCode = coreCode.substring(0, coreCode.length - detectedSuffix.length);
  }

  return {
    avgKeyInterval: Math.round(avgKeyInterval * 10) / 10, // Redondear a 1 decimal
    maxKeyInterval: Math.round(maxKeyInterval * 1.5), // Agregar margen de tolerancia del 50%
    minKeyInterval: Math.max(0, Math.round(minKeyInterval * 0.5)), // Reducir en 50% el mínimo
    hasEnterSuffix,
    hasPrefix: detectedPrefix,
    hasSuffix: detectedSuffix,
    minLength: coreCode.length - 2, // Permitir 2 caracteres menos
    maxLength: coreCode.length + 2, // Permitir 2 caracteres más
    testCode: fullCode,
    calibratedAt: new Date().toISOString()
  };
};

/**
 * Verifica si una secuencia de teclas coincide con la firma del dispositivo configurado
 * @param {Array} keyEvents - Array de eventos de teclas
 * @param {Object} signature - Firma del dispositivo
 * @returns {boolean} true si coincide con la firma
 */
export const matchesDeviceSignature = (keyEvents, signature) => {
  if (!keyEvents || !signature || keyEvents.length < 2) {
    return false;
  }

  // Verificar si termina con Enter (si está configurado)
  const lastKey = keyEvents[keyEvents.length - 1].key;
  if (signature.hasEnterSuffix && lastKey !== 'Enter') {
    return false;
  }

  // Calcular intervalos
  const intervals = [];
  for (let i = 1; i < keyEvents.length; i++) {
    const interval = keyEvents[i].timestamp - keyEvents[i - 1].timestamp;
    intervals.push(interval);
  }

  // Verificar que los intervalos estén dentro del rango esperado
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Permitir una variación razonable en el promedio (±30%)
  const avgTolerance = signature.avgKeyInterval * 0.3;
  if (Math.abs(avgInterval - signature.avgKeyInterval) > avgTolerance) {
    return false;
  }

  // Verificar que ningún intervalo supere el máximo
  const maxInterval = Math.max(...intervals);
  if (maxInterval > signature.maxKeyInterval) {
    return false;
  }

  // Extraer el código completo
  let fullCode = keyEvents.map(e => e.key).join('');
  if (lastKey === 'Enter') {
    fullCode = fullCode.slice(0, -5); // Remover "Enter"
  }

  // Verificar prefijo si existe
  if (signature.hasPrefix && !fullCode.startsWith(signature.hasPrefix)) {
    return false;
  }

  // Verificar sufijo si existe
  if (signature.hasSuffix && !fullCode.endsWith(signature.hasSuffix)) {
    return false;
  }

  // Verificar longitud del código (sin prefijo/sufijo)
  let coreCode = fullCode;
  if (signature.hasPrefix) {
    coreCode = coreCode.substring(signature.hasPrefix.length);
  }
  if (signature.hasSuffix) {
    coreCode = coreCode.substring(0, coreCode.length - signature.hasSuffix.length);
  }

  if (coreCode.length < signature.minLength || coreCode.length > signature.maxLength) {
    return false;
  }

  return true;
};

/**
 * Obtiene el código limpio (sin prefijos/sufijos) de una secuencia de teclas
 * @param {Array} keyEvents - Array de eventos de teclas
 * @param {Object} signature - Firma del dispositivo (opcional)
 * @returns {string} Código limpio
 */
export const getCleanCode = (keyEvents, signature = null) => {
  let code = keyEvents.map(e => e.key).join('');

  // Remover Enter final si existe
  if (code.endsWith('Enter')) {
    code = code.slice(0, -5);
  }

  // Si hay firma, remover prefijos/sufijos configurados
  if (signature) {
    if (signature.hasPrefix && code.startsWith(signature.hasPrefix)) {
      code = code.substring(signature.hasPrefix.length);
    }
    if (signature.hasSuffix && code.endsWith(signature.hasSuffix)) {
      code = code.substring(0, code.length - signature.hasSuffix.length);
    }
  }

  return code.trim();
};

/**
 * Verifica si el lector está configurado
 */
export const isScannerConfigured = () => {
  const config = getScannerConfig();
  return config && config.deviceSignature && config.enabled;
};

/**
 * Obtiene el nombre del lector configurado
 */
export const getScannerName = () => {
  const config = getScannerConfig();
  return config?.name || 'Lector sin nombre';
};

export default {
  getScannerConfig,
  saveScannerConfig,
  clearScannerConfig,
  generateDeviceSignature,
  matchesDeviceSignature,
  getCleanCode,
  isScannerConfigured,
  getScannerName
};
