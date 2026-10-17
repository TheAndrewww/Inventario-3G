// Rediseño 2 · Compras · Solicitudes de compra (/solicitudes-compra, inicio de compras), vista ENCENDIDA.
// Compras convierte solicitudes en órdenes juntando las del mismo proveedor: por eso la tabla va AGRUPADA POR PROVEEDOR y el
// renglón del grupo lleva la decisión «Armar orden con N» (el mismo manejador de hoy: toca una solicitud de ese proveedor y
// junta todas las suyas). «Nueva solicitud» abre un cajón (buscar artículo → cantidad, prioridad y motivo). Cancelar una
// solicitud pasa al «⋯» del renglón. Todo el estado y las peticiones siguen en OrdenesCompraPage.
import { useMemo, useState } from 'react';
import { Plus, ShoppingCart, XCircle, TrendingDown, Search, ArrowLeft } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, FiltroMenu, Tabla, Estado, Fecha, Boton, Cajon, CajonCabecera, CajonCuerpo,
  CajonPie, SeccionCajon, Campo, Entrada, Area, Segmentado, Datos, Lista, FilaLista, Miniatura, Cargando, Vacio, Nota,
  cantidad, plural, useEsCelular, clases,
} from '../fundacion';
import { PESO_PRIORIDAD, plano, errorDeCarga, nombreRol } from './comunes';
import './compras.css';

const OPCIONES_PRIORIDAD = [
  { valor: '', texto: 'Todas' },
  { valor: 'urgente', texto: 'Urgente' },
  { valor: 'alta', texto: 'Alta' },
  { valor: 'media', texto: 'Media' },
  { valor: 'baja', texto: 'Baja' },
];

// Existencia de un artículo frente a su mínimo (la misma cuenta que hacía la búsqueda de hoy: < 50 % crítico, < 100 % bajo)
function estadoExistencia(a) {
  if (a.activo === false) return { texto: 'Desactivado', tono: 'neutro' };
  const pct = (parseFloat(a.stock_actual) / parseFloat(a.stock_minimo || 1)) * 100;
  if (pct < 50) return { texto: 'Crítico', tono: 'mal' };
  if (pct < 100) return { texto: 'Bajo mínimo', tono: 'aviso' };
  return null;
}

function CampoCantidad({ valor, alCambiar, unidad, etiqueta }) {
  return (
    <span className="r2c-cantidad-celda">
      <input type="number" min="0" step="1" inputMode="numeric" className="r2-entrada r2c-entrada-num" value={valor}
        aria-label={etiqueta} onChange={(e) => alCambiar(e.target.value)} onClick={(e) => e.stopPropagation()} />
      <span className="r2c-unidad">{cantidad(2, unidad).replace(/^2\s*/, '')}</span>
    </span>
  );
}

