// Rediseño 2 · Compras · «Bajo stock mínimo» desde Solicitudes, en cajón extra con TABLA (vista ENCENDIDA de
// ModalArticulosEncontrados). Hoy eran tarjetas de 270 px con tres cajas adentro; aquí un renglón por artículo con lo que se
// decide: existencia contra mínimo, cuándo se movió por última vez y «Crear solicitud». Los filtros de almacén y sección,
// el PDF y la petición de «última actualización» por artículo son los mismos de hoy.
import { Download, Plus, CheckCircle2 } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, FiltroMenu, QuitarFiltros, Tabla, Estado, Boton, Miniatura, Fecha,
  cantidad, plural, useEsCelular,
} from '../fundacion';
import './compras.css';

// Lo mismo que calculaba la tarjeta de hoy: < 50 % del mínimo es crítico, < 100 % es bajo
const nivel = (a) => {
  const pct = (parseFloat(a.stock_actual) / parseFloat(a.stock_minimo || 1)) * 100;
  return pct < 50 ? 'critico' : pct < 100 ? 'bajo' : null;
};

export function UltimoMovimientoR2({ loading, mov, soloFecha = false }) {
  if (loading) return <span className="r2c-sec">Cargando…</span>;
  if (!mov) return <span className="r2c-sec">sin movimientos</span>;
  if (soloFecha) return <span>movido <Fecha valor={mov.fecha} /></span>;
  return (
    <span className="r2c-celda-doble r2c-celda-corta">
      <Fecha valor={mov.fecha} />
      <span className="r2c-sec r2c-una-linea" title={[mov.tipo_legible, mov.usuario?.nombre].filter(Boolean).join(' · ')}>
        {[mov.tipo_legible, mov.usuario?.nombre].filter(Boolean).join(' · ')}
      </span>
    </span>
  );
}

export function BotonSolicitudR2({ loading, creada, tieneSolicitud, alCrear, nombre, corto = false }) {
  if (tieneSolicitud || creada) {
    return (
      <span className="r2c-hecho r2-tono--ok">
        <CheckCircle2 size={16} aria-hidden="true" />
        {creada ? (corto ? 'Creada' : 'Solicitud creada') : (corto ? 'Ya pedida' : 'Ya tiene solicitud')}
      </span>
    );
  }
  return (
    <Boton nivel="tonal" tamano="chico" icono={Plus} cargando={loading} alHacer={alCrear} aria-label={`Crear solicitud de ${nombre}`}>
      {corto ? 'Pedir' : 'Crear solicitud'}
    </Boton>
  );
}

