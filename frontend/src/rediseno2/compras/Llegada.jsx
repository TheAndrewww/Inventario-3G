// Rediseño 2 · Compras · llegada estimada de una orden con las palabras de una LLEGADA (no de un vencimiento):
// «Llega hoy», «Llega mañana», «En 4 días» o «3 días tarde» (en rojo), con la fecha exacta al pasar el cursor.
// Es la misma cuenta del Plazo de la fundación (formato.plazo); solo cambia la palabra.
import { plazo, fechaExacta, clases } from '../fundacion';
import { soloDia } from './comunes';

export default function Llegada({ fecha, className }) {
  const dia = soloDia(fecha);
  if (!dia) return <span className="r2c-tenue">Sin fecha</span>;
  const p = plazo(dia);
  const texto = p.texto === 'Vence hoy' ? 'Llega hoy' : p.texto === 'Vence mañana' ? 'Llega mañana' : p.texto;
  return (
    <span className={clases('r2-plazo', p.tono && `r2-tono--${p.tono}`, className)} title={fechaExacta(dia)}>
      {p.tono && <span className="r2-estado-punto" aria-hidden="true" />}
      {texto}
    </span>
  );
}
