/**
 * Banderas del panel de calidad (28-oct-2026, «3G Calidad»). Las tres vienen APAGADAS: apagadas, Planta queda igual que hoy.
 *
 *   PANEL_CALIDAD           `1` enciende /api/calidad, lo de la pantalla web, «Calidad pide corregir» en la terminal y
 *                           `calidad` en la puerta de producción. Apagada: /api/calidad responde 404 y nada escribe en
 *                           las tablas de calidad (se crean al arrancar, pero se quedan quietas).
 *   CALIDAD_AVAL_CIERRA     `1` (pide PANEL_CALIDAD): la obra ya no pasa sola a «Preparado» al terminar Manufactura y
 *                           Herrería; espera el aval de Calidad. El «Preparado» manual de la oficina sigue funcionando.
 *   CALIDAD_DEFECTO_REABRE  `1` (pide PANEL_CALIDAD): un defecto que no sale así reabre la subetapa de su hoja.
 *
 * Se leen en cada llamada (baratas: solo miran variables), como las demás banderas de Planta. Aceptan 1, true, si, sí
 * u on, igual que FALLA_CERRADA. Las dos que dependen de PANEL_CALIDAD no hacen nada sin ella.
 */
const SI = new Set(['1', 'true', 'si', 'sí', 'on']);
const encendida = (nombre) => SI.has(String(process.env[nombre] ?? '').trim().toLowerCase());

export const panelCalidad = () => encendida('PANEL_CALIDAD');
export const calidadAvalCierra = () => panelCalidad() && encendida('CALIDAD_AVAL_CIERRA');
export const calidadDefectoReabre = () => panelCalidad() && encendida('CALIDAD_DEFECTO_REABRE');

export default { panelCalidad, calidadAvalCierra, calidadDefectoReabre };
