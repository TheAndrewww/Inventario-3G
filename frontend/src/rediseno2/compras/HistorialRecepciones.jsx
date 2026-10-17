// Rediseño 2 · Compras · historial de recepciones de una orden (vista ENCENDIDA de HistorialRecepcionesOrden).
// Arriba el avance por artículo (tabla, no tarjetas); abajo cada recepción en un renglón que se despliega. Se usa en su propio
// cajón (desde «⋯ › Historial de recepciones») o plegado al pie del cajón «Recibir» (incrustado). Las dos peticiones son las
// mismas de hoy y se hacen al abrirlo.
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Tabla, Estado, Boton, Cargando, Vacio, Nota, Fecha, numero, plural,
} from '../fundacion';
import './compras.css';

function Contenido({ loading, progreso, recepciones, expandidos, toggleExpandir }) {
  if (loading) return <Cargando forma="ficha" filas={5} etiqueta="Cargando el historial de recepciones…" />;
  const r = progreso?.resumen;
  return (
    <>
      {progreso && (
        <SeccionCajon titulo="Avance por artículo">
          <div className="r2c-progreso-cab">
            <span className="r2c-sec">
              {plural(r.total_articulos, 'artículo', 'artículos')} · {plural(r.articulos_completos, 'completo', 'completos')} · {plural(r.articulos_pendientes, 'pendiente', 'pendientes')}
            </span>
            <span className="r2c-num r2c-fuerte">{numero(r.porcentaje_total)} %</span>
          </div>
          <div className="r2c-progreso" role="progressbar" aria-valuenow={r.porcentaje_total} aria-valuemin={0} aria-valuemax={100}
            aria-label="Avance total de la recepción"><span style={{ width: `${Math.min(100, r.porcentaje_total)}%` }} /></div>
          <Tabla etiqueta="Avance por artículo" densidad="compacta" fija={false} clave="detalle_id" filas={progreso.articulos}
            columnas={[
              { id: 'articulo', titulo: 'Artículo', celda: (a) => a.articulo },
              { id: 'recibido', titulo: 'Recibido', alinear: 'der', celda: (a) => `${numero(a.cantidad_recibida)} de ${numero(a.cantidad_solicitada)} ${a.unidad || ''}` },
              {
                id: 'estado', titulo: 'Estado',
                celda: (a) => (a.completo
                  ? <Estado tono="ok" texto="Completo" />
                  : <Estado tono="aviso" texto={`Faltan ${numero(a.pendiente)}`} detalle={`${numero(a.porcentaje)} % recibido`} />),
              },
            ]}
            filaCelular={(a) => ({
              principal: a.articulo,
              secundario: `${numero(a.cantidad_recibida)} de ${numero(a.cantidad_solicitada)} ${a.unidad || ''}`,
              debajo: a.completo ? <Estado tono="ok" texto="Completo" /> : <Estado tono="aviso" texto={`Faltan ${numero(a.pendiente)}`} />,
            })} />
        </SeccionCajon>
      )}
      <SeccionCajon titulo={`Recepciones · ${recepciones.length}`}>
        {recepciones.length === 0 ? (
          <Vacio compacto titulo="Todavía no hay recepciones" texto="Cuando se registre lo que llegó de esta orden aparecerá aquí." />
        ) : (
          <ul className="r2c-recepciones">
            {recepciones.map((rec, i) => {
              const abierta = Boolean(expandidos[rec.id]);
              return (
                <li key={rec.id} className="r2c-recepcion">
                  <button type="button" className="r2c-plegable r2c-plegable--fila" aria-expanded={abierta} onClick={() => toggleExpandir(rec.id)}>
                    {abierta ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                    <span className="r2c-celda-doble">
                      <span className="r2c-fuerte">{i + 1}. {rec.ticket_id}</span>
                      <span className="r2c-sec"><Fecha valor={rec.fecha_hora} /> · {rec.usuario?.nombre}</span>
                    </span>
                    <span className="r2c-num r2c-fuerte r2c-empuja-derecha">{plural(rec.total_piezas, 'unidad', 'unidades')}</span>
                  </button>
                  {abierta && (
                    <div className="r2c-recepcion-cuerpo">
                      {rec.observaciones && <Nota>Observaciones: {rec.observaciones}</Nota>}
                      <ul className="r2c-lista-filas">
                        {rec.detalles.map((d) => (
                          <li key={d.id}>
                            <span className="r2c-celda-doble">
                              <span>{d.articulo.nombre}</span>
                              {d.observaciones && <span className="r2c-sec">{d.observaciones}</span>}
                            </span>
                            <span className="r2c-num r2c-fuerte">{numero(Math.round(parseFloat(d.cantidad)))} {d.articulo.unidad}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SeccionCajon>
    </>
  );
}

export default function HistorialRecepciones(p) {
  const { orden, onClose, incrustado } = p;
  if (incrustado) return <Contenido {...p} />;
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta={`Historial de recepciones de ${orden?.ticket_id || ''}`}>
      <CajonCabecera titulo="Historial de recepciones" dato={`${orden?.ticket_id || ''} · ${orden?.proveedor?.nombre || 'Sin proveedor'}`} alCerrar={onClose} />
      <CajonCuerpo><Contenido {...p} /></CajonCuerpo>
      <CajonPie><Boton nivel="contorno" alHacer={onClose}>Cerrar</Boton></CajonPie>
    </Cajon>
  );
}
