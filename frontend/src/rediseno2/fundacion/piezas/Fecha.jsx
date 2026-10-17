// Rediseño 2 · fecha legible (DISENO-v2 §4.9): texto relativo y la fecha exacta al pasar el cursor, en <time>.
//
// <Fecha valor={ticket.created_at} />            → «hace 12 min» · «hoy 10:20» · «ayer 16:05» · «el lunes» · «15 oct»
// <Fecha valor={cita.inicio} modo="cita" />      → «jue 15 oct · 9:00»
// <Fecha valor={orden.fecha} modo="corta" />     → «15 oct»
// <Fecha valor={datos.hora} modo="hora" />       → «10:41»
//
// Props: valor (Date, ISO o 'YYYY-MM-DD'), modo ('relativa' | 'cita' | 'corta' | 'hora'), vacio (texto si no hay fecha, «—»).
import { aFecha, fechaRelativa, fechaExacta, fechaCita, fechaCorta, horaCorta, clases } from '../formato';

const FORMAS = { relativa: fechaRelativa, cita: fechaCita, corta: fechaCorta, hora: horaCorta };

export function Fecha({ valor, modo = 'relativa', vacio = '—', className }) {
  const f = aFecha(valor);
  if (!f) return <span className={clases('r2-fecha', className)}>{vacio}</span>;
  const iso = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : f.toISOString();
  return (
    <time className={clases('r2-fecha', className)} dateTime={iso} title={fechaExacta(valor)}>
      {(FORMAS[modo] || fechaRelativa)(valor)}
    </time>
  );
}
