// Rediseño 2 · grupo inventario · Descuento de almacén (/descontar-almacen) encendido. DISENO-v2 §5.3.
// El almacén es un filtro de la fila (cambiar es elegir otro); la tabla trae «Descontar» CON TEXTO en cada renglón (hoy era
// un guion naranja). En Membranas el renglón despliega sus rollos y cada uno trae «Descontar metros». Los diálogos dicen
// cuánto hay, la cantidad en grande con «Todo» y la vista previa «48 → 40 pzas». Mismo estado y mismas peticiones.
import { Minus, Layers, ChevronDown, ChevronRight, Warehouse } from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { BarraFiltros, FiltroMenu } from '../fundacion/piezas/BarraFiltros';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Boton } from '../fundacion/piezas/Boton';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { useEsCelular } from '../fundacion/useDiseno3G';
import { numero, plural, cantidad } from '../fundacion/formato';
import DialogoCantidad from './DialogoCantidad';
import { num, motivoLegible } from './ayudas';
import './inventario.css';

export default function VistaDescontar({ d }) {
  const celular = useEsCelular();
  const elegido = d.almacenSeleccionado;
  const cambiarAlmacen = (valor) => {
    if (valor === elegido) return;
    d.volverAAlmacenes();
    if (valor) d.seleccionarAlmacen(valor);
  };
  const unidadDe = (a) => cantidad(2, a?.unidad || 'piezas').replace(/^\S+\s/, '');

  // Renglones: los artículos y, en Membranas, los rollos del artículo desplegado debajo de él
  const filas = [];
  for (const a of d.articulos) {
    filas.push({ ...a, _tipo: 'articulo', _clave: `a-${a.id}` });
    if (d.esMembranas && d.rollosArticulo?.id === a.id) {
      if (d.loadingRollos) filas.push({ _tipo: 'aviso', _clave: `c-${a.id}`, texto: 'Cargando los rollos…' });
      else if (!d.rollos.length) filas.push({ _tipo: 'aviso', _clave: `v-${a.id}`, texto: 'No hay rollos disponibles. Regístralos en Rollos de membrana.' });
      else for (const r of d.rollos) filas.push({ ...r, _tipo: 'rollo', _clave: `r-${r.id}`, _articulo: a });
    }
  }

  const abrirArticulo = (a) => {
    if (d.esMembranas && d.rollosArticulo?.id === a.id) d.cerrarRollos();
    else d.abrirDescuento(a);
  };

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo', celda: (f) => {
        if (f._tipo === 'aviso') return <span className="r2-inv-desc">{f.texto}</span>;
        if (f._tipo === 'rollo') {
          return (
            <span className="r2-inv-articulo-texto r2-inv-rollo-en-tabla">
              <span className="r2-inv-nombre">Rollo {f.identificador}</span>
              <span className="r2-inv-desc">{f.color || 'Sin color'}</span>
            </span>
          );
        }
        return (
          <span className="r2-inv-articulo">
            <Miniatura src={f.imagen_url} alt={f.nombre} tamano={40} ampliable={false} />
            <span className="r2-inv-articulo-texto">
              <span className="r2-inv-nombre">{f.nombre}</span>
              {f.codigo_ean13 && <span className="r2-inv-desc r2-num">{f.codigo_ean13}</span>}
            </span>
          </span>
        );
      },
    },
    { id: 'ubicacion', titulo: 'Ubicación', ancho: '14%', celda: (f) => (f._tipo === 'articulo' ? <span className="r2-num">{f.ubicacion?.codigo || '—'}</span> : null) },
    {
      id: 'existencia', titulo: 'Existencia', alinear: 'der', ancho: '18%', celda: (f) => {
        if (f._tipo === 'articulo') return <strong className="r2-num">{cantidad(num(f.stock_actual), f.unidad)}</strong>;
        if (f._tipo === 'rollo') return <span className="r2-num"><strong>{numero(num(f.metraje_restante))}</strong> de {numero(num(f.metraje_total))} m</span>;
        return null;
      },
    },
  ];

  const accion = (f) => {
    if (f._tipo === 'aviso') return null;
    if (f._tipo === 'rollo') {
      return <Boton nivel="tonal" tamano="chico" icono={Minus} alHacer={() => d.seleccionarRollo(f)} aria-label={`Descontar metros del rollo ${f.identificador}`}>Descontar metros</Boton>;
    }
    if (d.esMembranas) {
      const abierta = d.rollosArticulo?.id === f.id;
      return (
        <Boton nivel="fantasma" tamano="chico" icono={abierta ? ChevronDown : ChevronRight} aria-expanded={abierta}
          alHacer={() => abrirArticulo(f)}>{abierta ? 'Ocultar rollos' : 'Ver rollos'}</Boton>
      );
    }
    return <Boton nivel="tonal" tamano="chico" icono={Minus} alHacer={() => d.abrirDescuento(f)} aria-label={`Descontar ${f.nombre}`}>Descontar</Boton>;
  };

  const art = d.articuloDescuento;
  const cant = d.cantidad;
  const hay = num(art?.stock_actual);
  const excede = num(cant) > hay;
  const rollo = d.rolloSeleccionado;
  const cantR = d.cantidadRollo;
  const restaR = num(rollo?.metraje_restante);
  const excedeR = num(cantR) > restaR;

  let cuerpo;
  const fallo = d.errorCargaR2;
  if (fallo?.de === 'almacenes' && !d.loading && !d.almacenes.length) {
    cuerpo = <ErrorCarga mensaje="No se pudieron cargar los almacenes." motivo={motivoLegible(fallo.motivo)} alReintentar={() => d.cargarAlmacenes()} />;
  } else if (fallo?.de === 'articulos' && elegido && !d.loadingArticulos && !d.articulos.length) {
    cuerpo = <ErrorCarga mensaje={`No se pudieron cargar los artículos de ${elegido}.`} motivo={motivoLegible(fallo.motivo)} alReintentar={() => d.cargarArticulos(elegido, d.busqueda)} />;
  } else if (d.loading) {
    cuerpo = <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[3, 1, 1]} filas={5} etiqueta="Cargando los almacenes…" />;
  } else if (!elegido) {
    cuerpo = (
      <Tabla etiqueta="Almacenes" filas={d.almacenes} clave="almacen" alAbrir={(a) => d.seleccionarAlmacen(a.almacen)}
        etiquetaAbrir={(a) => `Descontar del almacén ${a.almacen}`}
        columnas={[
          { id: 'almacen', titulo: 'Almacén', celda: (a) => <span className="r2-inv-almacen-celda">{a.almacen === 'Membranas' ? <Layers size={20} aria-hidden="true" /> : <Warehouse size={20} aria-hidden="true" />}<span>{a.almacen}</span></span> },
          { id: 'total', titulo: 'Artículos con existencia', alinear: 'der', ancho: '24%', celda: (a) => numero(a.total_articulos) },
        ]}
        accion={(a) => <Boton nivel="fantasma" tamano="chico" alHacer={() => d.seleccionarAlmacen(a.almacen)}>Elegir</Boton>}
        filaCelular={(a) => ({ principal: a.almacen, secundario: a.almacen === 'Membranas' ? 'Se descuenta por rollo' : 'Se descuenta por artículo', derecha: numero(a.total_articulos), debajo: <span className="r2-inv-desc">con existencia</span> })}
        vacio={<Vacio icono={Warehouse} titulo="No hay almacenes con artículos" texto="Cuando un almacén tenga artículos con existencia aparecerá aquí." />} />
    );
  } else if (d.loadingArticulos && !d.articulos.length) {
    cuerpo = <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[3, 1, 1]} filas={8} etiqueta="Cargando los artículos…" />;
  } else {
    cuerpo = (
      <Tabla etiqueta={`Artículos de ${elegido}`} className="r2-inv-acciones-abajo" densidad="compacta" filas={filas} clave="_clave" columnas={columnas}
        alAbrir={(f) => (f._tipo === 'articulo' ? abrirArticulo(f) : f._tipo === 'rollo' ? d.seleccionarRollo(f) : undefined)}
        seleccionada={d.rollosArticulo ? `a-${d.rollosArticulo.id}` : art ? `a-${art.id}` : null}
        accion={accion}
        filaCelular={(f) => {
          if (f._tipo === 'aviso') return { principal: f.texto };
          if (f._tipo === 'rollo') return { principal: `Rollo ${f.identificador}`, secundario: f.color || 'Sin color', derecha: `${numero(num(f.metraje_restante))} m` };
          return {
            inicio: <Miniatura src={f.imagen_url} alt={f.nombre} tamano={40} ampliable={false} />,
            principal: f.nombre, secundario: [f.ubicacion?.codigo, f.codigo_ean13].filter(Boolean).join(' · '),
            derecha: cantidad(num(f.stock_actual), f.unidad),
          };
        }}
        vacio={d.busqueda ? <Vacio sinResultados busqueda={d.busqueda} donde={elegido} alQuitar={() => d.setBusqueda('')} />
          : <Vacio titulo={`${elegido} no tiene artículos con existencia`} texto="Elige otro almacén en el filtro de arriba." />} />
    );
  }

  return (
    <Pagina titulo="Descuento de almacén" densidad="compacta" className="r2-inv r2-inv-descuento">
      <EncabezadoPagina titulo="Descuento de almacén"
        dato={elegido ? `${elegido} · ${plural(d.articulos.length, 'artículo con existencia', 'artículos con existencia')}` : 'Material usado sin ticket'} />
      <BarraFiltros
        busqueda={elegido ? { valor: d.busqueda, alCambiar: d.setBusqueda, texto: 'Buscar artículo', autoFoco: true } : undefined}
        filtros={[
          <FiltroMenu key="almacen" etiqueta="Almacén" valor={elegido || ''} alCambiar={cambiarAlmacen}
            opciones={[{ valor: '', texto: 'Elige uno' }, ...d.almacenes.map((a) => ({ valor: a.almacen, texto: a.almacen, cuenta: a.total_articulos }))]} />,
        ]}
        resultados={d.articulos.length} />
      {d.loadingArticulos && d.articulos.length > 0 && <p className="r2-inv-desc r2-inv-actualizando" role="status">Actualizando…</p>}
      {cuerpo}

      <DialogoCantidad abierto={Boolean(art) && !d.esMembranas} alCerrar={() => d.setArticuloDescuento(null)} titulo="Descontar del almacén"
        nombre={art?.nombre} datos={art ? [['Disponible', cantidad(hay, art.unidad)], ['Ubicación', art.ubicacion?.codigo || '—']] : []}
        etiqueta="Cantidad a descontar" valor={cant} alCambiar={d.setCantidad} paso="0.01" min="0.01" unidad={art ? unidadDe(art) : null} todo={hay || null}
        refCantidad={d.cantidadRef} alEnter={d.confirmarDescuento}
        observaciones={d.observaciones} alCambiarObservaciones={d.setObservaciones} etiquetaObservaciones="Motivo u observaciones" ejemploObservaciones="Por ejemplo: salida a obra, uso interno"
        previa={num(cant) > 0 ? (excede ? { tono: 'mal', aviso: 'Excede la existencia disponible' } : { antes: numero(hay), despues: numero(hay - num(cant)), unidad: unidadDe(art) }) : null}
        boton={{ texto: num(cant) > 0 && !excede ? `Descontar ${cantidad(num(cant), art?.unidad)}` : 'Descontar', alHacer: d.confirmarDescuento, cargando: d.descontando,
          deshabilitado: d.descontando || !cant || num(cant) <= 0 || excede, motivo: excede ? 'Excede la existencia disponible' : 'Escribe la cantidad' }} />

      <DialogoCantidad abierto={Boolean(rollo)} alCerrar={() => d.setRolloSeleccionado(null)} titulo={`Descontar del rollo ${rollo?.identificador || ''}`}
        nombre={d.rollosArticulo?.nombre} datos={rollo ? [['Disponible', `${numero(restaR)} m`], ['Total del rollo', `${numero(num(rollo.metraje_total))} m`]] : []}
        etiqueta="Metros a descontar" valor={cantR} alCambiar={d.setCantidadRollo} paso="0.01" min="0.01" unidad="m" todo={restaR || null}
        refCantidad={d.cantidadRolloRef} alEnter={d.confirmarDescuentoRollo}
        observaciones={d.obsRollo} alCambiarObservaciones={d.setObsRollo} etiquetaObservaciones="Motivo u observaciones" ejemploObservaciones="Por ejemplo: corte para proyecto, salida a obra"
        previa={num(cantR) > 0 ? (excedeR ? { tono: 'mal', aviso: 'Excede el metraje disponible' } : { antes: numero(restaR), despues: numero(restaR - num(cantR)), unidad: 'm' }) : null}
        boton={{ texto: num(cantR) > 0 && !excedeR ? `Descontar ${numero(num(cantR))} m` : 'Descontar', alHacer: d.confirmarDescuentoRollo, cargando: d.descontandoRollo,
          deshabilitado: d.descontandoRollo || !cantR || num(cantR) <= 0 || excedeR, motivo: excedeR ? 'Excede el metraje disponible' : 'Escribe cuántos metros' }} />
    </Pagina>
  );
}
