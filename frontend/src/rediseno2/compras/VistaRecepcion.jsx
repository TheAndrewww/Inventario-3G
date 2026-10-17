// Rediseño 2 · Compras · Recepción de mercancía (/recepcion-mercancia), vista ENCENDIDA.
// Arriba lo que VENCE: los conteos por cerrar antes de que se acabe su ventana de reclamo. Abajo las órdenes por recibir,
// primero las que ya llegaron en parte. Una sola acción por renglón: «Recibir», que abre un cajón con los dos caminos
// (con foto de la factura o capturando a mano) y el historial plegado al pie. Todo el estado y las peticiones siguen en
// RecepcionMercanciaPage y en los componentes de siempre.
import { useState } from 'react';
import { PackageCheck, History, Sparkles, ClipboardCheck, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, Tabla, Estado, Fecha, Boton, Cajon, CajonCabecera, Segmentado, Seccion, SeccionCajon,
  plural, useEsCelular,
} from '../fundacion';
import RecibirOrdenModal from '../../components/ordenes/RecibirOrdenModal';
import RecibirConFacturaModal from '../../components/ordenes/RecibirConFacturaModal';
import HistorialRecepcionesOrden from '../../components/ordenes/HistorialRecepcionesOrden';
import { avanceOrden, errorDeCarga } from './comunes';
import Llegada from './Llegada';
import './compras.css';

const CLAVE_CAMINO = 'r2-recepcion-camino';
const leerCamino = () => { try { return localStorage.getItem(CLAVE_CAMINO) === 'mano' ? 'mano' : 'factura'; } catch { return 'factura'; } };
const guardarCamino = (c) => { try { localStorage.setItem(CLAVE_CAMINO, c); } catch { /* sin almacenamiento */ } };

// Historial de recepciones plegado al pie del cajón «Recibir»: al desplegarlo se pide igual que al abrirlo desde «⋯»
function HistorialPlegado({ orden }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <SeccionCajon className="r2c-plegado-pie">
      <button type="button" className="r2c-plegable" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        {abierto ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
        Historial de recepciones de esta orden
      </button>
      {abierto && <HistorialRecepcionesOrden isOpen orden={orden} onClose={() => setAbierto(false)} incrustado />}
    </SeccionCajon>
  );
}

function CajonRecibir({ ordenMano, ordenFactura, abrirMano, cerrarMano, alExitoMano, abrirFactura, cerrarFactura, alExitoFactura }) {
  const celular = useEsCelular();
  // Mientras se registra a mano, hoy el diálogo no se puede cerrar: aquí tampoco el cajón ni el cambio de camino
  const [ocupado, setOcupado] = useState(false);
  const orden = ordenFactura || ordenMano;
  const camino = ordenFactura ? 'factura' : 'mano';
  const cerrar = () => { if (!ocupado) (ordenFactura ? cerrarFactura() : cerrarMano()); };
  const cambiar = (nuevo) => {
    if (!orden || nuevo === camino || ocupado) return;
    guardarCamino(nuevo);
    if (nuevo === 'mano') { cerrarFactura(); abrirMano(orden); } else { cerrarMano(); abrirFactura(orden); }
  };
  return (
    <Cajon abierto={Boolean(orden)} alCerrar={cerrar} ancho="ancho" etiqueta={orden ? `Recibir ${orden.ticket_id}` : 'Recibir'}>
      {orden && (
        <>
          <CajonCabecera titulo={`Recibir ${orden.ticket_id}`} dato={orden.proveedor?.nombre || 'Sin proveedor'}
            estado={<Estado dominio="orden" valor={orden.estado} />} alCerrar={ocupado ? undefined : cerrar} />
          <div className="r2c-camino">
            <Segmentado etiqueta="Cómo recibir" valor={camino} alCambiar={cambiar} anchoCompleto deshabilitado={ocupado}
              opciones={[
                { valor: 'factura', texto: celular ? 'Foto de factura' : 'Con foto de la factura', icono: Sparkles },
                { valor: 'mano', texto: celular ? 'A mano' : 'Capturar a mano', icono: PackageCheck },
              ]} />
          </div>
          {ordenFactura ? (
            <RecibirConFacturaModal key={`f${orden.id}`} isOpen onClose={cerrarFactura} orden={ordenFactura} onSuccess={alExitoFactura}
              incrustado alPie={<HistorialPlegado orden={orden} />} />
          ) : (
            <RecibirOrdenModal key={`m${orden.id}`} isOpen onClose={cerrarMano} orden={ordenMano} onSuccess={alExitoMano}
              incrustado alOcupado={setOcupado} alPie={<HistorialPlegado orden={orden} />} />
          )}
        </>
      )}
    </Cajon>
  );
}

