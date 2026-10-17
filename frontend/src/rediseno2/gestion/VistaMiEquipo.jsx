// Rediseño 2 · Gestión · Mi equipo (/mi-equipo), vista ENCENDIDA. Es el inicio de operadores y encargados (en el celular):
// qué herramientas traigo, en qué condición y desde cuándo, y cómo está mi camioneta. Dirección ve el de otra persona.
// Antes: tres tarjetas para los números 1, 1 y 0 ocupaban media pantalla del celular y la lista empezaba bajo la barra; el
// selector de Dirección estaba a la derecha y sin etiqueta. Ahora: un resumen de una línea, la lista de herramientas
// primero y la camioneta al lado (escritorio) o debajo (celular); Dirección elige a quién ver como primer control.
// Mismos datos de MiEquipoPage (GET /mi-equipo y la lista de usuarios para Dirección); no pide nada.
import { RefreshCw, Wrench, Truck } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Tabla, Estado, Fecha, Miniatura, Datos, Seccion, Campo, Selector, Cargando, ErrorCarga,
  numero, plural, useEsCelular,
} from '../fundacion';
import { getImageUrl } from '../../utils/imageUtils';
import { nombreRol, CONDICION_HERRAMIENTA, motivoError } from './comunes';
import './gestion.css';

const condicion = (c) => CONDICION_HERRAMIENTA[c] || (c ? [c.charAt(0).toUpperCase() + c.slice(1), 'neutro'] : CONDICION_HERRAMIENTA.bueno);

