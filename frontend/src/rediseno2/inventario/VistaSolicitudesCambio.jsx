// Rediseño 2 · grupo inventario · Cambios por autorizar (/solicitudes-cambio) encendido. DISENO-v2 §5.3.
// Una tabla de decisiones agrupada por tipo de cambio: lo más visible es el CAMBIO (antes → después); a la derecha «Aprobar»
// (tonal) y «Rechazar» (fantasma). Pestañas Pendientes · Aprobados · Rechazados con su número. El ajuste directo de
// almacén (configuración rara y de riesgo) pasa a «Más acciones», en un cajón corto con su explicación.
// Mismas confirmaciones (aprobar) y el mismo motivo (rechazar): son los manejadores de la página.
import { useState } from 'react';
import { RefreshCw, Check, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { Pestanas } from '../fundacion/piezas/Pestanas';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Estado } from '../fundacion/piezas/Estado';
import { Fecha } from '../fundacion/piezas/Fecha';
import { Boton } from '../fundacion/piezas/Boton';
import { Vacio } from '../fundacion/piezas/Estados';
import { Interruptor } from '../fundacion/piezas/Campos';
import { Nota } from '../fundacion/piezas/Ayudas';
import { Cajon, CajonCabecera, CajonCuerpo, SeccionCajon } from '../fundacion/piezas/Cajon';
import { numero, cantidad } from '../fundacion/formato';
import { num, motivoLegible } from './ayudas';
import './inventario.css';

const PESTANAS = [
  { id: 'pendiente', texto: 'Pendientes' },
  { id: 'aprobada', texto: 'Aprobados' },
  { id: 'rechazada', texto: 'Rechazados' },
];

// Nombre de un tipo que la página no trae en su lista (hoy: «cambio_codigo», que crea la recepción con factura). Solo es el
// texto en pantalla: la página y sus confirmaciones no cambian.
const TIPOS_EXTRA = { cambio_codigo: 'Cambio de código' };
const nombreTipo = (t, lista) => lista?.[t] || TIPOS_EXTRA[t]
  || String(t || 'Otro').replace(/_/g, ' ').replace(/^\p{L}/u, (l) => l.toUpperCase());

// El cambio pedido, lo más visible del renglón. Entradas y salidas: «48 → 58 pzas» con lo que se suma o se quita; cambio de
// código: «anterior → nuevo» con lo que ya trae la solicitud; lo demás, el texto de siempre de la página (describirCambio).
function Cambio({ s, describir }) {
  if (s.tipo === 'cambio_codigo' && s.payload?.codigo_ean13) {
    const anterior = s.payload.codigo_anterior || s.articulo?.codigo_ean13;
    return (
      <span className="r2-inv-cambio">
        <span className="r2-inv-cambio-valor r2-num">
          {anterior ? <>{anterior} <ArrowRight size={14} aria-hidden="true" /> </> : null}<strong>{s.payload.codigo_ean13}</strong>
        </span>
      </span>
    );
  }
  if (s.tipo === 'entrada_stock' || s.tipo === 'salida_stock') {
    const antes = num(s.snapshot?.stock_actual);
    const mueve = num(s.payload?.cantidad);
    const despues = s.tipo === 'entrada_stock' ? antes + mueve : antes - mueve;
    const unidad = s.articulo?.unidad || 'piezas';
    const hayAntes = s.snapshot?.stock_actual != null;
    return (
      <span className="r2-inv-cambio">
        <span className="r2-inv-cambio-valor">
          {hayAntes ? <>{numero(antes)} <ArrowRight size={14} aria-hidden="true" /> <strong className={despues < 0 ? 'r2-tono--mal' : undefined}>{cantidad(despues, unidad)}</strong></> : <strong>{describir(s)}</strong>}
        </span>
        <span className="r2-inv-desc">{s.tipo === 'entrada_stock' ? 'Entra' : 'Sale'} {cantidad(mueve, unidad)}</span>
      </span>
    );
  }
  const texto = describir(s);
  return <span className="r2-inv-cambio"><span className="r2-inv-cambio-valor"><strong>{texto || '—'}</strong></span></span>;
}

