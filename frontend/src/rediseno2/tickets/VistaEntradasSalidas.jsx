// Rediseño 2 · Entradas y salidas (/entradas-salidas), vista encendida. La página guarda el estado (destino, operación,
// lista), la carga, la pistola y el registro; aquí solo se pinta.
//
// Plano (DISENO-v2 §5.2): encabezado con la pistola → franja de arriba con destino (chips) y Salida | Entrada; ya elegido
// el destino la franja se resume en una línea («Salida a Equipo I · Cambiar destino») → buscador/escáner grande → la lista
// como tabla (existencia, cantidad con − y +, «⋯ Quitar») → barra fija «Confirmar salida» / «Confirmar entrada».
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, PackageOpen, Trash2, Truck } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraAccion, Boton, Segmentado, Tabla, Lista, MenuAcciones, Miniatura, Vacio, ErrorCarga, Cargando,
  useEsCelular, cantidad, numero, plural, clases,
} from '../fundacion';
import { CampoEscaner, CantidadTicket, EstadoPistola, ListaResultados } from './comunes';
import { getImageUrl } from '../../utils/imageUtils';
import './tickets.css';

export default function VistaEntradasSalidas({ s }) {
  const celular = useEsCelular();
  const [cambiando, setCambiando] = useState(false);
  const esSalida = s.operacion === 'salida';
  const eligiendo = !s.destino || cambiando;
  const destinos = [
    ...s.camionetas.map((c) => ({ clave: `cam-${c.id}`, nombre: c.nombre, icono: Truck, activo: s.destino?.tipo === 'camioneta' && s.destino.id === c.id,
      elegir: () => s.setDestino({ tipo: 'camioneta', id: c.id, nombre: c.nombre }) })),
    ...s.AREAS.map((a) => ({ clave: a.valor, nombre: a.nombre, icono: a.icon, activo: s.destino?.tipo === 'area' && s.destino.valor === a.valor,
      elegir: () => s.setDestino({ tipo: 'area', valor: a.valor, nombre: a.nombre }) })),
  ];
  const DestinoIcono = destinos.find((d) => d.activo)?.icono || Truck;
  const idResultados = 'r2-tk-resultados-es';
  const verResultados = s.resultados.length > 0;

  const operacion = (
    <Segmentado etiqueta="Operación" valor={s.operacion} alCambiar={s.setOperacion} anchoCompleto={celular}
      opciones={[
        { valor: 'salida', texto: 'Salida', icono: ArrowUpFromLine },
        { valor: 'entrada', texto: 'Entrada', icono: ArrowDownToLine },
      ]} />
  );

  const existencia = (a) => {
    const excede = esSalida && (parseFloat(a.cantidad) || 0) > a.stock_actual;
    return excede ? (
      <span className="r2-tk-falta r2-tono--mal"><span className="r2-estado-punto" aria-hidden="true" />Solo hay {s.formatCantidad(a.stock_actual)} {a.unidad}</span>
    ) : (
      <span className="r2-num">Hay {s.formatCantidad(a.stock_actual)} {a.unidad}</span>
    );
  };
  const cantidadDe = (a) => (
    <CantidadTicket valor={a.cantidad} decimales etiqueta={`Cantidad de ${a.nombre}`}
      alMenos={() => s.cambiarCantidad(a.id, -1)} alMas={() => s.cambiarCantidad(a.id, 1)} alEscribir={(v) => s.fijarCantidad(a.id, v)} />
  );
  const quitarDe = (a) => [{ texto: 'Quitar de la lista', icono: Trash2, peligro: true, alHacer: () => s.quitar(a.id) }];

  const resultados = s.resultados.map((a) => ({
    id: a.id, original: a, nombre: a.nombre, foto: getImageUrl(a.imagen_url) || null,
    // «Hay 120 piezas» no se parte en dos renglones (espacios que no cortan)
    detalle: `${a.sku ? `Clave ${a.sku} · ` : ''}${`Hay ${s.formatCantidad(a.stock_actual)} ${a.unidad || ''}`.trim().replace(/ /g, '\u00a0')}`,
  }));

  if (s.cargando) {
    return (
      <Pagina titulo="Entradas y salidas" densidad="comoda">
        <EncabezadoPagina titulo="Entradas y salidas" />
        <Cargando forma="lista" filas={3} etiqueta="Cargando destinos y artículos…" />
      </Pagina>
    );
  }

  const n = s.seleccionados.length;
  const falta = s.sinStock.length > 0
    ? `Solo hay ${[String(s.formatCantidad(s.sinStock[0].stock_actual)), s.sinStock[0].unidad].filter(Boolean).join(' ')} de ${s.sinStock[0].nombre}`
    : null;

  return (
    <Pagina titulo="Entradas y salidas" densidad="comoda" espacioInferior={n > 0} className="r2-tk-pagina-barra">
      <EncabezadoPagina titulo="Entradas y salidas"
        ayuda={celular ? null : 'Material que se lleva o regresa una camioneta o un área de planta. No genera ticket.'}
        extra={celular ? null : <EstadoPistola activa={Boolean(s.destino)} />} />

      {s.errorCarga && (
        <ErrorCarga mensaje="No se pudieron cargar los artículos." motivo={s.errorCarga?.message}
          alReintentar={() => window.location.reload()} />
      )}

      {/* Destino y operación */}
      {eligiendo ? (
        <section className="r2-tk-franja r2-tk-franja--es" aria-label="Destino y operación">
          <div className="r2-tk-paso">
            <h2 className="r2-tk-paso-titulo">¿A dónde va o de dónde regresa?</h2>
            <div className="r2-tk-destinos" role="radiogroup" aria-label="Destino">
              {destinos.map((d) => (
                <button key={d.clave} type="button" role="radio" aria-checked={d.activo}
                  className={clases('r2-tk-destino', d.activo && 'r2-tk-destino--activo')}
                  onClick={() => { d.elegir(); setCambiando(false); }}>
                  <d.icono size={20} aria-hidden="true" />
                  <span>{d.nombre}</span>
                </button>
              ))}
            </div>
            {s.camionetas.length === 0 && <p className="r2-tk-paso-nota">No hay camionetas registradas; usa las áreas.</p>}
          </div>
          <div className="r2-tk-paso r2-tk-paso--operacion">
            <h2 className="r2-tk-paso-titulo">¿Sale o regresa?</h2>
            {operacion}
          </div>
        </section>
      ) : (
        <section className="r2-tk-franja r2-tk-franja--resumen" aria-label="Destino y operación">
          {operacion}
          <span className="r2-tk-destino-elegido">
            <DestinoIcono size={20} aria-hidden="true" />
            <span>{esSalida ? 'Sale a' : 'Regresa de'} <strong>{s.destino.nombre}</strong></span>
          </span>
          <Boton nivel="fantasma" alHacer={() => setCambiando(true)}>Cambiar destino</Boton>
        </section>
      )}

      {/* Buscador / escáner */}
      <section className="r2-tk-buscador" aria-label="Agregar piezas">
        <div className="r2-tk-buscador-fila">
          <div className="r2-tk-buscador-campo">
            <CampoEscaner ref={s.inputBusquedaRef} valor={s.busqueda} alCambiar={s.setBusqueda} alTecla={s.handleEnterBusqueda}
              alLimpiar={() => s.setBusqueda('')} deshabilitado={!s.destino}
              texto={s.destino ? (celular ? 'Escanea o busca' : 'Escanea el código o busca por nombre o clave') : 'Primero elige el destino'}
              etiqueta="Escanear o buscar artículo" controla={idResultados} expandido={verResultados} />
            {verResultados && (
              <ListaResultados id={idResultados} items={resultados} alElegir={s.agregarArticulo} etiqueta="Artículos encontrados" />
            )}
          </div>
        </div>
        {celular && <p className="r2-tk-buscador-ayuda"><EstadoPistola activa={Boolean(s.destino)} /></p>}
      </section>

      {/* Lista capturada */}
      <section className="r2-tk-orden" aria-label="Piezas capturadas">
        {n > 0 && <h2 className="r2-tk-subtitulo">Piezas capturadas <span className="r2-tk-subtitulo-dato">{numero(n)}</span></h2>}
        {n === 0 ? (
          <div className="r2-tabla-vacia">
            <Vacio icono={PackageOpen}
              titulo={s.destino ? 'Escanea o busca las piezas' : 'Primero elige el destino'}
              texto={s.destino
                ? 'Con la pistola no hace falta tocar el campo: cada lectura suma una pieza.'
                : 'Elige la camioneta o el área de arriba; después escanea o busca las piezas.'} />
          </div>
        ) : celular ? (
          <Lista etiqueta="Piezas capturadas" className="r2-tk-lista-orden">
            {s.seleccionados.map((a) => (
              <li key={a.id} className="r2-tk-fila-orden">
                <div className="r2-tk-fila-orden-arriba">
                  <Miniatura src={getImageUrl(a.imagen_url) || null} alt={a.nombre} tamano={48} />
                  <span className="r2-tk-articulo-lineas">
                    <span className="r2-tk-articulo-nombre">{a.nombre}</span>
                    <span className="r2-tk-articulo-clave">{existencia(a)}</span>
                  </span>
                  <MenuAcciones titulo={a.nombre} acciones={quitarDe(a)} />
                </div>
                <div className="r2-tk-fila-orden-abajo">{cantidadDe(a)}</div>
              </li>
            ))}
          </Lista>
        ) : (
          <Tabla etiqueta="Piezas capturadas" clave="id" densidad="comoda" filas={s.seleccionados} masAcciones={quitarDe}
            columnas={[
              {
                id: 'articulo', titulo: 'Artículo', sinBoton: true,
                celda: (a) => (
                  <span className="r2-tk-articulo">
                    <Miniatura src={getImageUrl(a.imagen_url) || null} alt={a.nombre} tamano={40} />
                    <span className="r2-tk-articulo-nombre">{a.nombre}</span>
                  </span>
                ),
              },
              { id: 'existencia', titulo: 'Existencia', alinear: 'der', ancho: 220, celda: existencia },
              { id: 'cantidad', titulo: 'Cantidad', alinear: 'centro', ancho: 220, sinBoton: true, celda: cantidadDe },
            ]} />
        )}
      </section>

      {n > 0 && (
        <BarraAccion
          resumen={`${esSalida ? 'Salida a' : 'Entrada de'} ${s.destino?.nombre || '—'} · ${plural(n, 'artículo', 'artículos')} · ${cantidad(s.formatCantidad(s.totalPiezas), 'piezas')}`}
          falta={falta}
          principal={{
            texto: s.guardando ? 'Guardando…' : (esSalida ? 'Confirmar salida' : 'Confirmar entrada'),
            icono: Check, alHacer: s.confirmar, cargando: s.guardando, deshabilitado: s.guardando,
          }} />
      )}
    </Pagina>
  );
}
