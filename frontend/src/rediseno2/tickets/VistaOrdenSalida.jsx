// Rediseño 2 · Orden de salida (/pedido), vista encendida. La página (PedidoPage.jsx) guarda todo el estado, las
// peticiones y los manejadores; aquí solo se pinta y se llama a esos mismos manejadores.
//
// Plano (DISENO-v2 §5.2): pestañas de la sección + «⋯ Vaciar orden» → franja «Para quién» (obra o equipo, encargado,
// observaciones) → buscador/escáner grande con resultados debajo → la orden como tabla → barra fija con el total y
// «Finalizar orden de salida». En celular la franja es un renglón que abre un cajón.
import { useState } from 'react';
import { Camera, ChevronRight, Package, Plus, StickyNote, Trash2 } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraAccion, Boton, Tabla, Lista, FilaLista, MenuAcciones, Miniatura, Vacio,
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, Campo, Selector, SelectorBuscable, Area,
  useEsCelular, dinero, cantidad, plural, numero, fechaCorta, clases,
} from '../fundacion';
import { CantidadTicket, CampoEscaner, ListaResultados, EstadoPistola } from './comunes';
import { getImageUrl } from '../../utils/imageUtils';
import './tickets.css';

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// El campo de la obra (o del equipo) lleva este id para poder llevarle el foco cuando falta al finalizar.
const ID_OBRA = 'r2-tk-campo-obra';

function FranjaParaQuien({ e, compacta = false }) {
  const almacen = e.user?.rol === 'almacen';
  const [verObs, setVerObs] = useState(false);
  const obsAbiertas = verObs || Boolean(e.observaciones);

  if (almacen) {
    const equipo = e.equipos.find((q) => q.id === parseInt(e.equipoSeleccionado));
    const camioneta = e.camionetas.find((c) => c.id === parseInt(e.camionetaSeleccionada));
    return (
      <div className={clases('r2-tk-franja-campos', compacta && 'r2-tk-franja-campos--pila')}>
        <Campo etiqueta="Equipo" requerido className="r2-tk-campo-obra" id={ID_OBRA}
          ayuda={equipo ? `Encargado: ${equipo.encargado?.nombre || 'N/A'}` : undefined}>
          <Selector value={e.equipoSeleccionado} onChange={(ev) => e.setEquipoSeleccionado(ev.target.value)}
            disabled={e.cargandoEquipos} vacio={e.cargandoEquipos ? 'Cargando equipos…' : 'Elige el equipo…'}
            opciones={e.equipos.map((q) => ({ valor: q.id, texto: q.nombre }))} />
        </Campo>
        <Campo etiqueta="Camioneta (opcional)" className="r2-tk-campo-encargado"
          ayuda={camioneta ? `Encargado: ${camioneta.encargado?.nombre || 'N/A'}` : undefined}>
          <Selector value={e.camionetaSeleccionada} onChange={(ev) => e.setCamionetaSeleccionada(ev.target.value)}
            disabled={e.cargandoCamionetas} vacio={e.cargandoCamionetas ? 'Cargando…' : 'Sin camioneta'}
            opciones={e.camionetas.map((c) => ({ valor: c.id, texto: c.nombre }))} />
        </Campo>
        <Observaciones e={e} abiertas={obsAbiertas} abrir={() => setVerObs(true)} compacta={compacta} />
      </div>
    );
  }

  const vistas = new Set();
  const obras = [
    { valor: 'MANUFACTURA', texto: 'Manufactura', detalle: 'Área fija' },
    { valor: 'HERRERÍA', texto: 'Herrería', detalle: 'Área fija' },
    ...e.proyectosProduccion.map((p) => ({ valor: p.nombre, texto: p.nombre, detalle: p.cliente || undefined })),
  ].filter((o) => (vistas.has(o.valor) ? false : vistas.add(o.valor)));
  const sinObras = e.proyectosProduccion.length === 0 && !e.cargandoProyectos;
  return (
    <div className={clases('r2-tk-franja-campos', compacta && 'r2-tk-franja-campos--pila')}>
      <Campo etiqueta="Obra" requerido className="r2-tk-campo-obra" id={ID_OBRA}
        ayuda={sinObras ? 'No hay proyectos activos en producción (quedan las áreas fijas).' : undefined}>
        <SelectorBuscable valor={e.proyecto} alCambiar={e.setProyecto} opciones={obras} deshabilitado={e.cargandoProyectos}
          texto={e.cargandoProyectos ? 'Cargando obras…' : 'Busca la obra o el área…'} vacio="Ninguna obra coincide" />
      </Campo>
      <Campo etiqueta="Encargado (opcional)" className="r2-tk-campo-encargado">
        <Selector value={e.encargadoSeleccionado} onChange={(ev) => e.setEncargadoSeleccionado(ev.target.value)}
          disabled={e.cargandoEncargados} vacio="Sin encargado"
          opciones={e.encargados.map((x) => ({ valor: x.id, texto: x.nombre }))} />
      </Campo>
      <Observaciones e={e} abiertas={obsAbiertas} abrir={() => setVerObs(true)} compacta={compacta} />
    </div>
  );
}

