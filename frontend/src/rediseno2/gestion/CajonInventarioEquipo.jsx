// Rediseño 2 · Gestión · inventario de un equipo (InventarioCamionetaModal encendido), en un cajón ancho.
// Antes: cinco tarjetas de cifras que no filtraban y cada herramienta como tarjeta de ~210 px; los «Vacío» después de los
// «Sin configurar»; «Cerrar» gris a todo lo ancho como única acción. Ahora: cifras que filtran (lo que falta primero), una
// tabla con lo vacío arriba y los números a la derecha. Mismo resumen que pide el modal de siempre (no pide nada más).
import { useState } from 'react';
import { Package } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, SeccionCajon, TiraCifras, Tabla, Estado, Cargando, ErrorCarga, Vacio, numero, plural,
} from '../fundacion';
import { motivoError } from './comunes';
import './gestion.css';

const ESTADOS = {
  vacio: { texto: 'Vacío', tono: 'mal', orden: 0 },
  incompleto: { texto: 'Incompleto', tono: 'aviso', orden: 1 },
  sin_configurar: { texto: 'Sin configurar', tono: 'neutro', orden: 2 },
  completo: { texto: 'Completo', tono: 'ok', orden: 3 },
};

export default function CajonInventarioEquipo({ camioneta, onClose, resumen, cargando, error, reintentar }) {
  const [filtro, setFiltro] = useState('');
  const est = resumen?.estadisticas || {};
  const lista = (resumen?.resumen || [])
    .map((item, i) => ({ ...item, _clave: item.tipo_herramienta?.id ?? i, _i: i }))
    .sort((a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9) || a._i - b._i);
  const filas = filtro ? lista.filter((x) => x.estado === filtro) : lista;
  const alternar = (id) => setFiltro((f) => (f === id ? '' : id));

  const cifras = [
    { id: 'vacio', valor: est.tipos_vacios ?? 0, texto: 'Vacíos', tono: est.tipos_vacios ? 'mal' : null },
    { id: 'incompleto', valor: est.tipos_incompletos ?? 0, texto: 'Incompletos', tono: est.tipos_incompletos ? 'aviso' : null },
    { id: 'completo', valor: est.tipos_completos ?? 0, texto: 'Completos' },
    { id: 'sin_configurar', valor: est.tipos_sin_configurar ?? 0, texto: 'Sin configurar' },
  ].map((c) => ({ ...c, activa: filtro === c.id, alElegir: () => alternar(c.id) }));

  const columnas = [
    {
      id: 'herramienta', titulo: 'Herramienta',
      celda: (x) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{x.tipo_herramienta?.nombre}</span>
          {x.tipo_herramienta?.descripcion && <span className="r2g-sec r2g-una-linea" title={x.tipo_herramienta.descripcion}>{x.tipo_herramienta.descripcion}</span>}
          {x.observaciones_config && <span className="r2g-sec">Nota: {x.observaciones_config}</span>}
        </span>
      ),
    },
    { id: 'minimo', titulo: 'Mínimo', alinear: 'der', ancho: '72px', celda: (x) => numero(x.cantidad_minima) },
    { id: 'actual', titulo: 'Tiene', alinear: 'der', ancho: '64px', celda: (x) => <span className="r2g-num-fuerte">{numero(x.cantidad_actual)}</span> },
    { id: 'faltan', titulo: 'Faltan', alinear: 'der', ancho: '64px', celda: (x) => (x.faltante > 0 ? <span className="r2g-num-fuerte r2-tono--mal">{numero(x.faltante)}</span> : <span className="r2g-sec">—</span>) },
    { id: 'estado', titulo: 'Estado', ancho: '128px', celda: (x) => <Estado tono={ESTADOS[x.estado]?.tono} texto={ESTADOS[x.estado]?.texto || x.estado} /> },
    {
      id: 'unidades', titulo: 'Unidades', ancho: '120px', ocultarEn: 'celular-ancho',
      celda: (x) => (x.unidades?.length ? (
        <span className="r2g-codigos">
          {x.unidades.map((u) => <span key={u.id} className="r2g-clave" title={u.observaciones || u.estado}>{u.codigo_unico}</span>)}
        </span>
      ) : <span className="r2g-sec">Ninguna</span>),
    },
  ];

  let cuerpo;
  if (!resumen && error && !cargando) cuerpo = <ErrorCarga mensaje="No se pudo cargar el inventario del equipo." motivo={motivoError(error)} alReintentar={reintentar} />;
  else if (!resumen) cuerpo = <Cargando forma="tabla" columnas={[3, 1, 1, 1, 2, 2]} filas={6} etiqueta="Cargando el inventario del equipo…" />;
  else if (!lista.length) {
    cuerpo = <Vacio icono={Package} titulo="No hay stock mínimo configurado para este equipo" texto="Configúralo con «Mínimos» en la lista de equipos; después aquí se ve qué le falta." />;
  } else {
    cuerpo = (
      <>
        <TiraCifras etiqueta="Herramientas por estado" cifras={cifras} />
        <Tabla etiqueta={`Inventario de ${camioneta.nombre}`} clave="_clave" columnas={columnas} filas={filas} densidad="compacta" fija={false}
          filaCelular={(x) => ({
            principal: x.tipo_herramienta?.nombre,
            secundario: `Tiene ${numero(x.cantidad_actual)} de ${numero(x.cantidad_minima)}${x.unidades?.length ? ` · ${x.unidades.map((u) => u.codigo_unico).join(', ')}` : ''}`,
            derecha: x.faltante > 0 ? `Faltan ${numero(x.faltante)}` : null,
            debajo: <Estado tono={ESTADOS[x.estado]?.tono} texto={ESTADOS[x.estado]?.texto || x.estado} />,
          })}
          vacio={{ sinResultados: true, titulo: `Ninguna herramienta ${(ESTADOS[filtro]?.texto || '').toLowerCase()}`, alQuitar: () => setFiltro('') }} />
      </>
    );
  }

  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta={`Inventario de ${camioneta.nombre}`}>
      <CajonCabecera titulo={`Inventario de ${camioneta.nombre}`}
        dato={[`Encargado: ${camioneta.encargado?.nombre || 'sin asignar'}`, resumen ? plural(lista.length, 'herramienta configurada', 'herramientas configuradas') : null,
          resumen ? plural(est.total_unidades ?? 0, 'unidad en el equipo', 'unidades en el equipo') : null].filter(Boolean).join(' · ')}
        alCerrar={onClose} />
      <CajonCuerpo>
        <SeccionCajon>{cuerpo}</SeccionCajon>
      </CajonCuerpo>
    </Cajon>
  );
}
