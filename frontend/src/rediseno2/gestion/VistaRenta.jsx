// Rediseño 2 · Gestión · Herramientas de renta (/renta-herramientas), vista ENCENDIDA. Dirección (y almacén/encargados)
// por semana: saber qué hay disponible, asignar, recibir devoluciones y cambiar la condición.
// Antes: cuatro tarjetas de cifras que no filtraban, tipos en renglones de 90 px que en celular se cortaban, y las unidades
// como tarjetas de 330 × 200 con fechas absolutas. Ahora: una tira que filtra, una tabla de tipos con «fuera de servicio»
// calculado (unidades − disponibles − asignadas) y, al abrir un tipo, la tabla de sus unidades con «vence en 13 días».
// Abrir un tipo pide sus unidades como hoy (toggleTipo); asignar, devolver, cambiar condición y nuevo tipo son los
// diálogos de siempre (cada uno pinta su cajón nuevo encendido).
import { Fragment, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, UserCheck, RotateCcw, Settings2, Printer, Wrench } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, TiraCifras, BarraFiltros, Boton, MenuAcciones, Miniatura, Estado, Fecha, Plazo, Cargando, ErrorCarga, Vacio,
  numero, plural, clases, useEsCelular,
} from '../fundacion';
import { getImageUrl } from '../../utils/imageUtils';
import { CONDICION_HERRAMIENTA, ESTATUS_HERRAMIENTA, motivoError } from './comunes';
import './gestion.css';

// Condición física (campo nuevo condicion, o el estado de siempre traducido por la página) y estatus de disponibilidad
const CONDICION = CONDICION_HERRAMIENTA;
const ESTATUS = ESTATUS_HERRAMIENTA;

const imagenDe = (tipo) => (tipo.imagen_url ? getImageUrl(tipo.imagen_url) : tipo.articuloOrigen?.imagen_url ? getImageUrl(tipo.articuloOrigen.imagen_url) : null);
const fueraDeServicio = (t) => Math.max(0, (t.total_unidades || 0) - (t.unidades_disponibles || 0) - (t.unidades_asignadas || 0));

