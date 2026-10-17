// Rediseño 2 · Producción · piezas chicas del renglón de una obra (tablero y cajón).
//  <Segmentos pasos={pasos} />            los cinco pasos en una línea (Diseño · Compras · Manufactura · Herrería · Lista)
//  <TextoTono tono="mal">3 días tarde</TextoTono>
//  <FechaMaxima info={fechaMaximaDe(p)} />
import { clases, fechaCorta, fechaExacta } from '../fundacion/formato';

const ORDEN = ['diseno', 'compras', 'manufactura', 'herreria', 'instalacion'];
const PALABRA = {
  hecha: 'terminada', curso: 'en curso', pronto: 'en curso, vence pronto', tarde: 'atrasada', pendiente: 'por hacer', noaplica: 'no aplica',
};

/** Resumen en palabras de los pasos (para lectores de pantalla y para el texto al pasar el cursor). */
const resumenPasos = (pasos) => ORDEN.map((k) => pasos.find((p) => p.clave === k)).filter(Boolean)
  .map((p) => `${p.nombre}: ${PALABRA[p.estado] || p.estado}`).join(' · ');

export function Segmentos({ pasos, className }) {
  const lista = ORDEN.map((k) => pasos.find((p) => p.clave === k) || { clave: k, estado: 'noaplica' });
  const resumen = resumenPasos(pasos);
  return (
    <span className={clases('r2-prod-segmentos', className)} role="img" aria-label={resumen} title={resumen}>
      {lista.map((p) => <span key={p.clave} className={clases('r2-prod-seg', `r2-prod-seg--${p.estado}`, p.clave === 'manufactura' && 'r2-prod-seg--par')} />)}
    </span>
  );
}

export function TextoTono({ tono, children, className }) {
  if (!children) return null;
  return <span className={clases('r2-prod-texto', tono && `r2-tono--${tono}`, tono === 'mal' && 'r2-prod-texto--fuerte', className)}>{children}</span>;
}

/** «14 oct» y debajo «2 días tarde» con el color del recuadro «Fecha máxima» de hoy. */
export function FechaMaxima({ info, enLinea = false }) {
  if (!info) return <span className="r2-prod-sin-dato">Sin fecha</span>;
  const exacta = fechaExacta(info.fecha);
  if (enLinea) {
    return (
      <span className="r2-prod-maxima r2-prod-maxima--linea" title={exacta}>
        <span className="r2-num">{fechaCorta(info.fecha)}</span>
        {info.texto && <TextoTono tono={info.tono}> · {info.texto}</TextoTono>}
      </span>
    );
  }
  return (
    <span className="r2-prod-maxima" title={exacta}>
      <span className="r2-prod-maxima-fecha r2-num">{fechaCorta(info.fecha)}</span>
      {info.texto && (
        <span className={clases('r2-plazo', info.tono && `r2-tono--${info.tono}`)}>
          {info.tono && <span className="r2-estado-punto" aria-hidden="true" />}
          {info.texto}
        </span>
      )}
    </span>
  );
}
