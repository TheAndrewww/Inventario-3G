// Rediseño 2 · grupo inventario · Rollos de membrana (/rollos-membrana) encendido. DISENO-v2 §5.3.
// Tabla a todo lo ancho, ordenada por metros disponibles (lo que importa arriba); los artículos sin rollos van en un grupo
// plegado al final. Cada membrana abre un cajón ancho con sus rollos (filtros de estado, «Nuevo rollo» como decisión,
// «Descontar» por renglón y «Editar» / «Eliminar» en «⋯»). Mismo estado y mismas peticiones de la página.
import { Plus, Minus, Pencil, Trash2, Layers } from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { BarraFiltros } from '../fundacion/piezas/BarraFiltros';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Estado } from '../fundacion/piezas/Estado';
import { Fecha } from '../fundacion/piezas/Fecha';
import { Boton } from '../fundacion/piezas/Boton';
import { Segmentado } from '../fundacion/piezas/Pestanas';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Dialogo } from '../fundacion/piezas/Dialogo';
import { Campo, Entrada } from '../fundacion/piezas/Campos';
import { Cajon, CajonCabecera, CajonDecision, CajonCuerpo } from '../fundacion/piezas/Cajon';
import { useEsCelular } from '../fundacion/useDiseno3G';
import { numero, plural } from '../fundacion/formato';
import DialogoCantidad from './DialogoCantidad';
import { num, motivoLegible } from './ayudas';
import './inventario.css';

const ESTADOS_ROLLO = { disponible: ['Disponible', 'ok'], en_uso: ['En uso', 'info'], agotado: ['Agotado', 'neutro'] };
const metros = (v) => `${numero(num(v))} m`;

// Metraje restante con su línea fina de avance
function Restante({ rollo }) {
  const total = num(rollo.metraje_total);
  const resta = num(rollo.metraje_restante);
  const por = total > 0 ? Math.round((resta / total) * 100) : 0;
  return (
    <span className="r2-inv-restante">
      <span className="r2-num"><strong>{numero(resta)}</strong> de {numero(total)} m</span>
      <span className="r2-inv-restante-barra" role="img" aria-label={`Queda el ${por} %`}><span style={{ width: `${por}%` }} /></span>
    </span>
  );
}

