// Rediseño 2 · Compras · ayudas de vista que comparten Solicitudes, Órdenes, Recepción y Stock bajo.
// Solo dan formato o agrupan lo que la página ya cargó: no piden nada ni cambian ningún valor que se manda.
import { dinero, numero, motivoLegible } from '../fundacion/formato';

/** Importe de una orden: «—» cuando el servidor lo oculta a ese rol (OC_OCULTA_IMPORTES); si no, «$134,360.64». */
export const importe = (orden, valor) => (orden?.importesOcultos ? '—' : dinero(valor ?? 0));

/** Las fechas «de solo día» llegan como medianoche UTC (2026-10-17T00:00:00.000Z): se toma el día tal cual, sin zona. */
export const soloDia = (v) => (v ? String(v).slice(0, 10) : null);

/** Número sin «.00» ni separadores raros: «1,215», «6.5». */
export const num = (v) => numero(parseFloat(v) || 0);

/** Opciones del filtro «Estado» de Órdenes (las mismas de hoy, con las palabras del vocabulario común). */
export const OPCIONES_ESTADO_ORDEN = [
  { valor: '', texto: 'Todos' },
  { valor: 'pendiente_aprobacion', texto: 'Por aprobar' },
  { valor: 'enviada', texto: 'Enviada' },
  { valor: 'parcial', texto: 'Recibida en parte' },
  { valor: 'recibida', texto: 'Recibida' },
  { valor: 'rechazada', texto: 'Rechazada' },
  { valor: 'cancelada', texto: 'Cancelada' },
];

/** En qué vista (Activas · Completadas · Canceladas) vive cada estado, igual que el filtro de la página. */
export const vistaDeEstado = (estado) => (estado === 'recibida' ? 'completadas' : estado === 'cancelada' ? 'canceladas' : 'activas');

/** Bandeja de Órdenes activas: lo que pide decisión primero, lo informativo al final. */
export const GRUPOS_ORDEN = [
  { id: 'pendiente_aprobacion', titulo: 'Por aprobar' },
  { id: 'rechazada', titulo: 'Rechazadas · por corregir' },
  { id: 'enviada', titulo: 'Enviadas · esperando entrega' },
  { id: 'parcial', titulo: 'Recibidas en parte' },
  { id: 'borrador', titulo: 'Borradores' },
];

/** Avance de recepción con los datos que ya trae la orden: cuántos artículos llegaron completos y cuántos en parte. */
export function avanceOrden(orden) {
  const detalles = orden?.detalles || [];
  let completos = 0;
  let enParte = 0;
  detalles.forEach((d) => {
    const pedido = parseFloat(d.cantidad_solicitada) || 0;
    const recibido = parseFloat(d.cantidad_recibida) || 0;
    if (pedido > 0 && recibido >= pedido) completos += 1;
    else if (recibido > 0) enParte += 1;
  });
  return { total: detalles.length, completos, enParte };
}

/** Prioridad de una solicitud: orden de urgencia (para ordenar dentro de un grupo, de lo urgente a lo informativo). */
export const PESO_PRIORIDAD = { urgente: 0, alta: 1, media: 2, baja: 3 };

/**
 * Error de carga para la tabla: el motivo en español. Axios dice «Network Error» (en inglés) cuando no hubo respuesta del
 * servidor; eso se cambia por una frase que dice qué pasó y qué hacer. Lo demás (lo que dijo el servidor) va tal cual.
 */
export function errorDeCarga(mensaje, motivo, alReintentar) {
  if (!motivo) return undefined;
  // El texto del motivo es el mismo de todo el sistema (motivoLegible de la fundación; revisión final)
  return { mensaje, motivo: motivoLegible(motivo), alReintentar };
}

/** Nombre del área de un rol para leerlo («almacen» → «Almacén»); si no se conoce, el rol tal cual. */
const AREA_DE_ROL = {
  administrador: 'Administración', almacen: 'Almacén', compras: 'Compras', diseñador: 'Diseño', ventas: 'Ventas',
  encargado: 'Encargado de cuadrilla', operador: 'Operador',
};
export const nombreRol = (rol) => (rol ? AREA_DE_ROL[rol] || rol : '');

/** Texto sin acentos ni mayúsculas para buscar. */
export const plano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
