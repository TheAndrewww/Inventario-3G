// Rediseño 2 · barra fija de acción (DISENO-v2 §4.12): para pantallas donde se arma algo y se confirma al final (Orden de
// salida, Checklist, Entradas y salidas, Ajustar stocks, Recibir, selección de etiquetas o fotos).
// 64 px, pegada abajo de la zona de contenido; a la izquierda el resumen, a la derecha la acción principal. En celular queda
// ENCIMA de la barra inferior. Cuando todavía no se puede, dice qué falta (no un botón gris mudo).
// La <Pagina> que la use lleva espacioInferior para que el contenido no quede debajo.
//
// <BarraAccion resumen="4 artículos · 4 pzas · $403.28"
//   falta={faltan > 0 ? `Faltan ${faltan} de ${total} artículos` : null}
//   principal={{ texto: 'Finalizar ticket', icono: Check, alHacer: finalizar, cargando: guardando }}
//   secundaria={{ texto: 'Vaciar', alHacer: vaciar }} />
//
// Props: resumen (texto o nodo), falta (si hay texto, la principal se deshabilita y se lee el motivo), principal {texto,
// icono, alHacer, cargando, deshabilitado, tipo}, secundaria {texto, alHacer, icono}, children (más cosas a la derecha).
import { Boton } from './Boton';
import { clases } from '../formato';

export function BarraAccion({ resumen, falta, principal, secundaria, children, className }) {
  return (
    <div className={clases('r2-barra-accion', className)} role="region" aria-label="Acción">
      <div className="r2-barra-accion-dentro">
        <div className="r2-barra-accion-resumen">
          {resumen && <span className="r2-barra-accion-texto">{resumen}</span>}
          {falta && <span className="r2-barra-accion-falta" role="status">{falta}</span>}
        </div>
        <div className="r2-barra-accion-botones">
          {children}
          {secundaria && <Boton nivel="fantasma" icono={secundaria.icono} alHacer={secundaria.alHacer}>{secundaria.texto}</Boton>}
          {principal && (
            <Boton nivel="principal" icono={principal.icono} alHacer={principal.alHacer} cargando={principal.cargando} tipo={principal.tipo}
              deshabilitado={Boolean(falta) || principal.deshabilitado} motivo={falta || principal.motivo}>
              {principal.texto}
            </Boton>
          )}
        </div>
      </div>
    </div>
  );
}