export default function VistaRecepcion(p) {
  const {
    ordenes, filteredOrdenes, loading, errorCarga, recargar, searchTerm, setSearchTerm, conteosAbiertos, abrirConteo, puedeRecibir,
    abrirMano, abrirFactura, abrirHistorial, children,
  } = p;
  const celular = useEsCelular();

  const recibir = (o) => (leerCamino() === 'mano' ? abrirMano(o) : abrirFactura(o));
  // En celular cada renglón lleva «Recibir» a la vista y no lleva «⋯»: los dos caminos y el historial están dentro del cajón
  const grupos = [
    { id: 'parcial', titulo: 'Recibidas en parte', filas: filteredOrdenes.filter((o) => o.estado === 'parcial') },
    { id: 'enviada', titulo: 'Enviadas · por llegar', filas: filteredOrdenes.filter((o) => o.estado === 'enviada') },
  ];

  const columnas = [
    { id: 'folio', titulo: 'Folio', ancho: '120px', celda: (o) => <span className="r2c-folio">{o.ticket_id}</span> },
    { id: 'proveedor', titulo: 'Proveedor', celda: (o) => o.proveedor?.nombre || <span className="r2c-tenue">Sin proveedor</span> },
    { id: 'estado', titulo: 'Estado', ocultarEn: 'tableta', celda: (o) => <Estado dominio="orden" valor={o.estado} /> },
    { id: 'enviada', titulo: 'Enviada', ocultarEn: 'celular-ancho', celda: (o) => <Fecha valor={o.fecha_envio} /> },
    {
      id: 'llegada', titulo: 'Llegada estimada',
      celda: (o) => <Llegada fecha={o.fecha_llegada_estimada} />,
    },
    {
      id: 'avance', titulo: 'Avance',
      celda: (o) => {
        const a = avanceOrden(o);
        return (
          <span className="r2c-celda-doble">
            <span>{a.completos} de {plural(a.total, 'artículo', 'artículos')}</span>
            {a.enParte > 0 && <span className="r2c-sec">{plural(a.enParte, 'llegó en parte', 'llegaron en parte')}</span>}
          </span>
        );
      },
    },
  ];

  const conteosCols = [
    { id: 'folio', titulo: 'Folio', ancho: '120px', celda: (c) => <span className="r2c-folio">{c.ticket_id}</span> },
    { id: 'proveedor', titulo: 'Proveedor', celda: (c) => c.proveedor || 'Sin proveedor' },
    { id: 'articulos', titulo: 'Artículos', alinear: 'der', ocultarEn: 'celular-ancho', celda: (c) => plural(c.articulos.length, 'artículo', 'artículos') },
    {
      id: 'ventana', titulo: 'Ventana para reclamar',
      celda: (c) => (c.vencido
        ? <Estado tono="mal" texto="Venció" detalle="se cerrará sola" />
        : <Estado tono={c.dias_restantes <= 1 ? 'aviso' : 'neutro'} texto={c.dias_restantes <= 0 ? 'Vence hoy' : `Vence en ${plural(c.dias_restantes, 'día', 'días')}`} />),
    },
  ];

  return (
    <Pagina titulo="Recepción de mercancía" densidad="comoda" className="r2c-pagina">
      <EncabezadoPagina pestanas="seccion"
        ayuda={celular ? undefined : 'Recibe lo que llega con foto de la factura o capturando a mano; se puede recibir en partes y el stock se actualiza al registrar.'} />

      {conteosAbiertos.length > 0 && (
        <Seccion titulo="Por contar" dato={celular ? String(conteosAbiertos.length) : `${conteosAbiertos.length} · antes de que venza su ventana de 7 días`} className="r2c-seccion-primera">
          <Tabla etiqueta="Conteos por cerrar" densidad="compacta" fija={false} clave="id" columnas={conteosCols} filas={conteosAbiertos}
            alAbrir={abrirConteo} etiquetaAbrir={(c) => `Contar ${c.ticket_id}`}
            accion={(c) => <Boton nivel="tonal" tamano="chico" icono={ClipboardCheck} alHacer={() => abrirConteo(c)} aria-label={`Contar ${c.ticket_id}`}>Contar</Boton>}
            filaCelular={(c) => ({
              principal: c.ticket_id,
              secundario: `${c.proveedor || 'Sin proveedor'} · ${plural(c.articulos.length, 'artículo', 'artículos')}`,
              debajo: c.vencido ? <Estado tono="mal" texto="Venció" />
                : <Estado tono={c.dias_restantes <= 1 ? 'aviso' : 'neutro'} sinPunto={c.dias_restantes > 1} texto={c.dias_restantes <= 0 ? 'Vence hoy' : `Vence en ${plural(c.dias_restantes, 'día', 'días')}`} />,
            })} />
        </Seccion>
      )}

      <h2 className="r2c-titulo-lista">Órdenes por recibir <span className="r2-grupo-cuenta">{ordenes.length}</span></h2>
      <BarraFiltros busqueda={{ valor: searchTerm, alCambiar: setSearchTerm, texto: celular ? 'Buscar folio o proveedor' : 'Buscar folio, proveedor u observaciones', etiqueta: 'Buscar folio, proveedor u observaciones' }}
        activos={searchTerm ? 1 : 0} alQuitar={() => setSearchTerm('')} resultados={filteredOrdenes.length} />

      <Tabla etiqueta="Órdenes por recibir" clave="id" columnas={columnas} grupos={grupos}
        alAbrir={puedeRecibir ? recibir : abrirHistorial}
        etiquetaAbrir={(o) => (puedeRecibir ? `Recibir ${o.ticket_id}` : `Historial de recepciones de ${o.ticket_id}`)}
        accion={(o) => (puedeRecibir
          ? <Boton nivel="tonal" tamano="chico" icono={celular ? undefined : PackageCheck} alHacer={() => recibir(o)} aria-label={`Recibir ${o.ticket_id}`}>Recibir</Boton>
          : <Boton nivel="contorno" tamano="chico" icono={celular ? undefined : History} alHacer={() => abrirHistorial(o)}
            aria-label={`Historial de recepciones de ${o.ticket_id}`}>Historial</Boton>)}
        masAcciones={puedeRecibir && !celular ? (o) => [
          { texto: 'Recibir con foto de la factura', icono: Sparkles, alHacer: () => { guardarCamino('factura'); abrirFactura(o); } },
          { texto: 'Recibir capturando a mano', icono: PackageCheck, alHacer: () => { guardarCamino('mano'); abrirMano(o); } },
          { texto: 'Historial de recepciones', icono: History, alHacer: () => abrirHistorial(o) },
        ] : undefined}
        filaCelular={(o) => {
          const a = avanceOrden(o);
          return {
            principal: o.ticket_id,
            secundario: o.proveedor?.nombre || 'Sin proveedor',
            derecha: `${a.completos} de ${a.total}`,
            debajo: o.fecha_llegada_estimada ? <Llegada fecha={o.fecha_llegada_estimada} /> : <Estado dominio="orden" valor={o.estado} />,
          };
        }}
        cargando={loading && !ordenes.length}
        error={errorDeCarga('No se pudieron cargar las órdenes por recibir.', errorCarga, recargar)}
        vacio={searchTerm
          ? { sinResultados: true, busqueda: searchTerm, alQuitar: () => setSearchTerm('') }
          : { titulo: 'No hay órdenes por recibir', texto: 'Las órdenes enviadas al proveedor aparecen aquí hasta que se reciben completas.' }} />

      <CajonRecibir {...p} />
      {children}
    </Pagina>
  );
}