function Observaciones({ e, abiertas, abrir, compacta }) {
  if (!abiertas && !compacta) {
    return (
      <div className="r2-tk-campo-obs r2-tk-campo-obs--cerrado">
        <Boton nivel="fantasma" icono={StickyNote} alHacer={abrir}>Agregar observaciones</Boton>
      </div>
    );
  }
  return (
    <Campo etiqueta="Observaciones (opcional)" className="r2-tk-campo-obs">
      <Area rows={compacta ? 3 : 1} value={e.observaciones} onChange={(ev) => e.setObservaciones(ev.target.value)}
        placeholder="Notas para almacén o para el encargado" autoFocus={!compacta && !e.observaciones} />
    </Campo>
  );
}

export default function VistaOrdenSalida({ e }) {
  const celular = useEsCelular();
  const [paraQuien, setParaQuien] = useState(false);
  const almacen = e.user?.rol === 'almacen';
  const items = e.items;
  const vacia = items.length === 0;
  const elegido = almacen ? Boolean(e.equipoSeleccionado) : Boolean(String(e.proyecto || '').trim());
  const nombreElegido = almacen
    ? e.equipos.find((q) => q.id === parseInt(e.equipoSeleccionado))?.nombre
    : (e.proyecto === 'MANUFACTURA' ? 'Manufactura' : e.proyecto === 'HERRERÍA' ? 'Herrería' : e.proyecto);
  const encargadoNombre = almacen
    ? e.camionetas.find((c) => c.id === parseInt(e.camionetaSeleccionada))?.nombre
    : e.encargados.find((x) => String(x.id) === String(e.encargadoSeleccionado))?.nombre;
  const verResultados = e.busqueda.length >= 2;
  const idResultados = 'r2-tk-resultados-orden';
  const totalPiezas = e.getTotalPiezas();
  const costoTotal = e.getCostoTotal();

  const finalizar = async () => {
    if (!elegido) {
      if (celular) setParaQuien(true);
      else document.getElementById(ID_OBRA)?.focus?.();
    }
    // Verificación: como hoy, el botón no se bloquea mientras se guarda (un segundo toque vuelve a llamar al mismo manejador).
    // Bloquearlo cambiaría lo que pasa hoy (regla: los errores que ya existen se anotan y no se arreglan).
    await e.handleFinalizarPedido();
  };

  const faltaDe = (it) => {
    const pide = n(it.cantidad);
    const hay = n(it.stock_actual);
    return it.stock_actual !== undefined && it.stock_actual !== null && pide > hay ? pide - hay : 0;
  };

  const existencia = (it) => {
    if (it.stock_actual === undefined || it.stock_actual === null) return <span className="r2-tk-tenue">—</span>;
    const falta = faltaDe(it);
    return (
      <span className="r2-tk-existencia" title="Existencia cuando se agregó a la orden">
        <span className="r2-num">{cantidad(it.stock_actual, it.unidad)}</span>
        {falta > 0 && <span className="r2-tk-falta r2-tono--aviso"><span className="r2-estado-punto" aria-hidden="true" />Faltan {numero(falta)}</span>}
      </span>
    );
  };

  const cantidadDe = (it) => (
    <CantidadTicket valor={it.cantidad} min="1" etiqueta={`Cantidad de ${it.nombre}`}
      menosApagado={n(it.cantidad) <= 1}
      alMenos={() => e.decrementar(it.id)} alMas={() => e.incrementar(it.id)}
      alEscribir={(v) => e.handleCantidadChange(it.id, v)} alSalir={(v) => e.handleCantidadBlur(it.id, v)} />
  );

  const vaciarOrden = [{
    texto: 'Vaciar orden', icono: Trash2, peligro: true, alHacer: e.handleVaciarCarrito,
    deshabilitado: vacia, motivo: 'La orden está vacía',
  }];

  const quitarDe = (it) => [{ texto: 'Quitar de la orden', icono: Trash2, peligro: true, alHacer: () => e.eliminarArticulo(it.id) }];

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo', sinBoton: true,
      celda: (it) => (
        <span className="r2-tk-articulo">
          <Miniatura src={it.imagen_url ? getImageUrl(it.imagen_url) : null} alt={it.nombre} tamano={40} />
          <span className="r2-tk-articulo-lineas">
            <span className="r2-tk-articulo-nombre">{it.nombre}</span>
            {it.codigo_ean13 && <span className="r2-tk-articulo-clave">{it.codigo_ean13}</span>}
          </span>
        </span>
      ),
    },
    { id: 'existencia', titulo: 'Existencia', alinear: 'der', ancho: 150, celda: existencia, ocultarEn: 'celular-ancho' },
    { id: 'cantidad', titulo: 'Cantidad', alinear: 'centro', ancho: 190, sinBoton: true, celda: cantidadDe },
    { id: 'costo', titulo: 'Costo c/u', alinear: 'der', ancho: 120, celda: (it) => dinero(n(it.costo_unitario)), ocultarEn: 'tableta' },
    { id: 'subtotal', titulo: 'Subtotal', alinear: 'der', ancho: 130, celda: (it) => <strong className="r2-num">{dinero(n(it.cantidad) * n(it.costo_unitario))}</strong> },
  ];

  const resultados = e.resultadosBusqueda.map((a) => ({
    id: a.id, original: a, nombre: a.nombre, foto: a.imagen_url ? getImageUrl(a.imagen_url) : null,
    apagado: a.activo === false, marca: a.activo === false ? 'Desactivado' : null,
    // «Hay 120 pzas» no se parte en dos renglones (espacios que no cortan)
    detalle: [a.codigo_ean13, `Hay ${cantidad(a.stock_actual, a.unidad)}`.replace(/ /g, '\u00a0')].filter(Boolean).join(' · '),
  }));

  const resumen = `${plural(items.length, 'artículo', 'artículos')} · ${cantidad(totalPiezas, 'piezas')} · ${dinero(costoTotal)}`;
  const aviso = vacia ? null : !elegido ? (almacen ? 'Elige el equipo para finalizar' : 'Elige la obra para finalizar') : null;

  return (
    <Pagina titulo="Orden de salida" densidad="comoda" espacioInferior={!vacia} className="r2-tk-pagina-barra">
      <EncabezadoPagina pestanas="seccion" titulo="Orden de salida"
        extra={!celular ? <EstadoPistola leyendo={e.isScanning} /> : null}
        masAcciones={celular ? [] : vaciarOrden} />

      {/* Para quién */}
      {celular ? (
        <button type="button" className="r2-tk-resumen-franja" onClick={() => setParaQuien(true)} aria-haspopup="dialog">
          <span className="r2-tk-resumen-franja-lineas">
            <span className="r2-tk-resumen-franja-etiqueta">{almacen ? 'Equipo' : 'Obra'}</span>
            <span className={clases('r2-tk-resumen-franja-valor', !elegido && 'r2-tk-resumen-franja-valor--falta')}>
              {elegido ? nombreElegido : (almacen ? 'Elige el equipo…' : 'Elige la obra…')}
            </span>
            <span className="r2-tk-resumen-franja-dato">
              {[encargadoNombre ? `${almacen ? 'Camioneta' : 'Encargado'}: ${encargadoNombre}` : null, e.observaciones ? 'Con observaciones' : null]
                .filter(Boolean).join(' · ') || `La arma ${e.user?.nombre || 'N/A'} · hoy ${fechaCorta(new Date())}`}
            </span>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="r2-tk-resumen-franja-flecha" />
        </button>
      ) : (
        <section className="r2-tk-franja" aria-label="Para quién es la orden">
          <FranjaParaQuien e={e} />
          <p className="r2-tk-franja-quien">La arma {e.user?.nombre || 'N/A'} · hoy {fechaCorta(new Date())}</p>
        </section>
      )}

      {/* Buscador / escáner */}
      <section className="r2-tk-buscador" aria-label="Agregar artículos">
        <div className="r2-tk-buscador-fila">
          <div className="r2-tk-buscador-campo">
            <CampoEscaner valor={e.busqueda} alCambiar={e.cambiarBusqueda} alLimpiar={() => e.cambiarBusqueda('')}
              texto={celular ? 'Busca o escanea' : 'Busca por nombre o código, o lee el código con la pistola'}
              etiqueta="Buscar artículo por nombre o código" controla={idResultados} expandido={verResultados} />
            {verResultados && (
              <ListaResultados id={idResultados} items={resultados} buscando={e.buscando} alElegir={e.handleAgregarArticulo}
                etiqueta="Artículos encontrados"
                vacio={(
                  <div className="r2-tk-resultados-vacio">
                    <p className="r2-tk-resultados-vacio-titulo">Ningún artículo coincide con «{e.busqueda}»</p>
                    <p className="r2-tk-resultados-vacio-texto">Revisa cómo se escribe o créalo para agregarlo a la orden.</p>
                    <Boton nivel="tonal" icono={Plus} alHacer={e.abrirNuevoArticulo}>Crear artículo nuevo</Boton>
                  </div>
                )} />
            )}
          </div>
          <Boton nivel="contorno" tamano="grande" icono={Camera} alHacer={() => e.setShowScanner(!e.showScanner)}
            aria-pressed={e.showScanner} title="Escanear código de barras con la cámara">
            {celular ? 'Cámara' : 'Escanear con cámara'}
          </Boton>
        </div>
        {!e.busqueda && (
          <p className="r2-tk-buscador-ayuda">
            {celular ? <EstadoPistola leyendo={e.isScanning} /> : null}
            {celular ? null : 'Escribe al menos dos letras del nombre o del código, o lee el código con la pistola sin tocar el campo.'}
          </p>
        )}
      </section>

      {/* La orden */}
      <section className="r2-tk-orden" aria-label="Artículos de la orden">
        {!vacia && (
          <div className="r2-tk-subtitulo-fila">
            <h2 className="r2-tk-subtitulo">Artículos en la orden <span className="r2-tk-subtitulo-dato">{numero(items.length)}</span></h2>
            {celular && <MenuAcciones titulo="Orden de salida" acciones={vaciarOrden} />}
          </div>
        )}
        {vacia ? (
          <div className="r2-tabla-vacia">
            <Vacio icono={Package} titulo="Tu orden está vacía" texto="Busca o escanea un artículo para empezar."
              accion={{ texto: 'Ver inventario', alHacer: e.irAInventario, nivel: 'contorno' }} />
          </div>
        ) : celular ? (
          <Lista etiqueta="Artículos en la orden" className="r2-tk-lista-orden">
            {items.map((it) => (
              <li key={it.id} className="r2-tk-fila-orden">
                <div className="r2-tk-fila-orden-arriba">
                  <Miniatura src={it.imagen_url ? getImageUrl(it.imagen_url) : null} alt={it.nombre} tamano={48} />
                  <span className="r2-tk-articulo-lineas">
                    <span className="r2-tk-articulo-nombre">{it.nombre}</span>
                    <span className="r2-tk-articulo-clave">
                      {dinero(n(it.costo_unitario))} c/u
                      {it.stock_actual !== undefined && it.stock_actual !== null ? ` · Hay ${cantidad(it.stock_actual, it.unidad)}` : ''}
                    </span>
                  </span>
                  <MenuAcciones titulo={it.nombre} acciones={quitarDe(it)} />
                </div>
                <div className="r2-tk-fila-orden-abajo">
                  {cantidadDe(it)}
                  <span className="r2-tk-fila-orden-total">
                    {faltaDe(it) > 0 && <span className="r2-tk-falta r2-tono--aviso"><span className="r2-estado-punto" aria-hidden="true" />Faltan {numero(faltaDe(it))}</span>}
                    <strong className="r2-num">{dinero(n(it.cantidad) * n(it.costo_unitario))}</strong>
                  </span>
                </div>
              </li>
            ))}
          </Lista>
        ) : (
          <Tabla etiqueta="Artículos en la orden" columnas={columnas} filas={items} clave="id" densidad="comoda"
            masAcciones={quitarDe} />
        )}
      </section>

      {!vacia && (
        <BarraAccion
          resumen={(
            <span className="r2-tk-barra-resumen">
              <span>{resumen}</span>
              {aviso && <span className="r2-tk-barra-aviso">{aviso}</span>}
            </span>
          )}
          principal={{ texto: celular ? 'Finalizar orden' : 'Finalizar orden de salida', alHacer: finalizar }} />
      )}

      {/* Para quién (celular) */}
      {celular && (
        <Cajon abierto={paraQuien} alCerrar={() => setParaQuien(false)} etiqueta="Para quién es la orden">
          <CajonCabecera titulo="Para quién es la orden" dato={`La arma ${e.user?.nombre || 'N/A'} · hoy ${fechaCorta(new Date())}`}
            alCerrar={() => setParaQuien(false)} />
          <CajonCuerpo>
            <div className="r2-tk-cajon-campos">
              <FranjaParaQuien e={e} compacta />
            </div>
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="principal" alHacer={() => setParaQuien(false)}>Listo</Boton>
          </CajonPie>
        </Cajon>
      )}

      {/* Escáner de cámara (mismo componente de siempre; encendido se pinta como hoja) */}
      <Cajon abierto={e.showScanner} alCerrar={() => e.setShowScanner(false)} ancho="ancho" etiqueta="Escanear con la cámara">
        <CajonCabecera titulo="Escanear con la cámara" dato="Los artículos leídos se juntan abajo y se agregan a la orden de una vez."
          alCerrar={() => e.setShowScanner(false)} />
        <CajonCuerpo className="r2-tk-cajon-escaner">
          {e.escaner}
        </CajonCuerpo>
      </Cajon>

      {e.avisoLectura}
      {e.modales}
    </Pagina>
  );
}
