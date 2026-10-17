// Rediseño 2 · confirmaciones y avisos (DISENO-v2 §4.15). Son las MISMAS de la ola 2 (diseno-3g/dialogosG3.js), aquí solo
// se reexportan para importar todo de la fundación. Mismo texto de pregunta que hoy y la MISMA petición después.
//
//   if (await confirmarG3({ titulo: '¿Anular el ticket T-1042?', texto: '…', antes: …, despues: …, confirmar: 'Anular ticket',
//        cancelar: 'No anular', peligro: true })) { …la misma petición de siempre… }
//   const motivo = await pedirTextoG3({ titulo: 'Motivo del rechazo', etiqueta: 'Motivo' });  // = lo que daría prompt()
//   avisoG3('Orden aprobada.', 'ok');
//
// Si mueve inventario, dinero o avisa a un cliente, la confirmación muestra ANTES → DESPUÉS con datos que ya están en pantalla.
export { confirmarG3, pedirTextoG3, avisoG3, g3Activo } from '../../../diseno-3g/dialogosG3';
