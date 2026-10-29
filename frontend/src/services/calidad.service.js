// Panel de calidad (28-oct-2026, «3G Calidad»): lo que la web de Planta le pide a /api/calidad con la sesión de siempre.
// Con PANEL_CALIDAD apagada el servidor responde 404 a todo y la pantalla no enseña nada de calidad.
import api from './api';

export const yoCalidad = () => api.get('/calidad/yo').then((r) => r.data);
export const obraCalidad = (id) => api.get(`/calidad/obras/${encodeURIComponent(id)}`).then((r) => r.data);
export const reporteCalidadPDF = (id) => api.get(`/calidad/obras/${encodeURIComponent(id)}/reporte.pdf`, { responseType: 'blob' }).then((r) => r.data);
export const generarCodigoCalidad = () => api.post('/calidad/codigos').then((r) => r.data);
export const tabletasCalidad = () => api.get('/calidad/dispositivos').then((r) => r.data.dispositivos || []);
export const revocarTabletaCalidad = (id) => api.post(`/calidad/dispositivos/${id}/revocar`).then((r) => r.data);

/** La dirección del servidor de Planta (la de VITE_API_URL sin «/api»): va en el QR para que la tableta sepa a quién hablar. */
export const servidorPlanta = () => String(import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

/** El enlace del QR: el mismo formato que la app de Carla (carla3g://vincular?s=&c=), con el esquema de 3G Calidad. */
export const enlaceVincular = (codigo, servidor = servidorPlanta()) => `calidad3g://vincular?s=${encodeURIComponent(servidor)}&c=${encodeURIComponent(codigo)}`;
