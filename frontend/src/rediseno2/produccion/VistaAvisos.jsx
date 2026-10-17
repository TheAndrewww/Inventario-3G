// Rediseño 2 · Producción · Avisos a Producción (/produccion/avisos), vista encendida.
// Antes: tres renglones de filtros y el mensaje escondido en «Ver el mensaje».
// Ahora: filtros en UNA fila (búsqueda · De · Para · Día · Quitar filtros), lo que falló o sigue en cola arriba, luego lo
// enviado por día, con la primera línea del mensaje a la vista; el mensaje completo en un cajón. La liga sigue guardando
// ?origen=, ?destino= y ?dia= (los maneja la página, como hoy). Solo lectura: los mensajes no cambian.
import { useMemo, useState } from 'react';
import { RefreshCw, Megaphone } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, FiltroMenu, Tabla, Estado, Fecha, Cajon, CajonCabecera, CajonCuerpo, SeccionCajon,
  Datos, Mensaje, ErrorCarga, Nota, estadoDe, plural,
} from '../fundacion';
import { FiltroVarios } from './FiltroVarios';
import './produccion.css';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// La primera línea del mensaje que no es el título (el título ya es su primera línea), sin asteriscos ni emojis al inicio
const lineaDeMuestra = (texto) => {
  const lineas = String(texto || '').split('\n').map((l) => l.replace(/[*_~]/g, '').replace(/^[^\p{L}\p{N}«"(¿¡]+/u, '').trim()).filter(Boolean);
  return lineas[1] || '';
};

export default function VistaAvisos({
  datos, cargando, error, cargar, origenes, destinos, dia, cambiar, alternar, setParams, todos, hoy, visibles, cuenta,
  opcionesDia, filtrando, faltan, pasaOrigen, pasaDestino, pasaDia, ORIGENES, DESTINOS, NOMBRE_ORIGEN, NOMBRE_DESTINO, nombreDia,
}) {
  const [busca, setBusca] = useState('');
  const [abiertoId, setAbiertoId] = useState(null);

  const lista = useMemo(() => {
    const q = norm(busca).trim();
    if (!q) return visibles;
    return visibles.filter((a) => norm(`${a.titulo} ${a.texto} ${a.proyecto || ''} ${a.obra || ''}`).includes(q));
  }, [visibles, busca]);

  // Fallaron → En cola → enviados por día (del más nuevo al más viejo), en el orden en que llegan
  const grupos = useMemo(() => {
    const fallaron = lista.filter((a) => a.estado === 'error');
    const enCola = lista.filter((a) => a.estado === 'pendiente');
    const resto = lista.filter((a) => a.estado !== 'error' && a.estado !== 'pendiente');
    const dias = [...new Set(resto.map((a) => a.dia))].sort().reverse();
    return [
      { id: 'error', titulo: 'Fallaron', filas: fallaron },
      { id: 'pendiente', titulo: 'En cola', filas: enCola },
      ...dias.map((d) => {
        const n = nombreDia(d, hoy);
        return { id: `dia-${d}`, titulo: `Enviados ${n === 'Hoy' || n === 'Ayer' ? n.toLowerCase() : `el ${n}`}`, filas: resto.filter((a) => a.dia === d) };
      }),
    ];
  }, [lista, hoy, nombreDia]);

  const abierto = abiertoId ? todos.find((a) => a.id === abiertoId) || null : null;
  const quitar = () => { setBusca(''); setParams(new URLSearchParams(), { replace: true }); };
  const activos = (busca ? 1 : 0) + (origenes.length ? 1 : 0) + (destinos.length ? 1 : 0) + (dia ? 1 : 0);
  const nombreDe = (a) => NOMBRE_ORIGEN[a.origen] || a.origen;
  const paraDe = (a) => NOMBRE_DESTINO[a.destino] || a.destino;
  const obraDe = (a) => (a.proyecto ? `${a.proyecto}${a.obra ? ` · ${a.obra}` : ''}` : null);

  const columnas = [
    {
      id: 'aviso', titulo: 'Aviso',
      celda: (a) => (
        <span className="r2-prod-aviso">
          <span className="r2-prod-aviso-titulo">{a.titulo}</span>
          {lineaDeMuestra(a.texto) && <span className="r2-prod-aviso-muestra">{lineaDeMuestra(a.texto)}</span>}
        </span>
      ),
    },
    { id: 'obra', titulo: 'Obra', ancho: '18%', ocultarEn: 'tableta', celda: (a) => obraDe(a) || <span className="r2-prod-sin-dato">—</span> },
    { id: 'de', titulo: 'De', ancho: 96, celda: nombreDe },
    { id: 'para', titulo: 'Para', ancho: 152, celda: paraDe },
    { id: 'cuando', titulo: 'Cuándo', ancho: 116, celda: (a) => <Fecha valor={a.cuando} /> },
    {
      id: 'estado', titulo: 'Estado', ancho: 170,
      celda: (a) => { const e = estadoDe('aviso', a.estado); return <Estado tono={e.tono} texto={e.texto} detalle={a.error || null} />; },
    },
  ];

  const vacio = filtrando || busca
    ? { sinResultados: true, busqueda: busca || null, titulo: busca ? null : 'Sin avisos con estos filtros', texto: 'Prueba con otro día o quita los filtros.', alQuitar: quitar }
    : { icono: Megaphone, titulo: 'Sin avisos en los últimos días', texto: 'Cuando Planta, Carla o Julia le avisen algo a Producción (etapas, archivos, tickets, cambios de fecha o recordatorios), aparece aquí.' };

  const e = abierto ? estadoDe('aviso', abierto.estado) : null;
  // El motivo que da el servidor; si la página solo tiene su texto de siempre, no se repite
  const motivoError = error && !/^No se pudieron cargar los avisos\.?$/.test(error) ? error : null;

  return (
    <Pagina titulo="Avisos a Producción" densidad="compacta" className="r2-prod-avisos">
      <EncabezadoPagina titulo="Avisos a Producción"
        dato={[`últimos ${plural(datos?.dias || 7, 'día', 'días')}`, cargando && datos ? 'actualizando…' : null].filter(Boolean).join(' · ')}
        ayuda="Todo lo que se mandó a Producción, en un solo lugar. Los mensajes no cambian: aquí solo se ven."
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, cargando, alHacer: cargar }]} />
      <BarraFiltros busqueda={{ valor: busca, alCambiar: setBusca, texto: 'Buscar aviso u obra…' }}
        filtros={[
          <FiltroVarios key="de" etiqueta="De" elegidas={origenes} alAlternar={(id) => alternar('origen', origenes, id)} alLimpiar={() => cambiar('origen', '')}
            opciones={ORIGENES.map((o) => ({ valor: o.id, texto: o.nombre, cuenta: cuenta((a) => a.origen === o.id && pasaDestino(a) && pasaDia(a)) }))} />,
          <FiltroVarios key="para" etiqueta="Para" elegidas={destinos} alAlternar={(id) => alternar('destino', destinos, id)} alLimpiar={() => cambiar('destino', '')}
            opciones={DESTINOS.map((d) => ({ valor: d.id, texto: d.nombre, cuenta: cuenta((a) => a.destino === d.id && pasaOrigen(a) && pasaDia(a)) }))} />,
          <FiltroMenu key="dia" etiqueta="Día" valor={dia} alCambiar={(v) => cambiar('dia', v)}
            opciones={[{ valor: '', texto: `Últimos ${datos?.dias || 7} días` }, ...opcionesDia.map((d) => ({ valor: d, texto: nombreDia(d, hoy) }))]} />,
        ]}
        activos={activos} alQuitar={quitar} resultados={lista.length} />

      {error && datos && <ErrorCarga mensaje="No se pudieron actualizar los avisos." motivo={motivoError} alReintentar={cargar} reintentando={cargando} />}

      <Tabla etiqueta="Avisos a Producción" columnas={columnas} grupos={grupos} densidad="compacta"
        alAbrir={(a) => setAbiertoId(a.id)} etiquetaAbrir={(a) => `Ver el mensaje «${a.titulo}»`} seleccionada={abiertoId}
        filaCelular={(a) => ({
          principal: a.titulo,
          // Revisión: si falló, el motivo va a la vista también en celular (antes solo «Falló» y el motivo en el cajón)
          secundario: a.estado === 'error' && a.error
            ? <span className="r2-tono--mal">{a.error}</span>
            : [`${nombreDe(a)} → ${paraDe(a)}`, obraDe(a)].filter(Boolean).join(' · '),
          derecha: <Fecha valor={a.cuando} />,
          debajo: (() => { const x = estadoDe('aviso', a.estado); return <Estado tono={x.tono} texto={x.texto} />; })(),
        })}
        cargando={cargando && !datos}
        error={error && !datos ? { mensaje: 'No se pudieron cargar los avisos.', motivo: motivoError, alReintentar: cargar } : null}
        vacio={vacio} />

      {datos && faltan.length > 0 && (
        <Nota className="r2-prod-avisos-fuentes">
          {faltan.length === 2
            ? <>Por ahora se ven los avisos que manda <strong>Planta</strong> al grupo Producción. Los de Carla y Julia (recordatorios, confirmación del calendario y cita confirmada al asesor) se sumarán aquí.</>
            : <>Todavía no llegan aquí los avisos de <strong>{faltan[0].nombre}</strong>; se sumarán en cuanto Finanzas los mande.</>}
        </Nota>
      )}

      <Cajon abierto={Boolean(abierto)} alCerrar={() => setAbiertoId(null)} etiqueta={abierto ? `Aviso: ${abierto.titulo}` : 'Aviso'}>
        {abierto && (
          <>
            <CajonCabecera titulo={abierto.titulo} dato={`${nombreDe(abierto)} → ${paraDe(abierto)}`} estado={<Estado tono={e.tono} texto={e.texto} />}
              alCerrar={() => setAbiertoId(null)} />
            <CajonCuerpo>
              <SeccionCajon titulo="Mensaje">
                <Mensaje de={nombreDe(abierto)} para={paraDe(abierto)} texto={abierto.texto} fecha={abierto.cuando}
                  estado={<Estado tono={e.tono} texto={e.texto} detalle={abierto.error || null} />} />
              </SeccionCajon>
              <SeccionCajon titulo="Datos">
                <Datos columnas={2} datos={[
                  ['Obra', obraDe(abierto)],
                  ['Cuándo', `${nombreDia(abierto.dia, hoy)} · ${abierto.hora}`],
                  ['De', nombreDe(abierto)],
                  ['Para', paraDe(abierto)],
                  ['Estado', e.texto],
                  abierto.error ? ['Motivo', abierto.error] : null,
                  abierto.enviadoEn ? ['Enviado', <Fecha key="env" valor={abierto.enviadoEn} />] : null,
                ]} />
              </SeccionCajon>
            </CajonCuerpo>
          </>
        )}
      </Cajon>
    </Pagina>
  );
}