function CajonNuevaSolicitud({ abiertaBusqueda, setAbiertaBusqueda, busquedaArticulo, setBusquedaArticulo, articulosBuscados,
  buscandoArticulos, elegirArticulo, crear }) {
  const formulario = Boolean(crear.abierto && crear.articulo);
  const abierto = abiertaBusqueda || formulario;
  const cerrar = () => {
    setAbiertaBusqueda(false);
    if (crear.abierto) crear.cerrar();
    setBusquedaArticulo('');
  };
  const cambiarArticulo = () => { crear.cerrar(); setAbiertaBusqueda(true); };
  // Al elegir, el cajón pasa al formulario (lo abre la página); al crear la solicitud se cierra solo
  const elegir = (art) => { setAbiertaBusqueda(false); elegirArticulo(art); };
  const a = crear.articulo;
  const cantidadValida = Boolean(crear.cantidad) && parseFloat(crear.cantidad) > 0;
  const termino = busquedaArticulo || '';

  return (
    <Cajon abierto={abierto} alCerrar={cerrar} etiqueta="Nueva solicitud de compra">
      <CajonCabecera titulo="Nueva solicitud de compra" dato={formulario ? a.nombre : 'Elige el artículo que hace falta'} alCerrar={cerrar} />
      {formulario ? (
        // Hoy este formulario no valida en el navegador (es un botón con su propia revisión): noValidate lo deja igual
        <form className="r2c-forma" noValidate onSubmit={(e) => { e.preventDefault(); crear.enviar(); }}>
          <CajonCuerpo>
            <SeccionCajon>
              <div className="r2c-articulo-cab">
                <Miniatura src={a.imagen_url} alt={a.nombre} tamano={48} ampliable={false} />
                <div className="r2c-articulo-cab-texto">
                  <p className="r2c-fuerte">{a.nombre}</p>
                  {a.categoria?.nombre && <p className="r2c-tenue">{a.categoria.nombre}</p>}
                </div>
              </div>
              <Datos columnas={2} className="r2c-datos-tres" datos={[
                { etiqueta: 'Existencia', valor: cantidad(a.stock_actual, a.unidad), numero: true, tono: estadoExistencia(a)?.tono === 'mal' ? 'mal' : undefined },
                { etiqueta: 'Mínimo', valor: cantidad(a.stock_minimo, a.unidad), numero: true },
                { etiqueta: 'Máximo', valor: a.stock_maximo ? cantidad(a.stock_maximo, a.unidad) : '—', numero: true },
              ]} />
            </SeccionCajon>
            <SeccionCajon>
              <Campo etiqueta="Cantidad a pedir" requerido
                ayuda={!cantidadValida ? `Escribe cuánto pedir (mayor a 0${a.unidad ? `, en ${a.unidad}` : ''}).` : a.unidad ? `En ${a.unidad}` : undefined}>
                <Entrada type="number" min="1" step="1" inputMode="numeric" value={crear.cantidad}
                  onChange={(e) => crear.setCantidad(e.target.value)} className="r2c-entrada-media" />
              </Campo>
              <div className="r2-campo r2c-segmento-alto">
                <span className="r2-campo-etiqueta" id="r2c-prioridad">Prioridad</span>
                <Segmentado etiqueta="Prioridad" valor={crear.prioridad} alCambiar={crear.setPrioridad} anchoCompleto
                  opciones={[{ valor: 'baja', texto: 'Baja' }, { valor: 'media', texto: 'Media' }, { valor: 'alta', texto: 'Alta' }, { valor: 'urgente', texto: 'Urgente' }]} />
              </div>
              <Campo etiqueta="Motivo (opcional)">
                <Area rows={3} value={crear.motivo} onChange={(e) => crear.setMotivo(e.target.value)}
                  placeholder="Por qué se necesita este artículo" />
              </Campo>
            </SeccionCajon>
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="fantasma" icono={ArrowLeft} alHacer={cambiarArticulo} deshabilitado={crear.cargando}>Cambiar artículo</Boton>
            <Boton nivel="principal" tipo="submit" icono={Plus} cargando={crear.cargando} deshabilitado={!cantidadValida}
              motivo="Escribe una cantidad mayor a 0">Crear solicitud</Boton>
          </CajonPie>
        </form>
      ) : (
        <>
          <div className="r2c-cajon-buscar">
            <Campo etiqueta="Artículo" icono={Search}>
              <Entrada type="search" value={termino} onChange={(e) => setBusquedaArticulo(e.target.value)} autoFocus
                placeholder="Nombre, código o categoría" autoComplete="off" />
            </Campo>
          </div>
          <CajonCuerpo>
            {termino.length < 2 ? (
              <Vacio compacto icono={Search} titulo="Busca el artículo que hace falta"
                texto="Escribe al menos 2 letras del nombre, el código de barras o la categoría." />
            ) : buscandoArticulos ? (
              <Cargando forma="lista" filas={5} etiqueta="Buscando artículos…" />
            ) : articulosBuscados.length === 0 ? (
              <Vacio compacto sinResultados busqueda={termino} texto="Revisa cómo se escribe o busca por el código de barras." />
            ) : (
              <>
                <Lista etiqueta="Artículos encontrados">
                  {articulosBuscados.slice(0, 10).map((art) => {
                    const est = estadoExistencia(art);
                    return (
                      <FilaLista key={art.id}
                        inicio={<Miniatura src={art.imagen_url} alt={art.nombre} ampliable={false} />}
                        principal={<span className={art.activo === false ? 'r2c-tachado' : undefined}>{art.nombre}</span>}
                        secundario={[`Existencia ${cantidad(art.stock_actual, art.unidad)}`, art.categoria?.nombre, art.codigo_ean13].filter(Boolean).join(' · ')}
                        debajoDerecha={est ? <Estado tono={est.tono} texto={est.texto} /> : null}
                        alAbrir={() => elegir(art)} etiqueta={`Pedir ${art.nombre}`} />
                    );
                  })}
                </Lista>
                {articulosBuscados.length > 10 && (
                  <Nota className="r2c-nota-lista">Mostrando 10 de {articulosBuscados.length} resultados: escribe más para acotar.</Nota>
                )}
              </>
            )}
          </CajonCuerpo>
        </>
      )}
    </Cajon>
  );
}

