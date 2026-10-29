// Rediseño 2 · Piso · Terminal: obras del área (/terminal/:area) y visor del plano, vista encendida.
// Antes: tarjetas en dos columnas (2 obras por pantalla), los planos como «Ver: FAM. … - PATRONES DE CORTE.pdf» y
// «COMPLETADO» a 14 px del último plano, de un solo toque; «Cambiar de área» junto a «Actualizar».
// Ahora, en tableta horizontal: la cola a la izquierda (renglones de 88 px: nombre, cliente y entrega en palabras) y la
// ficha de la obra elegida a la derecha (la primera ya viene abierta) con sus planos como botones grandes con su nombre
// corto y, abajo y separado 48 px, «Terminar manufactura de esta obra» de 80 px con dos toques (el primero lo arma 4 s).
// En vertical o celular: lista → ficha con un toque. El visor del plano ocupa toda la pantalla y pasa de un plano a otro
// sin cerrarse. «Cambiar de área» va al pie de la lista, lejos de todo.
//
// Técnico: los planos se piden como hoy, UNA vez por obra al montarse su cargador (ProyectoCardTerminal de la página,
// con la misma llave) y no se repiten en la actualización de cada 15 s; la ficha lee lo ya cargado: elegir otra obra no
// pide nada. «Terminar» llama al MISMO manejador de hoy (handleCompletar de la página) con el mismo resguardo de la
// tarjeta (no deja tocar dos veces mientras se procesa ni durante una actualización).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, FileText, LogOut } from 'lucide-react';
import {
  MarcoTerminal, FilaPiso, BotonPiso, BotonTerminar, VisorPlano, HoraDeDatos, useTemaPiso, useHoraDeDatos, useEsCelular, plural, clases,
  fechaExacta, AREAS,
} from '../fundacion';
import { ligaPlano, nombreCortoPlano, plazoHabil, tipoDe, urgentePorPrioridad } from './obrasPiso';
import './piso.css';
import '../calidad/calidad.css';

// Tableta vertical o celular (< 1024 px): una cosa a la vez (lista → ficha), como las clases de la fundación
const CONSULTA = '(max-width: 1023px)';
const suscribir = (avisar) => { const m = window.matchMedia(CONSULTA); m.addEventListener('change', avisar); return () => m.removeEventListener('change', avisar); };
const useUnaColumna = () => useSyncExternalStore(suscribir, () => window.matchMedia(CONSULTA).matches, () => false);

const NOMBRE_TERMINAR = { diseno: 'diseño', compras: 'compras', manufactura: 'manufactura', herreria: 'herrería', instalacion: 'instalación' };

function PlazoObra({ p, conFecha = false }) {
  const pz = plazoHabil(p.diasRestantes, p.fecha_limite, { avisoHasta: 1 });
  return (
    <span className={clases('r2-pi-plazo', pz.tono && `r2-tono--${pz.tono}`)} title={p.fecha_limite ? `Entrega: ${fechaExacta(p.fecha_limite)}` : undefined}>
      {pz.tono && pz.tono !== 'neutro' && <span className="r2-estado-punto" aria-hidden="true" />}
      {pz.texto}{conFecha && pz.detalle ? <span className="r2-pi-plazo-fecha">{` · ${pz.detalle}`}</span> : null}
    </span>
  );
}

function textoPlanos(estado) {
  if (!estado || (estado.lista === null && !estado.cargando)) return '';
  if (estado.cargando) return 'Buscando planos…';
  return estado.lista.length ? plural(estado.lista.length, 'plano', 'planos') : 'Sin planos';
}

function EsqueletoTerminal() {
  return (
    <div className="r2-terminal-dos" role="status" aria-busy="true">
      <span className="r2-solo-lectores">Cargando las obras del área…</span>
      <div className="r2-terminal-columna-lista">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="r2-pi-esqueleto-fila">
            <span className="r2-hueso" style={{ width: `${[62, 48, 70, 55, 66, 44, 58][i]}%` }} />
            <span className="r2-hueso r2-hueso--tenue" style={{ width: '36%' }} />
          </div>
        ))}
      </div>
      <div className="r2-terminal-ficha">
        <span className="r2-hueso r2-hueso--titulo" style={{ height: 32, width: '60%' }} />
        <span className="r2-hueso r2-hueso--tenue" style={{ width: '40%' }} />
        <span className="r2-hueso r2-pi-hueso-boton" style={{ width: '45%' }} />
      </div>
    </div>
  );
}

