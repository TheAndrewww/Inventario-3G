// Rediseño 2 · Producción · nombres en pantalla de los filtros del tablero (los valores no cambian: FILTRO_OPCIONES).
export const TEXTO_FILTRO = {
  todos: 'Todas',
  completados: 'Listas para instalar',
  urgentes: 'Urgentes',
  diseno: 'En diseño',
  compras: 'En compras',
  produccion: 'En producción',
  manufactura: 'Manufactura',
  herreria: 'Herrería',
};
export const AYUDA_FILTRO = {
  todos: 'Todas las obras del tablero',
  completados: 'Obras en la etapa «Lista para instalar»',
  urgentes: 'Prioridad urgente o fecha máxima en 3 días o menos (mantenimiento: solo con la fecha vencida)',
  diseno: 'Obras con el diseño sin marcar',
  compras: 'Diseño marcado y compras sin marcar',
  produccion: 'Obras en la etapa de producción',
  manufactura: 'Obras que llevan manufactura y todavía no están listas para instalar',
  herreria: 'Obras que llevan herrería y todavía no están listas para instalar',
};
export const textoFiltro = (op) => TEXTO_FILTRO[op.value] || op.label.replace(/^[^\p{L}\p{N}]+/u, '');

