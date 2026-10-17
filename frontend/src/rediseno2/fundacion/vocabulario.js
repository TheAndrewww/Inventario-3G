// Rediseño 2 · vocabulario de estados (DISENO-v2 §3.4): las MISMAS palabras y tonos en la TV, el tablero, el calendario y
// las fichas. Solo traduce el valor que ya trae el servidor a texto en pantalla; no cambia ningún valor.
//
//   estadoDe('orden', 'pendiente_aprobacion') → { texto: 'Por aprobar', tono: 'aviso' }
//   estadoDe('ticket', 'algo_nuevo')          → { texto: 'algo_nuevo', tono: 'neutro' }   (lo desconocido sale tal cual)
//   tipoTrabajo('MTO')                        → { texto: 'Mantenimiento', clase: 'mantenimiento' }
//
// Tonos: 'ok' · 'aviso' · 'mal' · 'info' · 'neutro'. «Urgente» es aviso salvo en prioridad (mal). Lo elegido nunca es rojo.
// Anexo A, 1: la etapa `instalacion` se llama «Lista para instalar» y `completado` «Cerrada» (se cambia aquí si el dueño
// dice que no).

export const VOCABULARIO = {
  etapa: {
    pendiente: ['Por empezar', 'neutro'],
    diseno: ['En diseño', 'info'],
    compras: ['En compras', 'info'],
    produccion: ['En producción', 'info'],
    instalacion: ['Lista para instalar', 'ok'],
    completado: ['Cerrada', 'neutro'],
    pausada: ['Pausada', 'neutro'],
  },
  prioridad: {
    urgente: ['Urgente', 'mal'],
    alta: ['Alta', 'aviso'],
    media: ['Media', 'neutro'],
    baja: ['Baja', 'neutro'],
  },
  // Movimiento.estado (tickets de material)
  ticket: {
    pendiente: ['Por preparar', 'aviso'],
    aprobado: ['Por preparar', 'aviso'],
    pendiente_aprobacion: ['Pendiente de aprobación', 'aviso'],
    rechazado: ['Rechazado', 'mal'],
    listo_para_entrega: ['Listo para entregar', 'info'],
    entregado: ['Entregado', 'ok'],
    completado: ['Entregado', 'ok'],
    cancelado: ['Anulado', 'neutro'],
    por_revisar: ['Por revisar · cierre de obra', 'aviso'],
  },
  // OrdenCompra.estado
  orden: {
    pendiente_aprobacion: ['Por aprobar', 'aviso'],
    borrador: ['Borrador', 'neutro'],
    enviada: ['Enviada', 'info'],
    parcial: ['Recibida en parte', 'aviso'],
    recibida: ['Recibida', 'ok'],
    cancelada: ['Cancelada', 'neutro'],
    rechazada: ['Rechazada', 'mal'],
  },
  // SolicitudCompra.estado
  solicitud: {
    pendiente: ['Pendiente', 'aviso'],
    en_orden: ['En orden de compra', 'info'],
    completada: ['Completada', 'ok'],
    cancelada: ['Cancelada', 'neutro'],
  },
  articulo: {
    agotado: ['Agotado', 'mal'],
    bajo_minimo: ['Bajo mínimo', 'aviso'],
    por_autorizar: ['Nuevo por autorizar', 'info'],
    desactivado: ['Desactivado', 'neutro'],
  },
  // SolicitudCambio.estado
  cambio: {
    pendiente: ['Pendiente', 'aviso'],
    aprobada: ['Aprobado', 'ok'],
    rechazada: ['Rechazado', 'mal'],
  },
  // AvisoWhatsApp.estado
  aviso: {
    enviado: ['Enviado', 'ok'],
    pendiente: ['En cola', 'aviso'],
    error: ['Falló', 'mal'],
    descartado: ['Reemplazado', 'neutro'],
  },
  // UnidadHerramientaRenta.estado
  herramienta: {
    buen_estado: ['Buena', 'ok'],
    estado_regular: ['Regular', 'aviso'],
    mal_estado: ['Mala', 'mal'],
    en_reparacion: ['En reparación', 'aviso'],
    perdida: ['Perdida', 'mal'],
    baja: ['De baja', 'neutro'],
    disponible: ['Disponible', 'ok'],
    asignada: ['Asignada', 'info'],
    en_transito: ['En tránsito', 'info'],
    pendiente_devolucion: ['Pendiente de devolución', 'aviso'],
  },
  rollo: {
    disponible: ['Disponible', 'ok'],
    en_uso: ['En uso', 'info'],
    agotado: ['Agotado', 'neutro'],
  },
  conteo: {
    exacto: ['Exacto', 'ok'],
    diferencia: ['Con diferencia', 'mal'],
    por_contar: ['Por contar', 'neutro'],
  },
  foto: {
    en_cola: ['En cola', 'neutro'],
    pendiente: ['En cola', 'neutro'],
    procesando: ['Procesando', 'info'],
    lista: ['Lista', 'ok'],
    completado: ['Lista', 'ok'],
    error: ['Falló', 'mal'],
  },
  usuario: {
    activo: ['Activo', null],
    inactivo: ['Inactivo', 'neutro'],
  },
  campana: {
    good: ['Bien', 'ok'],
    bad: ['Mal', 'mal'],
  },
  anuncio: {
    generado: ['Generado', 'ok'],
    generado_ahora: ['Generado ahora', 'ok'],
    generando: ['Generando…', 'info'],
    pendiente: ['Pendiente', 'aviso'],
    error: ['Error', 'mal'],
  },
};

/** Texto y tono de un estado. Lo que no está en el vocabulario sale tal cual, en neutro (no se inventa nada). */
export function estadoDe(dominio, valor) {
  const lista = VOCABULARIO[dominio] || {};
  const clave = String(valor ?? '').trim();
  const par = lista[clave] || lista[clave.toLowerCase()];
  if (par) return { texto: par[0], tono: par[1] };
  return { texto: clave || '—', tono: 'neutro' };
}

/** Tipo de trabajo con su nombre completo. «A/B/C» como «Tipo A» en texto neutro. Lo demás, tal cual. */
export function tipoTrabajo(tipo) {
  const t = String(tipo || '').toUpperCase().trim();
  if (!t) return null;
  if (t === 'MTO' || t === 'MANTENIMIENTO') return { texto: 'Mantenimiento', clase: 'mantenimiento' };
  if (t === 'GTIA' || t === 'GARANTIA' || t === 'GARANTÍA') return { texto: 'Garantía', clase: 'garantia' };
  if (t === 'INSTALACION' || t === 'INSTALACIÓN') return { texto: 'Instalación', clase: 'instalacion' };
  if (t === 'A' || t === 'B' || t === 'C') return { texto: `Tipo ${t}`, clase: null };
  return { texto: String(tipo).trim(), clase: null };
}

/** Nombre de cada área de producción, con su color (punto de la terminal y de la TV). */
export const AREAS = {
  diseno: { nombre: 'Diseño', color: 'var(--g3-info)' },
  compras: { nombre: 'Compras', color: 'var(--g3-garantia)' },
  manufactura: { nombre: 'Manufactura', color: 'var(--g3-aviso)' },
  herreria: { nombre: 'Herrería', color: 'var(--g3-mantenimiento)' },
  instalacion: { nombre: 'Instalación', color: 'var(--g3-ok)' },
};
