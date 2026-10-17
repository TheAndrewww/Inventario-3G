// Rediseño 2 · Producción · los filtros del tablero como tira de cifras (antes: 4 tarjetas de números + píldoras).
// Son los MISMOS filtros de hoy (useProduccionFilters: mismas reglas, uno a la vez), en el MISMO orden guardado por
// persona (produccion-filtros-orden:<id>) y se siguen reordenando arrastrando. Cada cifra dice cuántas obras deja ver ese
// filtro: se cuenta con el mismo hook, así el número siempre cuadra con la lista. No pide nada.
// Para la revisión final: TiraCifras de la fundación corta en 6 cifras y no se arrastra; aquí hay 8 y se arrastran.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useProduccionFilters } from '../../hooks/useProduccionFilters';
import { clases, numero } from '../fundacion/formato';
import { AYUDA_FILTRO, textoFiltro } from './filtros';

function CifraFiltro({ opcion, proyectos, activa, alElegir, arrastre }) {
  const { proyectosFiltrados } = useProduccionFilters(proyectos, opcion.value);
  const alarma = opcion.value === 'urgentes' && proyectosFiltrados.length > 0;
  return (
    <button type="button" className={clases('r2-tira-cifra r2-prod-cifra', activa && 'r2-tira-cifra--activa', arrastre.clase)}
      aria-pressed={activa} title={`${AYUDA_FILTRO[opcion.value] || textoFiltro(opcion)} · arrastra para mover`}
      onClick={alElegir} {...arrastre.props}>
      {alarma && <span className="r2-tira-punto r2-tono--aviso" aria-hidden="true" />}
      <span className="r2-tira-valor">{numero(proyectosFiltrados.length)}</span>
      <span className="r2-tira-texto">{textoFiltro(opcion)}</span>
      {activa && <Check size={16} aria-hidden="true" className="r2-tira-palomita" />}
    </button>
  );
}

/**
 * orden: lista de opciones en el orden de la persona; guardar(nuevas) lo guarda (mismo efecto que hoy); personalizado y
 * alOrdenOriginal para «Orden original».
 */
export function TiraFiltrosObras({ orden, guardar, personalizado, alOrdenOriginal, filtro, setFiltro, proyectos }) {
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const soltarEn = (destino) => {
    if (arrastrando === null || arrastrando === destino) return;
    const nuevas = [...orden];
    const desde = nuevas.findIndex((o) => o.value === arrastrando);
    const hacia = nuevas.findIndex((o) => o.value === destino);
    if (desde < 0 || hacia < 0) return;
    const [movida] = nuevas.splice(desde, 1);
    nuevas.splice(hacia, 0, movida);
    guardar(nuevas);
  };
  const arrastre = (op) => ({
    clase: clases(arrastrando === op.value && 'r2-prod-cifra--arrastrando', sobre === op.value && arrastrando !== op.value && 'r2-prod-cifra--soltar'),
    props: {
      draggable: true,
      onDragStart: (e) => { setArrastrando(op.value); e.dataTransfer.effectAllowed = 'move'; },
      onDragOver: (e) => { e.preventDefault(); if (sobre !== op.value) setSobre(op.value); },
      onDragLeave: () => setSobre((s) => (s === op.value ? null : s)),
      onDrop: (e) => { e.preventDefault(); soltarEn(op.value); setArrastrando(null); setSobre(null); },
      onDragEnd: () => { setArrastrando(null); setSobre(null); },
    },
  });

  return (
    <div className="r2-tira r2-prod-tira" role="group" aria-label="Filtrar obras (arrastra una cifra para cambiar el orden)">
      {orden.map((op) => {
        const a = arrastre(op);
        if (op.value === '_separator') {
          return <span key="_sep" className={clases('r2-prod-tira-separador', a.clase)} title="Arrastra para mover" aria-hidden="true" {...a.props} />;
        }
        return (
          <CifraFiltro key={op.value} opcion={op} proyectos={proyectos} activa={filtro === op.value}
            alElegir={() => setFiltro(op.value)} arrastre={a} />
        );
      })}
      {personalizado && (
        <button type="button" className="r2-quitar-filtros r2-prod-orden-original" onClick={alOrdenOriginal} title="Regresar los filtros al orden original">
          Orden original
        </button>
      )}
    </div>
  );
}
