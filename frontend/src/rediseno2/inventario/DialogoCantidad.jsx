// Rediseño 2 · grupo inventario · diálogo corto para mover existencia (entrada, salida, descontar, descontar metros).
// Pinta el nombre completo del artículo, lo que hay hoy, la cantidad en grande, las observaciones y la vista previa en vivo
// «48 → 58 pzas». El botón dice el verbo y la cantidad. No guarda nada por su cuenta: llama al manejador de la página.
//
// <DialogoCantidad abierto={…} alCerrar={cerrar} titulo="Registrar entrada" nombre={art.nombre}
//   datos={[['Existencia', '48 pzas'], ['Ubicación', 'A-03-1']]} etiqueta="Cantidad a ingresar"
//   valor={cantidad} alCambiar={(t) => …} paso="1" unidad="pzas" todo={48}
//   observaciones={obs} alCambiarObservaciones={setObs} ejemploObservaciones="…"
//   previa={{ antes: '48', despues: '58', unidad: 'pzas', tono: null, aviso: null }}
//   boton={{ texto: 'Registrar entrada de 10 pzas', alHacer: guardar, cargando, deshabilitado }} nota="…" />
import { ArrowRight } from 'lucide-react';
import { Dialogo } from '../fundacion/piezas/Dialogo';
import { Boton } from '../fundacion/piezas/Boton';
import { Campo, Entrada } from '../fundacion/piezas/Campos';
import { Datos } from '../fundacion/piezas/Datos';
import { clases } from '../fundacion/formato';

export default function DialogoCantidad({
  abierto, alCerrar, titulo, nombre, datos = [], etiqueta, valor, alCambiar, paso = 'any', min = '0', unidad, todo,
  refCantidad, alEnter, observaciones, alCambiarObservaciones, etiquetaObservaciones = 'Observaciones', ejemploObservaciones,
  refObservaciones, previa, nota, boton, cancelar = 'Cancelar', error,
}) {
  const enter = (e) => { if (e.key === 'Enter' && alEnter) { e.preventDefault(); alEnter(); } };
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo} tamano="sm" cerrarConEsc
      pie={(
        <>
          <Boton nivel="fantasma" alHacer={alCerrar} deshabilitado={boton?.cargando}>{cancelar}</Boton>
          <Boton nivel="principal" alHacer={boton?.alHacer} cargando={boton?.cargando} deshabilitado={boton?.deshabilitado}
            motivo={boton?.motivo}>{boton?.texto}</Boton>
        </>
      )}>
      <div className="r2-inv-dialogo">
        {nombre && <p className="r2-inv-dialogo-nombre">{nombre}</p>}
        {datos.length > 0 && <Datos datos={datos} columnas={2} className="r2-inv-dialogo-datos" />}
        <Campo etiqueta={etiqueta} requerido error={error}>
          <span className="r2-inv-cantidad-fila">
            <Entrada ref={refCantidad} type="number" inputMode="decimal" min={min} step={paso} value={valor ?? ''} placeholder="0"
              className="r2-inv-cantidad-grande" onChange={(e) => alCambiar?.(e.target.value)} onKeyDown={enter} autoFocus />
            {unidad && <span className="r2-inv-cantidad-unidad">{unidad}</span>}
            {todo != null && (
              <Boton nivel="contorno" tamano="chico" alHacer={() => alCambiar?.(String(todo))} title="Poner toda la existencia">Todo</Boton>
            )}
          </span>
        </Campo>
        {previa && (
          <p className={clases('r2-inv-previa', previa.tono && `r2-tono--${previa.tono}`)} role="status">
            {previa.aviso ? previa.aviso : (
              <>
                <span className="r2-inv-previa-etq">Queda</span>
                <span className="r2-num">{previa.antes}</span>
                <ArrowRight size={16} aria-hidden="true" />
                <strong className="r2-num">{previa.despues}</strong>
                {previa.unidad && <span>{previa.unidad}</span>}
              </>
            )}
          </p>
        )}
        {alCambiarObservaciones && (
          <Campo etiqueta={etiquetaObservaciones}>
            <Entrada ref={refObservaciones} type="text" value={observaciones ?? ''} placeholder={ejemploObservaciones}
              onChange={(e) => alCambiarObservaciones(e.target.value)} onKeyDown={enter} />
          </Campo>
        )}
        {nota && <p className="r2-nota">{nota}</p>}
      </div>
    </Dialogo>
  );
}