export default function VistaRollos({ r }) {
  const celular = useEsCelular();
  const stats = (a) => a.rollos_stats || {};
  const conRollos = r.articulos.filter((a) => num(stats(a).total_rollos) > 0)
    .sort((a, b) => num(stats(b).metraje_total_disponible) - num(stats(a).metraje_total_disponible));
  const sinRollos = r.articulos.filter((a) => num(stats(a).total_rollos) === 0);
  const totalMetros = conRollos.reduce((n, a) => n + num(stats(a).metraje_total_disponible), 0);
  const abierto = r.vista === 'rollos' && r.articuloSeleccionado;
  const art = r.articuloSeleccionado;

  const columnas = [
    {
      id: 'membrana', titulo: 'Membrana', celda: (a) => (
        <span className="r2-inv-articulo">
          <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} ampliable={false} />
          <span className="r2-inv-articulo-texto">
            <span className="r2-inv-nombre">{a.nombre}</span>
            <span className="r2-inv-desc">{a.ubicacion?.codigo || ''}</span>
          </span>
        </span>
      ),
    },
    { id: 'metros', titulo: 'Metros disponibles', alinear: 'der', ancho: '16%', celda: (a) => <strong className="r2-num">{metros(stats(a).metraje_total_disponible)}</strong> },
    { id: 'rollos', titulo: 'Rollos', alinear: 'der', ancho: '10%', celda: (a) => numero(stats(a).total_rollos || 0) },
    { id: 'disp', titulo: 'Disponibles', alinear: 'der', ancho: '11%', ocultarEn: 'celular-ancho', celda: (a) => numero(stats(a).rollos_disponibles || 0) },
    { id: 'uso', titulo: 'En uso', alinear: 'der', ancho: '10%', ocultarEn: 'celular-ancho', celda: (a) => numero(stats(a).rollos_en_uso || 0) },
    { id: 'agotados', titulo: 'Agotados', alinear: 'der', ancho: '10%', ocultarEn: 'celular-ancho', celda: (a) => numero(stats(a).rollos_agotados || 0) },
  ];

  const filaRollo = [
    {
      id: 'rollo', titulo: 'Rollo', celda: (x) => (
        <span className="r2-inv-articulo-texto">
          <span className="r2-inv-nombre">{x.identificador}</span>
          {x.observaciones && <span className="r2-inv-desc">{x.observaciones}</span>}
        </span>
      ),
    },
    { id: 'color', titulo: 'Color', ocultarEn: 'celular-ancho', celda: (x) => x.color || '—' },
    { id: 'restante', titulo: 'Restante', alinear: 'der', ancho: '150px', celda: (x) => <Restante rollo={x} /> },
    { id: 'estado', titulo: 'Estado', celda: (x) => { const e = ESTADOS_ROLLO[x.estado] || ESTADOS_ROLLO.disponible; return <Estado tono={e[1]} texto={e[0]} />; } },
    { id: 'alta', titulo: 'Alta', ocultarEn: 'celular-ancho', celda: (x) => <Fecha valor={x.fecha_ingreso} /> },
  ];

  const cantDesc = r.cantidadDescuento;
  const resta = num(r.rolloDescuento?.metraje_restante);
  const excede = num(cantDesc) > resta;

  return (
    <Pagina titulo="Rollos de membrana" densidad="compacta" className="r2-inv">
      <EncabezadoPagina titulo="Rollos de membrana" dato={`${plural(conRollos.length, 'membrana con rollos', 'membranas con rollos')} · ${numero(totalMetros)} m disponibles`} />
      <BarraFiltros busqueda={{ valor: r.busqueda, alCambiar: r.setBusqueda, texto: 'Buscar membrana o malla', autoFoco: true }} />
      {r.errorCargaR2 && !r.loading && !r.articulos.length ? (
        <ErrorCarga mensaje="No se pudieron cargar las membranas." motivo={motivoLegible(r.errorCargaR2)} alReintentar={() => r.cargarArticulos(r.busqueda)} />
      ) : r.loading && !r.articulos.length ? (
        <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[3, 1, 1, 1, 1, 1]} filas={8} etiqueta="Cargando las membranas…" />
      ) : (
        <Tabla etiqueta="Membranas" clave="id" columnas={columnas} alAbrir={r.seleccionarArticulo} seleccionada={abierto ? art.id : null}
          etiquetaAbrir={(a) => `Ver los rollos de ${a.nombre}`}
          grupos={[
            { id: 'con', titulo: 'Con rollos', filas: conRollos, nota: 'De más metros a menos' },
            { id: 'sin', titulo: 'Sin rollos', filas: sinRollos, plegado: true },
          ]}
          filaCelular={(a) => ({
            inicio: <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} ampliable={false} />,
            principal: a.nombre,
            secundario: `${plural(stats(a).total_rollos || 0, 'rollo', 'rollos')} · ${numero(stats(a).rollos_en_uso || 0)} en uso`,
            derecha: metros(stats(a).metraje_total_disponible),
            debajo: <span className="r2-inv-desc">disponibles</span>,
          })}
          vacio={r.busqueda
            ? <Vacio sinResultados busqueda={r.busqueda} alQuitar={() => r.setBusqueda('')} />
            : <Vacio icono={Layers} titulo="No hay artículos en el almacén de Membranas" texto="Revisa que existan artículos con ubicación en el almacén «Membranas»." />} />
      )}

      <Cajon abierto={Boolean(abierto)} alCerrar={r.volverAArticulos} ancho="ancho" etiqueta={art ? `Rollos de ${art.nombre}` : 'Rollos'}>
        {abierto && (
          <>
            <CajonCabecera titulo={art.nombre} dato={`${plural(r.rollos.length, 'rollo registrado', 'rollos registrados')} · al cortar, se descuenta del rollo exacto`}
              alCerrar={r.volverAArticulos} />
            <CajonDecision>
              <Boton nivel="principal" icono={Plus} alHacer={r.abrirCrearRollo}>Nuevo rollo</Boton>
            </CajonDecision>
            <CajonCuerpo>
              <div className="r2-inv-cajon-filtros">
                <Segmentado etiqueta="Estado de los rollos" valor={r.filtroEstado} alCambiar={r.setFiltroEstado}
                  opciones={[{ valor: '', texto: 'Todos' }, ...Object.entries(ESTADOS_ROLLO).map(([k, e]) => ({ valor: k, texto: e[0] }))]} />
              </div>
              {r.loadingRollos ? <Cargando forma="lista" filas={4} etiqueta="Cargando los rollos…" /> : (
                <Tabla etiqueta="Rollos" className="r2-inv-acciones-abajo" densidad="compacta" fija={false} filas={r.rollos} clave="id" columnas={filaRollo}
                  accion={(x) => (x.estado !== 'agotado' ? (
                    <Boton nivel="tonal" tamano="chico" icono={Minus} alHacer={() => r.abrirDescuento(x)} aria-label={`Descontar metros del rollo ${x.identificador}`}>Descontar</Boton>
                  ) : null)}
                  masAcciones={(x) => [
                    { texto: 'Editar rollo', icono: Pencil, alHacer: () => r.abrirEditarRollo(x) },
                    { texto: 'Eliminar rollo', icono: Trash2, peligro: true, alHacer: () => r.eliminarRollo(x) },
                  ]}
                  filaCelular={(x) => {
                    const e = ESTADOS_ROLLO[x.estado] || ESTADOS_ROLLO.disponible;
                    return { principal: x.identificador, secundario: [x.color, x.observaciones].filter(Boolean).join(' · ') || 'Sin color', derecha: `${numero(num(x.metraje_restante))} de ${numero(num(x.metraje_total))} m`, debajo: <Estado tono={e[1]} texto={e[0]} /> };
                  }}
                  vacio={<Vacio titulo={r.filtroEstado ? 'Sin rollos con ese estado' : 'No hay rollos registrados'} texto="Usa «Nuevo rollo» para agregar uno." />} />
              )}
            </CajonCuerpo>
          </>
        )}
      </Cajon>

      {/* Rollo nuevo o editar */}
      <Dialogo abierto={Boolean(r.modalRollo)} alCerrar={() => r.setModalRollo(null)} cerrarConEsc tamano="sm"
        titulo={r.modalRollo === 'crear' ? 'Nuevo rollo' : `Editar el rollo ${r.modalRollo?.identificador || ''}`}
        pie={(
          <>
            <Boton nivel="fantasma" alHacer={() => r.setModalRollo(null)} deshabilitado={r.guardando}>Cancelar</Boton>
            <Boton nivel="principal" alHacer={r.guardarRollo} cargando={r.guardando}>{r.modalRollo === 'crear' ? 'Crear rollo' : 'Guardar cambios'}</Boton>
          </>
        )}>
        <div className="r2-inv-dialogo">
          {art && <p className="r2-inv-dialogo-nombre">{art.nombre}</p>}
          <Campo etiqueta="Identificador" requerido>
            <Entrada ref={r.idRef} type="text" value={r.formRollo.identificador} placeholder="Por ejemplo: R-001"
              onChange={(e) => r.setFormRollo({ ...r.formRollo, identificador: e.target.value })} />
          </Campo>
          {r.modalRollo === 'crear' && (
            <Campo etiqueta="Metraje total" requerido ayuda="En metros">
              <Entrada type="number" min="0.01" step="0.01" inputMode="decimal" value={r.formRollo.metraje_total} placeholder="100"
                className="r2-inv-cantidad-grande" onChange={(e) => r.setFormRollo({ ...r.formRollo, metraje_total: e.target.value })} />
            </Campo>
          )}
          <Campo etiqueta="Color">
            <Entrada type="text" value={r.formRollo.color} placeholder="Por ejemplo: negro, blanco, verde"
              onChange={(e) => r.setFormRollo({ ...r.formRollo, color: e.target.value })} />
          </Campo>
          <Campo etiqueta="Observaciones">
            <Entrada type="text" value={r.formRollo.observaciones} placeholder="Opcional"
              onChange={(e) => r.setFormRollo({ ...r.formRollo, observaciones: e.target.value })} />
          </Campo>
        </div>
      </Dialogo>

      {/* Descontar metros de un rollo */}
      <DialogoCantidad abierto={Boolean(r.rolloDescuento)} alCerrar={() => r.setRolloDescuento(null)}
        titulo={`Descontar del rollo ${r.rolloDescuento?.identificador || ''}`} nombre={art?.nombre}
        datos={r.rolloDescuento ? [['Disponible', metros(r.rolloDescuento.metraje_restante)], ['Total del rollo', metros(r.rolloDescuento.metraje_total)]] : []}
        etiqueta="Metros a descontar" valor={cantDesc} alCambiar={r.setCantidadDescuento} paso="0.01" min="0.01" unidad="m" todo={resta || null}
        refCantidad={r.cantidadRef} alEnter={r.confirmarDescuento}
        observaciones={r.obsDescuento} alCambiarObservaciones={r.setObsDescuento} etiquetaObservaciones="Motivo u observaciones" ejemploObservaciones="Por ejemplo: corte para la obra"
        previa={num(cantDesc) > 0 ? (excede ? { tono: 'mal', aviso: 'Excede el metraje disponible' } : { antes: numero(resta), despues: numero(resta - num(cantDesc)), unidad: 'm' }) : null}
        boton={{ texto: num(cantDesc) > 0 && !excede ? `Descontar ${numero(num(cantDesc))} m` : 'Descontar', alHacer: r.confirmarDescuento, cargando: r.descontando,
          deshabilitado: r.descontando || !cantDesc || num(cantDesc) <= 0 || excede, motivo: excede ? 'Excede el metraje disponible' : 'Escribe cuántos metros' }} />
    </Pagina>
  );
}
