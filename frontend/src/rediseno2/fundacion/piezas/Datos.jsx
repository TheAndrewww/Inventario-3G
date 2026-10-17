// Rediseño 2 · datos, historial y mensaje (DISENO-v2 §4.14).
//
// <Datos columnas={2} datos={[['Proveedor', o.proveedor], ['Total', dinero(o.total)], { etiqueta: 'Notas', valor: o.notas, ancho: 'doble' }]} />
// <LineaTiempo eventos={[{ id: 1, texto: 'Orden aprobada', quien: 'Dirección', cuando: o.fecha_aprobacion, tono: 'ok' }]} />
// <Mensaje de="Planta" para="Grupo Producción" texto={aviso.mensaje} fecha={aviso.created_at} estado={<Estado dominio="aviso" valor={aviso.estado} />} />
//
// Datos: datos ([etiqueta, valor] o {etiqueta, valor, tono, ancho: 'doble', numero}), columnas (1 | 2), vacio («—»).
// LineaTiempo: eventos [{id, texto, detalle, quien, cuando, tono}] (sin tarjetas por evento).
// Mensaje: el texto TAL CUAL se mandó (saltos de línea incluidos; no se edita ni se reenvía desde aquí), de, para, fecha, estado.
import { Fecha } from './Fecha';
import { clases } from '../formato';

export function Datos({ datos = [], columnas = 1, vacio = '—', className }) {
  const lista = datos.filter(Boolean).map((d) => (Array.isArray(d) ? { etiqueta: d[0], valor: d[1] } : d));
  return (
    <dl className={clases('r2-datos', columnas === 2 && 'r2-datos--dos', className)}>
      {lista.map((d) => (
        <div key={d.etiqueta} className={clases('r2-dato', d.ancho === 'doble' && 'r2-dato--doble')}>
          <dt>{d.etiqueta}</dt>
          <dd className={clases(d.tono && `r2-tono--${d.tono}`, d.numero && 'r2-num')}>
            {d.valor === null || d.valor === undefined || d.valor === '' ? vacio : d.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LineaTiempo({ eventos = [], vacio = 'Sin movimientos todavía.', className }) {
  const lista = eventos.filter(Boolean);
  if (!lista.length) return <p className="r2-nota">{vacio}</p>;
  return (
    <ol className={clases('r2-linea-tiempo', className)}>
      {lista.map((e, i) => (
        <li key={e.id ?? i} className={clases('r2-evento', e.tono && `r2-tono--${e.tono}`)}>
          <span className="r2-evento-punto" aria-hidden="true" />
          <div className="r2-evento-cuerpo">
            <p className="r2-evento-texto">{e.texto}</p>
            {e.detalle && <p className="r2-evento-detalle">{e.detalle}</p>}
            {(e.quien || e.cuando) && (
              <p className="r2-evento-meta">
                {e.quien}{e.quien && e.cuando && ' · '}{e.cuando && <Fecha valor={e.cuando} />}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Mensaje({ texto, de = 'Planta', para, fecha, estado, className }) {
  return (
    <figure className={clases('r2-mensaje', className)}>
      <figcaption className="r2-mensaje-cab">De {de}{para && <> · para {para}</>}</figcaption>
      <div className="r2-mensaje-burbuja">{texto}</div>
      {(fecha || estado) && (
        <div className="r2-mensaje-pie">
          {fecha && <Fecha valor={fecha} />}
          {estado}
        </div>
      )}
    </figure>
  );
}