export default function VistaSolicitudes(p) {
  const {
    solicitudes, loading, errorCarga, recargar, cantidadesSolicitudesEditadas, cambiarCantidad, obtenerProveedorSolicitud,
    armarOrden, abrirCancelar, categoriasUnicas, abrirBajoStock, buscandoArticulos, children,
  } = p;
  const celular = useEsCelular();
  const [texto, setTexto] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [categoria, setCategoria] = useState('');
  const [abiertaBusqueda, setAbiertaBusqueda] = useState(false);

  const lista = useMemo(() => solicitudes || [], [solicitudes]);
  const urgentes = lista.filter((s) => s.prioridad === 'urgente').length;
  const altas = lista.filter((s) => s.prioridad === 'alta').length;

  // Cuántas solicitudes tiene cada proveedor en TODA la lista (el manejador de hoy junta todas, aunque haya filtros)
  const porProveedor = useMemo(() => {
    const m = new Map();
    lista.forEach((s) => { const id = obtenerProveedorSolicitud(s)?.id ?? null; m.set(id, (m.get(id) || 0) + 1); });
    return m;
  }, [lista, obtenerProveedorSolicitud]);

  const filtradas = useMemo(() => {
    const q = plano(texto).trim();
    return lista.filter((s) => {
      if (prioridad && s.prioridad !== prioridad) return false;
      if (categoria && String(s.articulo?.categoria?.id) !== categoria) return false;
      if (!q) return true;
      return plano([s.ticket_id, s.articulo?.nombre, s.articulo?.categoria?.nombre, s.articulo?.codigo_ean13, s.solicitante?.nombre,
        s.motivo, obtenerProveedorSolicitud(s)?.nombre].join(' ')).includes(q);
    });
  }, [lista, texto, prioridad, categoria, obtenerProveedorSolicitud]);

  const grupos = useMemo(() => {
    const m = new Map();
    filtradas.forEach((s) => {
      const prov = obtenerProveedorSolicitud(s);
      const id = prov?.id ?? null;
      if (!m.has(id)) m.set(id, { id: id === null ? 'sin-proveedor' : `p${id}`, provId: id, titulo: prov?.nombre || 'Sin proveedor', filas: [] });
      m.get(id).filas.push(s);
    });
    const arr = [...m.values()];
    arr.forEach((g) => g.filas.sort((x, y) => (PESO_PRIORIDAD[x.prioridad] ?? 9) - (PESO_PRIORIDAD[y.prioridad] ?? 9)));
    arr.sort((x, y) => (x.provId === null) - (y.provId === null) || x.titulo.localeCompare(y.titulo, 'es'));
    return arr.map((g) => {
      if (g.provId === null) return { ...g, nota: celular ? null : <span className="r2c-grupo-nota">Cada una se arma por separado</span> };
      const total = porProveedor.get(g.provId) || g.filas.length;
      return {
        ...g,
        nota: (
          <span className="r2c-grupo-accion">
            <Boton nivel="tonal" tamano="chico" icono={ShoppingCart} alHacer={() => armarOrden(g.filas[0])}
              aria-label={`Armar orden de ${g.titulo} con ${plural(total, 'solicitud', 'solicitudes')}`}>
              {total > 1 ? `Armar orden con ${total}` : 'Armar orden'}
            </Boton>
          </span>
        ),
      };
    });
  }, [filtradas, obtenerProveedorSolicitud, porProveedor, armarOrden, celular]);

  const quitarFiltros = () => { setTexto(''); setPrioridad(''); setCategoria(''); };
  const activos = (texto ? 1 : 0) + (prioridad ? 1 : 0) + (categoria ? 1 : 0);
  const valorCantidad = (s) => cantidadesSolicitudesEditadas[s.id] ?? parseFloat(s.cantidad_solicitada);

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo',
      celda: (s) => (
        <span className="r2c-celda-doble">
          <span className="r2c-fuerte">{s.articulo?.nombre}</span>
          <span className="r2c-sec">{[s.articulo?.categoria?.nombre, s.ticket_id].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    {
      id: 'cantidad', titulo: 'Cantidad a pedir', ancho: '170px', sinBoton: true,
      celda: (s) => <CampoCantidad valor={valorCantidad(s)} alCambiar={(v) => cambiarCantidad(s.id, v)} unidad={s.articulo?.unidad}
        etiqueta={`Cantidad a pedir de ${s.articulo?.nombre}`} />,
    },
    {
      id: 'existencia', titulo: 'Existencia', alinear: 'der',
      celda: (s) => {
        const actual = parseFloat(s.articulo?.stock_actual || 0);
        return (
          <span className="r2c-celda-doble r2c-celda-doble--der">
            <span className={clases('r2c-fuerte', actual <= 0 && 'r2-tono--mal')}>{cantidad(actual, s.articulo?.unidad)}</span>
            {parseFloat(s.articulo?.stock_minimo) > 0 && <span className="r2c-sec">mínimo {cantidad(s.articulo.stock_minimo, s.articulo?.unidad)}</span>}
          </span>
        );
      },
    },
    { id: 'prioridad', titulo: 'Prioridad', celda: (s) => (s.prioridad ? <Estado dominio="prioridad" valor={s.prioridad} /> : null) },
    {
      id: 'pidio', titulo: 'Pidió', ocultarEn: 'celular-ancho',
      celda: (s) => (
        <span className="r2c-celda-doble">
          <span>{s.solicitante?.nombre || '—'}</span>
          {s.solicitante?.rol && <span className="r2c-sec">{nombreRol(s.solicitante.rol)}</span>}
        </span>
      ),
    },
    { id: 'motivo', titulo: 'Motivo', ocultarEn: 'tableta', celda: (s) => <span className="r2c-motivo">{s.motivo || '—'}</span> },
    { id: 'fecha', titulo: 'Pedida', ocultarEn: 'tableta', celda: (s) => <Fecha valor={s.created_at} /> },
  ];

  const sinProveedor = (s) => obtenerProveedorSolicitud(s)?.id == null;

  return (
    <Pagina titulo="Solicitudes de compra" densidad="comoda" className="r2c-pagina">
      <EncabezadoPagina pestanas="seccion"
        dato={loading && !lista.length ? undefined : [
          plural(lista.length, 'pendiente', 'pendientes'),
          urgentes ? plural(urgentes, 'urgente', 'urgentes') : null,
          altas ? plural(altas, 'alta', 'altas') : null,
        ].filter(Boolean).join(' · ')}
        secundarias={[{ texto: 'Bajo stock mínimo', icono: TrendingDown, alHacer: abrirBajoStock, cargando: buscandoArticulos && !abiertaBusqueda }]}
        principal={{ texto: 'Nueva solicitud', corto: 'Nueva', icono: Plus, alHacer: () => setAbiertaBusqueda(true) }} />

      <BarraFiltros
        busqueda={{ valor: texto, alCambiar: setTexto, texto: celular ? 'Buscar' : 'Buscar artículo, proveedor o quién pidió', etiqueta: 'Buscar artículo, proveedor o quién pidió' }}
        filtros={[
          <FiltroMenu key="prioridad" etiqueta="Prioridad" valor={prioridad} alCambiar={setPrioridad}
            opciones={OPCIONES_PRIORIDAD.map((o) => ({ ...o, cuenta: o.valor ? lista.filter((s) => s.prioridad === o.valor).length : undefined }))} />,
          (categoriasUnicas || []).length > 1 && (
            <FiltroMenu key="categoria" etiqueta="Categoría" valor={categoria} alCambiar={setCategoria}
              opciones={[{ valor: '', texto: 'Todas' }, ...categoriasUnicas.map((c) => ({ valor: String(c.id), texto: c.nombre }))]} />
          ),
        ]}
        activos={activos} alQuitar={quitarFiltros} resultados={filtradas.length} />

      <Tabla etiqueta="Solicitudes de compra por proveedor" clave="id" className="r2c-tabla-solicitudes"
        columnas={columnas} grupos={grupos}
        accion={(s) => (sinProveedor(s) ? (
          <Boton nivel="tonal" tamano="chico" icono={ShoppingCart} alHacer={() => armarOrden(s)}
            aria-label={`Armar orden con ${s.articulo?.nombre}`}>Armar orden</Boton>
        ) : null)}
        masAcciones={(s) => [{ texto: 'Cancelar solicitud', icono: XCircle, peligro: true, alHacer: (e) => abrirCancelar(s, e) }]}
        filaCelular={(s) => ({
          principal: s.articulo?.nombre,
          secundario: [`Existencia ${cantidad(s.articulo?.stock_actual || 0, s.articulo?.unidad)}`, s.solicitante?.nombre].filter(Boolean).join(' · '),
          derecha: <CampoCantidad valor={valorCantidad(s)} alCambiar={(v) => cambiarCantidad(s.id, v)} unidad={s.articulo?.unidad}
            etiqueta={`Cantidad a pedir de ${s.articulo?.nombre}`} />,
          debajo: s.prioridad ? <Estado dominio="prioridad" valor={s.prioridad} /> : null,
        })}
        cargando={loading && !lista.length}
        error={errorDeCarga('No se pudieron cargar las solicitudes.', errorCarga, recargar)}
        vacio={activos
          ? { sinResultados: true, busqueda: texto || undefined, alQuitar: quitarFiltros }
          : { titulo: 'No hay solicitudes pendientes', texto: 'Cuando alguien pida material que falta aparecerá aquí, junto con las de su proveedor.', accion: { texto: 'Nueva solicitud', icono: Plus, alHacer: () => setAbiertaBusqueda(true) } }} />

      <CajonNuevaSolicitud {...p} abiertaBusqueda={abiertaBusqueda} setAbiertaBusqueda={setAbiertaBusqueda} />
      {children}
    </Pagina>
  );
}