export default function VistaTerminalArea({
  area, nombreArea, proyectos, cargando, actualizando, alActualizar, alCompletar, alCambiarArea, cargadores,
}) {
  const tema = useTemaPiso('terminal');
  const hora = useHoraDeDatos(cargando ? null : proyectos);
  const unaColumna = useUnaColumna();
  const celular = useEsCelular();
  const conPlanos = area === 'manufactura' || area === 'herreria';
  const datosArea = { ...(AREAS[area] || {}), nombre: nombreArea };

  // Lo que va cargando cada cargador de planos (uno por obra, de la página): { [id]: { cargando, lista } }
  const [planos, setPlanos] = useState({});
  const alArchivos = useCallback((id, estado) => {
    setPlanos((antes) => (antes[id]?.cargando === estado.cargando && antes[id]?.lista === estado.lista ? antes : { ...antes, [id]: estado }));
  }, []);

  // Obra elegida: la primera al entrar; si se termina y sale de la lista, la que quedó en su lugar
  const [elegida, setElegida] = useState({ id: null, indice: 0 });
  const [enFicha, setEnFicha] = useState(false);
  const [visor, setVisor] = useState(null); // { obraId, id }
  const [completando, setCompletando] = useState(null);
  const obra = useMemo(() => {
    if (!proyectos.length) return null;
    return proyectos.find((p) => p.id === elegida.id) || proyectos[Math.min(elegida.indice, proyectos.length - 1)];
  }, [proyectos, elegida]);

  // En vertical o celular la ficha reemplaza a la lista: se abre arriba y, al volver, la lista regresa a donde estaba
  const posLista = useRef(0);
  const elegir = (p, i) => {
    if (unaColumna) posLista.current = window.scrollY;
    setElegida({ id: p.id, indice: i });
    setEnFicha(true);
  };
  useEffect(() => {
    if (unaColumna) window.scrollTo(0, enFicha ? 0 : posLista.current);
  }, [enFicha, unaColumna]);

  // El mismo resguardo de la tarjeta de hoy: no se toca dos veces mientras se procesa ni durante una actualización
  const terminar = async (id) => {
    if (completando || actualizando) return;
    setCompletando(id);
    try {
      await alCompletar(id);
    } finally {
      setCompletando(null);
      if (unaColumna) setEnFicha(false); // en celular o vertical, de regreso a la cola (la obra ya no está)
    }
  };

  const estadoPlanos = obra ? planos[obra.id] : null;
  const planosVisor = useMemo(() => {
    if (!visor) return [];
    const lista = planos[visor.obraId]?.lista || [];
    const nombreObra = proyectos.find((p) => p.id === visor.obraId)?.nombre;
    return lista.map((a, i) => ({ id: a.id || `plano-${i}`, nombre: nombreCortoPlano(a.nombre, nombreObra, nombreArea), src: ligaPlano(a) }));
  }, [visor, planos, proyectos, nombreArea]);

  const cola = (
    <div className="r2-terminal-columna-lista">
      <div className="r2-pi-lista-cab">
        <span>De lo más urgente a lo menos</span>
        {unaColumna && <HoraDeDatos {...hora} />}
      </div>
      <ul className="r2-terminal-lista" aria-label={`Obras pendientes en ${nombreArea}`}>
        {proyectos.map((p, i) => (
          <FilaPiso
            key={p.id}
            principal={p.nombre}
            secundario={p.cliente && p.cliente.trim().toLowerCase() !== String(p.nombre).trim().toLowerCase() ? p.cliente : null}
            plazo={(
              <span className="r2-pi-fila-plazo">
                <PlazoObra p={p} />
                {urgentePorPrioridad(p) && <span className="r2-pi-urgente">Urgente</span>}
                {/* 28-oct · solo llega con PANEL_CALIDAD (sin la bandera el campo no existe) */}
                {p.calidadCorregir?.length > 0 && <span className="r2c-etiqueta-corregir">Calidad pide corregir</span>}
              </span>
            )}
            derecha={conPlanos ? textoPlanos(planos[p.id]) : null}
            elegida={!unaColumna && obra?.id === p.id}
            alElegir={() => elegir(p, i)}
          />
        ))}
      </ul>
      <div className="r2-pi-lista-pie">
        <BotonPiso nivel="fantasma" icono={LogOut} alHacer={alCambiarArea}>Cambiar de área</BotonPiso>
        <p>Te lleva a la pantalla del código para entrar a otra área.</p>
      </div>
    </div>
  );

  const ficha = obra && (
    <section className="r2-terminal-ficha" aria-label={`Obra ${obra.nombre}`}>
      {unaColumna && (
        <BotonPiso nivel="contorno" icono={ArrowLeft} className="r2-pi-volver" alHacer={() => setEnFicha(false)}>Volver a la lista</BotonPiso>
      )}
      <header className="r2-pi-ficha-cab">
        <h2 className="r2-terminal-ficha-titulo">{obra.nombre}</h2>
        <p className="r2-terminal-ficha-dato">
          {[obra.cliente, tipoDe(obra)?.texto, `Obra n.º ${obra.id}`].filter(Boolean).join(' · ')}
        </p>
      </header>
      <dl className="r2-pi-ficha-datos">
        <div>
          <dt>Entrega</dt>
          <dd><PlazoObra p={obra} /><small>{plazoHabil(obra.diasRestantes, obra.fecha_limite).detalle || 'sin fecha en el Índice'}</small></dd>
        </div>
        {urgentePorPrioridad(obra) && (
          <div><dt>Prioridad</dt><dd>Urgente</dd></div>
        )}
      </dl>
      {obra.calidadCorregir?.length > 0 && (
        <section className="r2c-corregir" aria-label="Calidad pide corregir">
          <p className="r2c-corregir-titulo">Calidad pide corregir</p>
          <ul>
            {obra.calidadCorregir.map((d) => (
              <li key={d.punto}><b>{d.punto}</b><span>{d.texto}{d.nota && <span>{d.nota}</span>}</span></li>
            ))}
          </ul>
        </section>
      )}
      {conPlanos && (
        <div className="r2-pi-planos">
          <p className="r2-terminal-etiqueta">{estadoPlanos?.lista?.length ? `Planos (${estadoPlanos.lista.length})` : 'Planos'}</p>
          {estadoPlanos?.cargando ? (
            <div className="r2-pi-planos-lista" role="status" aria-busy="true">
              <span className="r2-solo-lectores">Buscando los planos…</span>
              <span className="r2-hueso r2-pi-hueso-boton" /><span className="r2-hueso r2-pi-hueso-boton" />
            </div>
          ) : estadoPlanos?.lista?.length ? (
            <div className="r2-pi-planos-lista">
              {estadoPlanos.lista.map((a, i) => (
                <BotonPiso key={a.id || i} icono={FileText} nivel="tonal" title={a.nombre}
                  alHacer={() => setVisor({ obraId: obra.id, id: a.id || `plano-${i}` })}>
                  {nombreCortoPlano(a.nombre, obra.nombre, nombreArea)}
                </BotonPiso>
              ))}
            </div>
          ) : estadoPlanos?.lista ? (
            <p className="r2-pi-nota">Esta obra no tiene planos en Drive.</p>
          ) : null}
        </div>
      )}
      <div className="r2-terminal-separador">
        <BotonTerminar
          key={obra.id}
          texto={celular ? `Terminar ${NOMBRE_TERMINAR[area] || nombreArea.toLowerCase()}` : `Terminar ${NOMBRE_TERMINAR[area] || nombreArea.toLowerCase()} de esta obra`}
          confirmacion={celular ? 'Toca otra vez para confirmar' : `Toca otra vez para terminar ${NOMBRE_TERMINAR[area] || nombreArea.toLowerCase()} de ${obra.nombre}`}
          alTerminar={() => terminar(obra.id)}
          cargando={completando === obra.id}
          // Mismo resguardo de hoy: no acepta toques mientras se guarda ni mientras la lista se actualiza (cada 15 s).
          // Durante la actualización sola no se desvanece ni muestra aviso (piso.css): antes parpadeaba cada 15 s.
          className={actualizando && !completando ? 'r2-pi-terminar--refresco' : undefined}
          deshabilitado={Boolean(completando) || actualizando}
          motivo={completando ? 'Guardando…' : undefined}
        />
      </div>
    </section>
  );

  let cuerpo;
  if (cargando) cuerpo = <EsqueletoTerminal />;
  else if (!proyectos.length) {
    cuerpo = (
      <div className="r2-pi-vacio">
        <h2>{`No hay obras pendientes en ${nombreArea}`}</h2>
        <p>Cuando una obra llegue a esta área aparecerá aquí sola. La lista se actualiza cada 15 segundos.</p>
        <div className="r2-pi-lista-pie" style={{ borderTop: 0, justifyItems: 'center' }}>
          <BotonPiso nivel="fantasma" icono={LogOut} alHacer={alCambiarArea}>Cambiar de área</BotonPiso>
        </div>
      </div>
    );
  } else if (unaColumna) cuerpo = <div className="r2-terminal-dos">{enFicha && obra ? ficha : cola}</div>;
  else cuerpo = <div className="r2-terminal-dos">{cola}{ficha}</div>;

  return (
    <MarcoTerminal
      className="r2-pi-terminal"
      area={datosArea}
      dato={cargando ? null : `${plural(proyectos.length, 'obra pendiente', 'obras pendientes')}`}
      hora={cargando ? null : hora}
      alActualizar={alActualizar}
      actualizando={actualizando}
      tema={tema}
    >
      {cuerpo}
      {/* Un cargador de planos por obra (de la página, con la misma llave de hoy): no pinta nada, solo avisa qué trajo */}
      {!cargando && cargadores?.(alArchivos)}
      {visor && planosVisor.length > 0 && (
        <VisorPlano planos={planosVisor} obra={proyectos.find((p) => p.id === visor.obraId)?.nombre} elegido={visor.id} alElegir={(id) => setVisor((v) => ({ ...v, id }))} alCerrar={() => setVisor(null)} tema={tema} />
      )}
    </MarcoTerminal>
  );
}
