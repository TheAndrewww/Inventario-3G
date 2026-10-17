// Rediseño 2 · Producción · «Ordenar filtros» con flechas (para el celular, la tableta y el teclado, donde arrastrar no
// sirve). Guarda en la MISMA clave que arrastrar (produccion-filtros-orden:<id>) con la misma función de la página.
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Dialogo, Boton, BotonIcono } from '../fundacion';
import { textoFiltro } from './filtros';

export function DialogoOrdenFiltros({ abierto, alCerrar, orden, guardar, personalizado, alOrdenOriginal }) {
  const mover = (i, paso) => {
    const j = i + paso;
    if (j < 0 || j >= orden.length) return;
    const nuevas = [...orden];
    const [movida] = nuevas.splice(i, 1);
    nuevas.splice(j, 0, movida);
    guardar(nuevas);
  };
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Ordenar filtros" tamano="sm" cerrarConEsc
      pie={(
        <>
          {personalizado && <Boton nivel="fantasma" alHacer={alOrdenOriginal}>Orden original</Boton>}
          <Boton nivel="principal" alHacer={alCerrar}>Listo</Boton>
        </>
      )}>
      <p className="r2-nota r2-prod-orden-ayuda">El orden se guarda para ti en este navegador, igual que al arrastrar las cifras.</p>
      <ol className="r2-prod-orden-lista">
        {orden.map((op, i) => (
          <li key={op.value} className="r2-prod-orden-fila">
            <span className={op.value === '_separator' ? 'r2-prod-orden-separador' : 'r2-prod-orden-nombre'}>
              {op.value === '_separator' ? 'Separador' : textoFiltro(op)}
            </span>
            <BotonIcono icono={ArrowUp} etiqueta={`Subir ${op.value === '_separator' ? 'separador' : textoFiltro(op)}`} deshabilitado={i === 0} alHacer={() => mover(i, -1)} />
            <BotonIcono icono={ArrowDown} etiqueta={`Bajar ${op.value === '_separator' ? 'separador' : textoFiltro(op)}`} deshabilitado={i === orden.length - 1} alHacer={() => mover(i, 1)} />
          </li>
        ))}
      </ol>
    </Dialogo>
  );
}
