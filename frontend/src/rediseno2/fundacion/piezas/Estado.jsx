// Rediseño 2 · estado, tipo de trabajo y plazo (DISENO-v2 §4.8). Siempre color Y texto; una sola marca de estado por renglón.
//
// <Estado dominio="orden" valor={orden.estado} />                     → ● Por aprobar (aviso)
// <Estado tono="mal" texto="Falló" detalle="Número no registrado" />  → con el motivo debajo
// <TipoTrabajo tipo={obra.tipo_proyecto} />                           → etiqueta «Mantenimiento» (turquesa); «Tipo B» neutro
// <Plazo fecha={obra.fecha_limite} />                                 → «3 días tarde» (mal) con la fecha exacta al pasar el cursor
//
// Estado: tono ('ok'|'aviso'|'mal'|'info'|'neutro'), texto, detalle, o dominio + valor (vocabulario.js). sinPunto quita el
// punto (p. ej. dentro de un texto). Plazo: fecha (Date o 'YYYY-MM-DD'), prefijo («Entrega: »), sinColor.
import { estadoDe, tipoTrabajo } from '../vocabulario';
import { plazo, fechaExacta, clases } from '../formato';

export function Estado({ tono, texto, detalle, dominio, valor, sinPunto = false, className }) {
  const v = dominio ? estadoDe(dominio, valor) : null;
  const t = texto ?? v?.texto ?? '';
  const tn = tono ?? v?.tono ?? 'neutro';
  if (!t) return null;
  return (
    <span className={clases('r2-estado', tn && `r2-tono--${tn}`, className)}>
      <span className="r2-estado-linea">
        {!sinPunto && tn && <span className="r2-estado-punto" aria-hidden="true" />}
        <span className="r2-estado-texto">{t}</span>
      </span>
      {detalle && <span className="r2-estado-detalle">{detalle}</span>}
    </span>
  );
}

export function TipoTrabajo({ tipo, className }) {
  const t = tipoTrabajo(tipo);
  if (!t) return null;
  return <span className={clases('r2-tipo', t.clase ? `r2-tipo--${t.clase}` : 'r2-tipo--neutro', className)}>{t.texto}</span>;
}

export function Plazo({ fecha, prefijo, sinColor = false, className }) {
  const p = plazo(fecha);
  const exacta = fechaExacta(fecha);
  return (
    <span className={clases('r2-plazo', !sinColor && p.tono && `r2-tono--${p.tono}`, className)} title={exacta || undefined}>
      {!sinColor && p.tono && <span className="r2-estado-punto" aria-hidden="true" />}
      {prefijo}{p.texto}
    </span>
  );
}
