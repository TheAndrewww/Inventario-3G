// Rediseño 2 · tira de cifras (DISENO-v2 §4.2): UNA línea de cifras que filtran la lista de abajo. Reemplaza a las tarjetas
// de números. Máximo 6 cifras; en celular se desplaza de lado (nunca se apila).
//
// <TiraCifras etiqueta="Órdenes por estado"
//   cifras={[
//     { id: 'por_aprobar', valor: 6, texto: 'Por aprobar', activa: filtro === 'por_aprobar', alElegir: () => setFiltro('por_aprobar') },
//     { id: 'atrasadas', valor: 3, texto: 'Atrasadas', tono: 'mal', alElegir: … },   // tono = punto de alarma de 8 px
//   ]}
//   informativas={[{ valor: dinero(total), texto: 'Total del mes' }]} />
//
// Props: cifras [{id, valor, texto, tono ('mal' | 'aviso' | 'ok' | 'info'; solo cuando la cifra es una alarma), activa,
// alElegir, titulo}], informativas [{valor, texto}] (no filtran: van al final como texto), etiqueta (aria-label).
import { Check } from 'lucide-react';
import { numero, clases } from '../formato';

export function TiraCifras({ cifras = [], informativas = [], etiqueta = 'Cifras', className }) {
  const lista = cifras.filter(Boolean).slice(0, 6);
  const info = informativas.filter(Boolean);
  if (!lista.length && !info.length) return null;
  return (
    <div className={clases('r2-tira', className)} role="group" aria-label={etiqueta}>
      {lista.map((c) => {
        const valor = typeof c.valor === 'number' ? numero(c.valor) : c.valor;
        const contenido = (
          <>
            {c.tono && <span className={clases('r2-tira-punto', `r2-tono--${c.tono}`)} aria-hidden="true" />}
            <span className="r2-tira-valor">{valor}</span>
            <span className="r2-tira-texto">{c.texto}</span>
            {c.activa && <Check size={16} aria-hidden="true" className="r2-tira-palomita" />}
          </>
        );
        return c.alElegir ? (
          <button key={c.id || c.texto} type="button" className={clases('r2-tira-cifra', c.activa && 'r2-tira-cifra--activa')}
            aria-pressed={Boolean(c.activa)} title={c.titulo} onClick={c.alElegir}>
            {contenido}
          </button>
        ) : (
          <span key={c.id || c.texto} className="r2-tira-cifra r2-tira-cifra--fija" title={c.titulo}>{contenido}</span>
        );
      })}
      {info.length > 0 && (
        <span className="r2-tira-info">
          {info.map((c) => (
            <span key={c.texto} className="r2-tira-dato">
              <span className="r2-tira-texto">{c.texto}</span>
              <span className="r2-tira-valor r2-tira-valor--info">{typeof c.valor === 'number' ? numero(c.valor) : c.valor}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