export default function VistaSolicitudesCambio({ s: v }) {
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const cuenta = (estado) => v.solicitudes.filter((x) => x.estado === estado).length;
  const tipos = [...new Set(v.filtradas.map((x) => x.tipo))];
  const etiquetaTipo = (t) => nombreTipo(t, v.TIPO_LABEL);
  const grupos = tipos.map((t) => ({ id: t, titulo: etiquetaTipo(t), filas: v.filtradas.filter((x) => x.tipo === t) }));
  const pendientes = v.tabActivo === 'pendiente';
  const sinDatos = Boolean(v.errorCargaR2) && !v.solicitudes.length; // si la carga falló no se pintan ceros que no son ciertos

  const ayuda = v.esAdmin ? 'Aprueba o rechaza los cambios que pide Almacén.'
    : v.esCompras ? 'Aprueba o rechaza las solicitudes para reactivar artículos.'
      : 'Estado de las solicitudes que enviaste al administrador.';

  const acciones = (x) => (v.puedeResolver(x) && x.estado === 'pendiente' ? (
    <>
      <Boton nivel="tonal" tamano="chico" icono={Check} alHacer={() => v.aprobar(x.id)} cargando={v.procesandoId === x.id}
        deshabilitado={v.procesandoId === x.id}>Aprobar</Boton>
      <Boton nivel="fantasma" tamano="chico" alHacer={() => v.rechazar(x.id)} deshabilitado={v.procesandoId === x.id}>Rechazar</Boton>
    </>
  ) : null);

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo', ancho: '26%', celda: (x) => (
        <span className="r2-inv-articulo-texto">
          <span className="r2-inv-nombre">{x.articulo?.nombre || x.snapshot?.nombre || x.payload?.nombre || '—'}</span>
          {x.articulo?.codigo_ean13 && <span className="r2-inv-desc r2-num">{x.articulo.codigo_ean13}</span>}
        </span>
      ),
    },
    { id: 'cambio', titulo: 'Cambio', ancho: '20%', celda: (x) => <Cambio s={x} describir={v.describirCambio} /> },
    { id: 'pidio', titulo: 'Pidió', ocultarEn: 'tableta', celda: (x) => x.solicitante?.nombre || '—' },
    { id: 'cuando', titulo: 'Cuándo', celda: (x) => <Fecha valor={x.created_at} /> },
    {
      id: 'motivo', titulo: pendientes ? 'Motivo' : 'Resolución', ancho: '22%', celda: (x) => {
        if (x.estado === 'rechazada') {
          return <Estado tono="mal" texto={`Rechazado${x.aprobador ? ` por ${x.aprobador.nombre}` : ''}`} detalle={x.motivo_rechazo || null} />;
        }
        if (x.estado === 'aprobada') {
          return (
            <span className="r2-inv-articulo-texto">
              <Estado tono="ok" texto={`Aprobado${x.aprobador ? ` por ${x.aprobador.nombre}` : ''}`} />
              {x.fecha_resolucion && <span className="r2-inv-desc"><Fecha valor={x.fecha_resolucion} /></span>}
            </span>
          );
        }
        const motivo = x.observaciones || x.payload?.observaciones || x.payload?.motivo;
        return motivo ? <span className="r2-inv-motivo">{motivo}</span> : <span className="r2-inv-desc">Sin motivo</span>;
      },
    },
  ];

  return (
    <Pagina titulo="Cambios por autorizar" densidad="comoda" className="r2-inv">
      <EncabezadoPagina titulo="Cambios por autorizar" dato={sinDatos ? undefined : `${numero(cuenta('pendiente'))} pendientes`} ayuda={ayuda}
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, alHacer: () => v.cargar(), cargando: v.loading }]}
        masAcciones={v.esAdmin ? [{ texto: 'Ajuste directo de almacén', icono: SlidersHorizontal, alHacer: () => setAjusteAbierto(true) }] : []} />
      {v.esAdmin && v.ajusteDirecto && (
        <Nota tono="aviso" className="r2-inv-aviso-permisos">
          Ajuste directo activo: Almacén registra entradas y salidas sin tu aprobación. Quedan aquí como aprobadas.
        </Nota>
      )}
      <Pestanas etiqueta="Solicitudes por estado" valor={v.tabActivo} alCambiar={v.setTabActivo} className="r2-inv-pestanas"
        pestanas={PESTANAS.map((p) => ({ ...p, cuenta: sinDatos ? undefined : cuenta(p.id) }))} />
      <Tabla etiqueta="Cambios" className="r2-inv-cambios r2-inv-acciones-abajo" columnas={columnas} grupos={grupos} clave="id"
        cargando={v.loading && !v.solicitudes.length} accion={acciones}
        error={v.errorCargaR2 && !v.loading ? { mensaje: 'No se pudieron cargar los cambios por autorizar.', motivo: motivoLegible(v.errorCargaR2), alReintentar: () => v.cargar() } : undefined}
        filaCelular={(x) => ({
          principal: x.articulo?.nombre || x.snapshot?.nombre || x.payload?.nombre || '—',
          secundario: <>{x.solicitante?.nombre || '—'} · <Fecha valor={x.created_at} /></>,
          derecha: <Cambio s={x} describir={v.describirCambio} />,
        })}
        vacio={(
          <Vacio titulo={`No hay cambios ${PESTANAS.find((p) => p.id === v.tabActivo)?.texto.toLowerCase()}`}
            texto={pendientes ? (v.esAdmin ? 'Cuando Almacén pida un cambio aparecerá aquí para que lo apruebes.' : 'Las solicitudes que envíes aparecerán aquí.') : 'Cambia de pestaña para ver las demás.'} />
        )} />

      <Cajon abierto={ajusteAbierto} alCerrar={() => setAjusteAbierto(false)} etiqueta="Ajuste directo de almacén">
        <CajonCabecera titulo="Ajuste directo de almacén" estado={v.ajusteDirecto ? <Estado tono="aviso" texto="Activo" /> : <Estado tono="neutro" texto="Apagado" />}
          alCerrar={() => setAjusteAbierto(false)} />
        <CajonCuerpo>
          <SeccionCajon>
            <Interruptor activo={v.ajusteDirecto} deshabilitado={v.cambiandoAjuste} alCambiar={() => v.toggleAjusteDirecto()}
              texto="Almacén registra entradas y salidas sin pedir aprobación" />
            <p className="r2-nota">
              {v.ajusteDirecto
                ? 'Activo: Almacén registra entradas y salidas de stock sin tu aprobación. Quedan registradas aquí como aprobadas.'
                : 'Apagado: Almacén debe pedir tu aprobación para cada entrada o salida de stock.'}
            </p>
            <p className="r2-nota">Al activarlo se pide confirmación. Lo puedes apagar aquí mismo cuando quieras.</p>
          </SeccionCajon>
        </CajonCuerpo>
      </Cajon>
    </Pagina>
  );
}
