// Rediseño 2 · grupo tickets · ayudas de datos (solo para pintar; no piden nada y no cambian ningún valor que se manda).
//   destinoDe(ticket)                 → lo mismo que pintaba la tarjeta de hoy: almacén destino, obra o «Sin especificar»
//   preparados(ticket)                → { hechos, total } contando los artículos ya palomeados (mismo dato que el %)
//   ordenarPorUbicacion(detalles)     → copia ordenada por la clave de ubicación («A-02-2», «H-01-3»…); sin ubicación al final
//   agruparPorDia(lista, fechaDe)     → [{ id, titulo: 'Hoy' | 'Ayer' | 'Lunes 13 oct', filas }] sin cambiar el orden que llegó
//   tipoMovimiento(m), estadoMovimiento(m) → texto y tono de cada movimiento del historial
import { aFecha, diasDesdeHoy, estadoDe } from '../fundacion';

export const destinoDe = (p) => p?.ubicacionDestino?.almacen || p?.proyecto || 'Sin especificar';

export function preparados(p) {
  const lista = p?.detalles || [];
  return { hechos: lista.filter((d) => d.dispersado).length, total: lista.length };
}

export function ordenarPorUbicacion(lista = []) {
  return lista
    .map((d, i) => [d, i])
    .sort(([a, i], [b, j]) => {
      const ca = a?.articulo?.ubicacion?.codigo;
      const cb = b?.articulo?.ubicacion?.codigo;
      if (ca && cb) {
        const c = String(ca).localeCompare(String(cb), 'es', { numeric: true, sensitivity: 'base' });
        if (c) return c;
      } else if (ca) return -1;
      else if (cb) return 1;
      return i - j;
    })
    .map(([d]) => d);
}

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mayuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

export function tituloDia(v) {
  const f = aFecha(v);
  if (!f) return 'Sin fecha';
  const d = diasDesdeHoy(f);
  if (d === 0) return 'Hoy';
  if (d === -1) return 'Ayer';
  const anio = f.getFullYear() !== new Date().getFullYear() ? ` ${f.getFullYear()}` : '';
  return mayuscula(`${DIAS_LARGOS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}${anio}`);
}

const claveDia = (v) => {
  const f = aFecha(v);
  return f ? `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}` : 'sin-fecha';
};

/** Agrupa por día respetando el orden en que llegó la lista (no se reordena: el servidor manda el orden). */
export function agruparPorDia(lista = [], fechaDe) {
  const grupos = new Map();
  for (const x of lista) {
    const v = fechaDe(x);
    const k = claveDia(v);
    if (!grupos.has(k)) grupos.set(k, { id: k, titulo: tituloDia(v), filas: [] });
    grupos.get(k).filas.push(x);
  }
  return [...grupos.values()];
}

const TIPOS = {
  pedido: 'Ticket',
  retiro: 'Retiro',
  devolucion: 'Devolución',
  ajuste_entrada: 'Ajuste de entrada',
  ajuste_salida: 'Ajuste de salida',
  transferencia: 'Transferencia',
  entrada_orden_compra: 'Entrada de compra',
};
/** «Ticket», «Retiro», «Devolución»… (lo que no se conoce sale tal cual). */
export const tipoMovimiento = (m) => TIPOS[m?.tipo] || m?.tipo || '—';

/** Estado del movimiento con las palabras del sistema (los tickets usan el vocabulario de tickets). */
export function estadoMovimiento(m) {
  if (m?.tipo === 'pedido') return estadoDe('ticket', m?.estado);
  if (m?.estado === 'completado') return { texto: 'Completado', tono: 'ok' };
  if (m?.estado === 'cancelado') return { texto: 'Cancelado', tono: 'neutro' };
  if (m?.estado === 'rechazado') return { texto: 'Rechazado', tono: 'mal' };
  return estadoDe('ticket', m?.estado);
}