export default function VistaMiEquipo(p) {
  const {
    user, esAdmin, loading, data, refreshing, handleRefresh, usuariosDisponibles, usuarioSeleccionado, setUsuarioSeleccionado, errorCarga,
    recargar,
  } = p;
  const celular = useEsCelular();
  const { stats = {}, herramientas = [], camionetas = [], usuario: usuarioVisto } = data || {};
  const viendoOtro = esAdmin && usuarioSeleccionado && usuarioVisto && usuarioVisto.id !== user?.id;
  const titulo = viendoOtro ? `Equipo de ${usuarioVisto.nombre}` : 'Mi equipo';

  // Resumen de una línea: herramientas, su condición y las alertas de stock (tal como vienen del servidor)
  const porCondicion = stats.herramientasPorCondicion || {};
  const partes = data ? [
    plural(stats.totalHerramientas || 0, 'herramienta', 'herramientas'),
    porCondicion.regular ? plural(porCondicion.regular, 'regular', 'regulares') : null,
    porCondicion.malo ? plural(porCondicion.malo, 'mala', 'malas') : null,
    camionetas.length ? (stats.alertasStock ? plural(stats.alertasStock, 'alerta de stock', 'alertas de stock') : 'sin alertas de stock') : null,
  ].filter(Boolean) : [];

  const columnas = [
    {
      id: 'foto', titulo: <span className="r2-solo-lectores">Foto</span>, ancho: '56px', sinBoton: true,
      celda: (h) => <Miniatura src={h.tipoHerramienta?.imagen_url ? getImageUrl(h.tipoHerramienta.imagen_url) : null} alt={h.tipoHerramienta?.nombre || 'Herramienta'} tamano={40} />,
    },
    {
      id: 'herramienta', titulo: 'Herramienta',
      celda: (h) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{h.tipoHerramienta?.nombre || 'Herramienta'}</span>
          <span className="r2g-clave">{h.codigo_unico}</span>
        </span>
      ),
    },
    { id: 'condicion', titulo: 'Condición', ancho: '140px', celda: (h) => { const [t, tono] = condicion(h.condicion); return <Estado tono={tono} texto={t} />; } },
    { id: 'desde', titulo: 'La tiene desde', ancho: '160px', celda: (h) => <Fecha valor={h.fecha_asignacion} /> },
  ];

  const selector = esAdmin && (
    <div className="r2g-ver-de">
      <Campo etiqueta="Ver el equipo de" ancho="420px">
        <Selector value={usuarioSeleccionado} onChange={(e) => setUsuarioSeleccionado(e.target.value)}>
          <option value="">Mi propio equipo</option>
          {usuariosDisponibles.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({nombreRol(u.rol)})</option>)}
        </Selector>
      </Campo>
    </div>
  );

  let herramientasZona;
  if (loading && !data) {
    herramientasZona = <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[1, 4, 2, 2]} filas={3} etiqueta="Cargando tus herramientas…" />;
  } else if (errorCarga && !data) {
    herramientasZona = <ErrorCarga mensaje="No se pudo cargar tu equipo." motivo={motivoError(errorCarga)} alReintentar={recargar} />;
  } else {
    herramientasZona = (
      <Tabla etiqueta="Herramientas asignadas" clave="id" columnas={columnas} filas={herramientas} densidad="comoda" fija={false}
        filaCelular={(h) => {
          const [t, tono] = condicion(h.condicion);
          return {
            inicio: <Miniatura src={h.tipoHerramienta?.imagen_url ? getImageUrl(h.tipoHerramienta.imagen_url) : null} alt={h.tipoHerramienta?.nombre || 'Herramienta'} tamano={48} />,
            principal: h.tipoHerramienta?.nombre || 'Herramienta',
            secundario: <>{h.codigo_unico}{h.fecha_asignacion ? <> · desde <Fecha valor={h.fecha_asignacion} /></> : null}</>,
            debajo: <Estado tono={tono} texto={t} />,
          };
        }}
        vacio={{ icono: Wrench, titulo: viendoOtro ? `${usuarioVisto?.nombre} no tiene herramientas asignadas` : 'No tienes herramientas asignadas', texto: 'Cuando almacén asigne una herramienta aparecerá aquí con su condición.' }} />
    );
  }

  const camionetasZona = data && camionetas.length > 0 && (
    <Seccion titulo={viendoOtro ? 'Camionetas a cargo' : (camionetas.length === 1 ? 'Mi camioneta' : 'Mis camionetas')} className="r2g-zona-camioneta">
      {camionetas.map((c) => {
        const sinMinimos = !c.stockMinimoConfigurado;
        return (
          <section key={c.id} className="r2g-camioneta" aria-label={c.nombre}>
            <div className="r2g-camioneta-cab">
              <Truck size={20} aria-hidden="true" className="r2g-sec" />
              <h3 className="r2g-camioneta-nombre">{c.nombre}</h3>
              {c.matricula && <span className="r2g-clave">Placas {c.matricula}</span>}
            </div>
            <Datos columnas={2} datos={[
              { etiqueta: 'Stock', valor: c.stockCompleto
                ? <Estado tono={sinMinimos ? 'neutro' : 'ok'} texto="Stock completo" detalle={sinMinimos ? 'No tiene mínimos configurados: no hay nada que comparar.' : undefined} />
                : <Estado tono="aviso" texto={plural(c.alertas.length, 'alerta', 'alertas')} /> },
              { etiqueta: 'Herramientas en la camioneta', valor: numero(c.inventarioActual), numero: true },
              { etiqueta: 'Tipos con mínimo', valor: numero(c.stockMinimoConfigurado), numero: true },
            ]} />
            {c.alertas.length > 0 && (
              <div className="r2g-faltantes">
                <h4 className="r2-seccion-cajon-titulo">Herramientas que faltan</h4>
                <table className="r2-tabla r2-tabla--compacta">
                  <thead><tr><th scope="col">Herramienta</th><th scope="col" className="r2-der">Tiene</th><th scope="col" className="r2-der">Mínimo</th><th scope="col" className="r2-der">Faltan</th></tr></thead>
                  <tbody>
                    {c.alertas.map((a, i) => (
                      <tr key={i}>
                        <td>{a.tipo}</td>
                        <td className="r2-der">{numero(a.actual)}</td>
                        <td className="r2-der">{numero(a.minimo)}</td>
                        <td className="r2-der"><span className="r2g-num-fuerte r2-tono--aviso">{numero(a.faltantes)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </Seccion>
  );

  return (
    <Pagina className="r2g-pagina" titulo={titulo} densidad="comoda">
      <EncabezadoPagina titulo={titulo} dato={loading && data ? 'Cargando…' : (partes.join(' · ') || undefined)}
        ayuda={viendoOtro ? `Lo ves como Dirección · rol: ${nombreRol(usuarioVisto.rol)}` : undefined}
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, alHacer: handleRefresh, cargando: refreshing }]} />
      {selector}
      <div className={camionetasZona ? 'r2g-dos-zonas' : undefined}>
        <Seccion titulo={viendoOtro ? 'Herramientas asignadas' : 'Herramientas que traigo'} dato={data ? numero(herramientas.length) : undefined} className="r2g-zona-herramientas">
          {herramientasZona}
        </Seccion>
        {camionetasZona}
      </div>
    </Pagina>
  );
}