export default function VistaRenta(p) {
  const {
    tipos, tiposFiltrados, tiposExpandidos, unidadesPorTipo, loading, errorCarga, recargar, searchTerm, setSearchTerm, stats, puedeCrear,
    toggleTipo, handleAsignar, handleDevolver, handleCambiarEstado, handleImprimirCodigos, setModalNuevoTipo, mapearEstadoACondicion,
    estaAsignada, dialogos, puedeGestionar,
  } = p;
  const celular = useEsCelular();
  const [filtro, setFiltro] = useState(''); // 'asignadas' | 'sin-disponibles' | 'fuera' (solo filtra lo que ya está en pantalla)

  const conAsignadas = tipos.filter((t) => (t.unidades_asignadas || 0) > 0).length;
  const sinDisponibles = tipos.filter((t) => (t.unidades_disponibles || 0) === 0).length;
  const conFuera = tipos.filter((t) => fueraDeServicio(t) > 0).length;
  const filas = tiposFiltrados.filter((t) => {
    if (filtro === 'asignadas') return (t.unidades_asignadas || 0) > 0;
    if (filtro === 'sin-disponibles') return (t.unidades_disponibles || 0) === 0;
    if (filtro === 'fuera') return fueraDeServicio(t) > 0;
    return true;
  });
  const alternar = (id) => setFiltro((f) => (f === id ? '' : id));
  const cifras = [
    { id: 'asignadas', valor: conAsignadas, texto: 'Con asignadas' },
    { id: 'sin-disponibles', valor: sinDisponibles, texto: 'Sin disponibles', tono: sinDisponibles ? 'aviso' : null },
    { id: 'fuera', valor: conFuera, texto: 'Con unidades fuera de servicio', titulo: 'Unidades que no están disponibles ni asignadas (reparación, perdidas, de baja)' },
  ].map((c) => ({ ...c, activa: filtro === c.id, alElegir: () => alternar(c.id) }));
  const informativas = [
    { valor: stats.totalUnidades, texto: 'Unidades' },
    { valor: stats.disponibles, texto: 'Disponibles' },
    { valor: stats.asignadas, texto: 'Asignadas' },
  ];
  const quitarFiltros = () => { setSearchTerm(''); setFiltro(''); };
  const activos = (searchTerm ? 1 : 0) + (filtro ? 1 : 0);

  const condicionDe = (u) => CONDICION[u.condicion || mapearEstadoACondicion(u.estado)] || CONDICION.bueno;
  const estatusDe = (u) => ESTATUS[u.estatus || (u.estado === 'asignada' ? 'asignado' : 'disponible')] || ESTATUS.disponible;
  const asignadaA = (u) => (u.usuarioAsignado ? u.usuarioAsignado.nombre : u.camioneta ? `Camioneta ${u.camioneta.nombre}` : null);

  const accionUnidad = (u, tipo) => (estaAsignada(u)
    ? <Boton nivel="tonal" tamano="chico" icono={RotateCcw} alHacer={() => handleDevolver(u, tipo)}>Devolver</Boton>
    : <Boton nivel="tonal" tamano="chico" icono={UserCheck} alHacer={() => handleAsignar(u, tipo)}>Asignar</Boton>);
  const menuUnidad = (u, tipo) => (
    <MenuAcciones titulo={u.codigo_unico} tamano="chico" acciones={[{ texto: 'Cambiar condición', icono: Settings2, alHacer: () => handleCambiarEstado(u, tipo) }]} />
  );

  // Unidades de un tipo abierto (se pidieron al abrirlo, como hoy)
  const unidadesDe = (tipo) => {
    const unidades = unidadesPorTipo[tipo.id];
    if (!unidades) return <Cargando forma="lista" filas={3} etiqueta={`Cargando las unidades de ${tipo.nombre}…`} />;
    const imprimir = unidades.length > 0 && puedeCrear;
    const pie = (
      <div className="r2g-unidades-pie">
        <span className="r2g-sec">{plural(unidades.length, 'unidad', 'unidades')} de {tipo.nombre}</span>
        {imprimir && <Boton nivel="fantasma" tamano="chico" icono={Printer} alHacer={() => handleImprimirCodigos(tipo)}>Imprimir códigos de barras</Boton>}
      </div>
    );
    if (!unidades.length) return <div className="r2g-unidades">{pie}<p className="r2g-dia-vacio">No hay unidades registradas.</p></div>;
    if (celular) {
      return (
        <div className="r2g-unidades">
          {pie}
          <ul className="r2g-lista-simple">
            {unidades.map((u) => {
              const [ct, ctono] = condicionDe(u);
              const [et, etono] = estatusDe(u);
              return (
                <li key={u.id} className="r2g-unidad-celular">
                  <span className="r2g-celda-doble">
                    <span className="r2g-fuerte">{u.codigo_unico}</span>
                    <span className="r2g-sec">
                      {estaAsignada(u) ? (asignadaA(u) || 'Asignada') : 'Sin asignar'}
                      {estaAsignada(u) && u.fecha_asignacion ? <> · desde <Fecha valor={u.fecha_asignacion} /></> : null}
                    </span>
                    {u.fecha_vencimiento_asignacion && <Plazo fecha={u.fecha_vencimiento_asignacion} prefijo="Devolver: " />}
                    <span className="r2g-estados">
                      <Estado tono={ctono} texto={ct} />
                      <Estado tono={etono} texto={et} />
                    </span>
                  </span>
                  <span className="r2g-acciones-celda">{accionUnidad(u, tipo)}{menuUnidad(u, tipo)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    return (
      <div className="r2g-unidades">
        <table className="r2-tabla r2-tabla--compacta r2g-tabla-unidades" aria-label={`Unidades de ${tipo.nombre}`}>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Condición</th>
              <th scope="col">Estatus</th>
              <th scope="col">Asignada a</th>
              <th scope="col">Desde</th>
              <th scope="col">Devolver</th>
              <th scope="col" className="r2-ocultar-tableta">Notas</th>
              <th scope="col"><span className="r2-solo-lectores">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((u) => {
              const [ct, ctono] = condicionDe(u);
              const [et, etono] = estatusDe(u);
              return (
                <tr key={u.id} className="r2-renglon">
                  <td>
                    <span className="r2g-celda-doble">
                      <span className="r2g-fuerte r2g-num">{u.codigo_unico}</span>
                      {u.numero_serie && <span className="r2g-sec">Serie {u.numero_serie}</span>}
                    </span>
                  </td>
                  <td><Estado tono={ctono} texto={ct} /></td>
                  <td><Estado tono={etono} texto={et} /></td>
                  <td>{estaAsignada(u) ? (asignadaA(u) || '—') : <span className="r2g-sec">—</span>}</td>
                  <td>{estaAsignada(u) && u.fecha_asignacion ? <Fecha valor={u.fecha_asignacion} /> : <span className="r2g-sec">—</span>}</td>
                  <td>{estaAsignada(u) && u.fecha_vencimiento_asignacion ? <Plazo fecha={u.fecha_vencimiento_asignacion} /> : <span className="r2g-sec">—</span>}</td>
                  <td className="r2-ocultar-tableta">{u.observaciones ? <span className="r2g-sec">{u.observaciones}</span> : ''}</td>
                  <td className="r2-celda-acciones"><span className="r2-celda-acciones-dentro">{accionUnidad(u, tipo)}{menuUnidad(u, tipo)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pie}
      </div>
    );
  };

  let cuerpo;
  if (!puedeGestionar) {
    // Mismo aviso de hoy para los roles que no gestionan herramientas
    cuerpo = <Vacio icono={Wrench} titulo="No tienes permisos para acceder a esta sección." texto="Las herramientas de renta las gestionan Dirección, almacén y los encargados." />;
  } else if (loading && !tipos.length) {
    cuerpo = <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[3, 2, 1, 1, 1, 1]} filas={8} etiqueta="Cargando las herramientas…" />;
  } else if (errorCarga && !tipos.length) {
    cuerpo = <ErrorCarga mensaje="No se pudieron cargar las herramientas." motivo={motivoError(errorCarga)} alReintentar={recargar} />;
  } else if (!tipos.length) {
    cuerpo = <Vacio icono={Wrench} titulo="No hay tipos de herramienta registrados" texto="Crea el primer tipo con sus unidades para poder asignarlas."
      accion={puedeCrear ? { texto: 'Nuevo tipo de herramienta', icono: Plus, alHacer: () => setModalNuevoTipo(true) } : undefined} />;
  } else if (!filas.length) {
    cuerpo = <Vacio sinResultados busqueda={searchTerm || undefined} alQuitar={quitarFiltros} />;
  } else if (celular) {
    cuerpo = (
      <ul className="r2g-tipos-celular" aria-label="Tipos de herramienta">
        {filas.map((t) => {
          const abierto = !!tiposExpandidos[t.id];
          const fuera = fueraDeServicio(t);
          return (
            <li key={t.id} className={clases('r2g-tipo-celular', abierto && 'r2g-tipo-celular--abierto')}>
              <button type="button" className="r2g-tipo-celular-boton" aria-expanded={abierto} onClick={() => toggleTipo(t.id)}>
                <Miniatura src={imagenDe(t)} alt={t.nombre} tamano={40} ampliable={false} />
                <span className="r2g-celda-doble r2g-crece">
                  <span className="r2g-fuerte">{t.nombre}</span>
                  <span className="r2g-sec">{[t.prefijo_codigo, t.categoria?.nombre || 'Sin categoría'].join(' · ')}</span>
                  <span className="r2g-linea">
                    <b>{numero(t.unidades_disponibles)}</b> de {numero(t.total_unidades)} disponibles{t.unidades_asignadas > 0 ? ` · ${numero(t.unidades_asignadas)} asignadas` : ''}
                    {fuera > 0 ? ` · ${numero(fuera)} fuera de servicio` : ''}
                  </span>
                </span>
                {abierto ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
              </button>
              {abierto && unidadesDe(t)}
            </li>
          );
        })}
      </ul>
    );
  } else {
    cuerpo = (
      <div className="r2-tabla-marco">
        <table className="r2-tabla r2-tabla--comoda r2-tabla--fija" aria-label="Tipos de herramienta">
          <colgroup>
            <col style={{ width: 56 }} /><col /><col className="r2-ocultar-tableta" /><col style={{ width: 100 }} /><col style={{ width: 120 }} />
            <col style={{ width: 110 }} /><col style={{ width: 150 }} /><col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="r2-solo-lectores">Foto</span></th>
              <th scope="col">Herramienta</th>
              <th scope="col" className="r2-ocultar-tableta">Categoría</th>
              <th scope="col" className="r2-der">Unidades</th>
              <th scope="col" className="r2-der">Disponibles</th>
              <th scope="col" className="r2-der">Asignadas</th>
              <th scope="col" className="r2-der">Fuera de servicio</th>
              <th scope="col"><span className="r2-solo-lectores">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => {
              const abierto = !!tiposExpandidos[t.id];
              const fuera = fueraDeServicio(t);
              return (
                <Fragment key={t.id}>
                  <tr className={clases('r2-renglon r2-renglon--abre', abierto && 'r2-renglon--abierto')} onClick={(e) => { if (!e.target.closest('button, a')) toggleTipo(t.id); }}>
                    <td><Miniatura src={imagenDe(t)} alt={t.nombre} tamano={40} /></td>
                    <td>
                      <button type="button" className="r2-celda-abrir" aria-expanded={abierto} onClick={() => toggleTipo(t.id)}>
                        <span className="r2g-celda-doble">
                          <span className="r2g-fuerte">{t.nombre}</span>
                          <span className="r2g-clave">{t.prefijo_codigo}</span>
                        </span>
                      </button>
                    </td>
                    <td className="r2-ocultar-tableta">{t.categoria?.nombre || <span className="r2g-sec">Sin categoría</span>}</td>
                    <td className="r2-der">{numero(t.total_unidades)}</td>
                    <td className="r2-der">
                      <span className={clases('r2g-num-fuerte', (t.unidades_disponibles || 0) === 0 && 'r2-tono--aviso')}>{numero(t.unidades_disponibles)}</span>
                    </td>
                    <td className="r2-der">{numero(t.unidades_asignadas)}</td>
                    <td className="r2-der">{fuera > 0 ? <span className="r2g-num-fuerte r2-tono--aviso">{numero(fuera)}</span> : <span className="r2g-sec">0</span>}</td>
                    <td className="r2-celda-acciones">{abierto ? <ChevronDown size={20} aria-hidden="true" className="r2g-chevron" /> : <ChevronRight size={20} aria-hidden="true" className="r2g-chevron" />}</td>
                  </tr>
                  {abierto && (
                    <tr className="r2g-fila-detalle">
                      <td colSpan={8}>{unidadesDe(t)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Pagina className="r2g-pagina" titulo="Herramientas de renta" densidad="comoda">
      <EncabezadoPagina titulo="Herramientas de renta" dato={tipos.length ? plural(tipos.length, 'tipo', 'tipos') : undefined}
        principal={puedeGestionar && puedeCrear ? { texto: 'Nuevo tipo de herramienta', corto: 'Nuevo', icono: Plus, alHacer: () => setModalNuevoTipo(true) } : undefined} />
      {puedeGestionar && tipos.length > 0 && <TiraCifras etiqueta="Herramientas" cifras={cifras} informativas={celular ? [] : informativas} />}
      {puedeGestionar && (
        <BarraFiltros busqueda={{ valor: searchTerm, alCambiar: setSearchTerm, texto: celular ? 'Buscar' : 'Buscar por nombre, clave o categoría', etiqueta: 'Buscar por nombre, clave o categoría' }}
          activos={activos} alQuitar={quitarFiltros} resultados={filas.length} />
      )}
      {cuerpo}
      {dialogos}
    </Pagina>
  );
}