export function CajonBajoStockR2(p) {
  const {
    onClose, titulo, articulos, articulosFiltrados, filtroAlmacen, setFiltroAlmacen, filtroSeccion, setFiltroSeccion, almacenesUnicos,
    seccionesUnicas, generarPDFBajoStock, BotonSolicitud, UltimoMovimiento, onCrearSolicitud, articulosConSolicitudIds,
  } = p;
  const celular = useEsCelular();
  const enDefault = filtroAlmacen === 'Principal' && filtroSeccion === 'Stock';
  const donde = `${filtroAlmacen === 'todos' ? 'todos los almacenes' : filtroAlmacen} / ${filtroSeccion === 'todos' ? 'todas las secciones' : filtroSeccion}`;

  const boton = (a) => (
    <BotonSolicitud articulo={a} onCrearSolicitud={onCrearSolicitud} tieneSolicitud={articulosConSolicitudIds.includes(a.id)} corto={celular} />
  );

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo', ancho: '36%',
      celda: (a) => {
        const sec = [a.categoria?.nombre, a.proveedor?.nombre, a.codigo_ean13].filter(Boolean).join(' · ');
        return (
          <span className="r2c-articulo-celda">
            <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} />
            <span className="r2c-celda-doble r2c-celda-corta">
              <span className="r2c-fuerte">{a.nombre}</span>
              <span className="r2c-sec r2c-una-linea" title={sec}>{sec}</span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'existencia', titulo: 'Existencia', alinear: 'der',
      celda: (a) => <span className={nivel(a) === 'critico' ? 'r2c-fuerte r2-tono--mal' : 'r2c-fuerte'}>{cantidad(a.stock_actual, a.unidad)}</span>,
    },
    { id: 'minimo', titulo: 'Mínimo', alinear: 'der', celda: (a) => cantidad(a.stock_minimo, a.unidad) },
    { id: 'maximo', titulo: 'Máximo', alinear: 'der', ocultarEn: 'tableta', celda: (a) => (a.stock_maximo ? cantidad(a.stock_maximo, a.unidad) : '—') },
    { id: 'movimiento', titulo: 'Última actualización', celda: (a) => <UltimoMovimiento articuloId={a.id} /> },
    {
      id: 'estado', titulo: 'Estado',
      celda: (a) => (nivel(a) === 'critico' ? <Estado tono="mal" texto="Crítico" /> : nivel(a) === 'bajo' ? <Estado tono="aviso" texto="Bajo mínimo" /> : null),
    },
  ];

  return (
    <Cajon abierto alCerrar={onClose} ancho="extra" etiqueta={titulo}>
      <CajonCabecera titulo={titulo} alCerrar={onClose}
        dato={`${articulosFiltrados.length} de ${plural(articulos.length, 'artículo', 'artículos')}${!(filtroAlmacen === 'todos' && filtroSeccion === 'todos') ? ` · ${donde}` : ''}`} />
      <CajonDecision>
        <FiltroMenu etiqueta="Almacén" valor={filtroAlmacen} alCambiar={setFiltroAlmacen} porOmision="Principal"
          opciones={[{ valor: 'todos', texto: 'Todos los almacenes' }, ...almacenesUnicos.map((n) => ({ valor: n, texto: n }))]} />
        <FiltroMenu etiqueta="Sección" valor={filtroSeccion} alCambiar={setFiltroSeccion} porOmision="Stock"
          opciones={[{ valor: 'todos', texto: 'Todas las secciones' }, ...seccionesUnicas.map((n) => ({ valor: n, texto: n }))]} />
        {!enDefault && <QuitarFiltros texto="Volver a Principal / Stock" alHacer={() => { setFiltroAlmacen('Principal'); setFiltroSeccion('Stock'); }} />}
        {articulosFiltrados.length > 0 && (
          <Boton nivel="contorno" icono={Download} alHacer={generarPDFBajoStock} className="r2c-empuja-derecha" title="Descargar PDF con los artículos de la lista">
            Descargar PDF
          </Boton>
        )}
      </CajonDecision>
      <CajonCuerpo>
        <Tabla etiqueta={titulo} densidad="compacta" fija={false} clave="id" columnas={columnas} filas={articulosFiltrados}
          accion={boton}
          filaCelular={(a) => ({
            inicio: <Miniatura src={a.imagen_url} alt={a.nombre} tamano={44} />,
            principal: a.nombre,
            secundario: (
              <span>
                <span className={nivel(a) === 'critico' ? 'r2-tono--mal r2c-fuerte' : 'r2-tono--aviso r2c-fuerte'}>{nivel(a) === 'critico' ? 'Crítico' : 'Bajo mínimo'}</span>
                {' · '}{cantidad(a.stock_actual, a.unidad)} de {cantidad(a.stock_minimo, a.unidad)} · <UltimoMovimiento articuloId={a.id} soloFecha />
              </span>
            ),
          })}
          vacio={articulos.length === 0
            ? { titulo: 'No se encontraron artículos' }
            : { titulo: `No hay artículos en ${donde}`, texto: 'Prueba con otro almacén o sección.', accion: !enDefault ? undefined : { texto: 'Ver todos los almacenes', alHacer: () => { setFiltroAlmacen('todos'); setFiltroSeccion('todos'); } } }} />
      </CajonCuerpo>
    </Cajon>
  );
}
