// Rediseño 2 · riel (DISENO-v2 §3.1). Grupos por área; Compras y Tickets de material son UNA entrada (sus pantallas son
// pestañas). ≥ 1201 px: 264 px con nombres. 861–1200 px: 72 px solo con íconos (nombre al pasar el cursor) y «Menú» lo abre
// completo encima. ≤ 860 px: no se ve; «Más» de la barra inferior lo abre como cajón, con tema, apps, Mi perfil y Cerrar
// sesión al pie. Personalizar menú: mismas claves g3-riel-ocultos / g3-riel-orden / g3-riel-suborden:<id>:compras.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Eye, EyeOff, RotateCcw, Check, SlidersHorizontal, X, Menu, LogOut, Sun, Moon, SunMoon, ChevronDown } from 'lucide-react';
import { useCapa } from '../useCapa';
import { useTemaR2 } from '../useDiseno3G';
import { iniciales, clases } from '../formato';

export function BotonTema({ conTexto = false }) {
  const tema = useTemaR2();
  const siguiente = { claro: 'oscuro', oscuro: 'auto', auto: 'claro' }[tema] || 'oscuro';
  const nombre = { claro: 'claro', oscuro: 'oscuro', auto: 'automático' }[tema] || 'claro';
  const Icono = tema === 'oscuro' ? Moon : tema === 'auto' ? SunMoon : Sun;
  const etiqueta = `Tema ${nombre}. Cambiar a ${({ oscuro: 'oscuro', auto: 'automático', claro: 'claro' })[siguiente]}`;
  if (conTexto) {
    return (
      <button type="button" className="r2-riel-item" onClick={() => window.G3?.tema(siguiente)} aria-label={etiqueta}>
        <Icono size={18} aria-hidden="true" />
        <span className="r2-riel-texto">Tema: {nombre}</span>
      </button>
    );
  }
  return (
    <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma" onClick={() => window.G3?.tema(siguiente)}
      aria-label={etiqueta} title={`Tema ${nombre}`}>
      <Icono size={20} aria-hidden="true" />
    </button>
  );
}

// Selector de apps del paquete, SIN el interruptor «Diseño 3G» (decisión del dueño, 16-oct).
export function SelectorApps({ className }) {
  const ref = useRef(null);
  useEffect(() => {
    const s = window.G3?.selectorApps(ref.current, { actual: 'planta', interruptor: false });
    return () => s?.destruir();
  }, []);
  return <span ref={ref} className={clases('r2-selector-apps', className)} />;
}

export function Riel({
  grupos, rutaActual, usuario, inicio, abierto, alAbrir, alCerrar, editando, alEditar, alTerminarEdicion,
  alternarOculto, mostrarTodos, ordenOriginal, alArrastrar, alSoltar, alCerrarSesion, hayOcultos,
}) {
  const ref = useRef(null);
  useCapa({ abierta: abierto, ref, alCerrar });
  const activo = (it) => it.rutas.includes(rutaActual);
  // Secciones con submenú (Tickets de material, Compras): se despliegan al darles clic; la de la pantalla actual, abierta
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [cerradas, setCerradas] = useState(() => new Set());
  const desplegada = (it) => abiertas.has(it.clave) || (activo(it) && !cerradas.has(it.clave));
  const alternar = (it) => {
    const abrir = !desplegada(it);
    setAbiertas((s) => { const n = new Set(s); if (abrir) n.add(it.clave); else n.delete(it.clave); return n; });
    setCerradas((s) => { const n = new Set(s); if (abrir) n.delete(it.clave); else n.add(it.clave); return n; });
  };
  const visibles = grupos.map((g) => ({ ...g, items: editando ? g.items : g.items.filter((it) => !it.oculto) })).filter((g) => g.items.length);

  return (
    <>
      <aside ref={ref} id="r2-riel" className={clases('r2-riel', abierto && 'r2-riel--abierto', editando && 'r2-riel--editando')}
        aria-label="Menú de Planta" {...(abierto ? { role: 'dialog', 'aria-modal': 'true' } : {})}>
        <div className="r2-riel-cab">
          <Link to={inicio} className="g3-logo r2-riel-logo" aria-label="Planta, inicio">
            <span className="g3-logo-marca" aria-hidden="true">3G</span>
            <span className="r2-riel-texto">Planta<small>3G Velarias</small></span>
          </Link>
          {abierto ? (
            <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma" onClick={alCerrar} aria-label="Cerrar menú" data-r2-foco="">
              <X size={20} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="r2-riel-menu r2-solo-compacto" onClick={alAbrir} aria-label="Abrir el menú completo" aria-controls="r2-riel" aria-expanded={false} title="Menú">
              <Menu size={20} aria-hidden="true" />
              <span>Menú</span>
            </button>
          )}
        </div>

        <div className="r2-riel-grupos">
          {visibles.map((g) => (
            <nav key={g.id} aria-label={g.titulo} className="r2-riel-grupo">
              {g.mostrarTitulo && <div className="r2-riel-grupo-titulo">{g.titulo}</div>}
              {g.items.map((it) => {
                const Icono = it.icono;
                if (editando) {
                  return (
                    <div key={it.clave} className="r2-riel-editar-bloque">
                      <div className={clases('r2-riel-item r2-riel-item--editar', it.oculto && 'r2-riel-item--oculto')}
                        draggable onDragStart={(e) => alArrastrar(e, g.id, it.clave)} onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); alSoltar(g, it.clave); }}>
                        <GripVertical size={16} aria-hidden="true" className="r2-riel-asa" />
                        <Icono size={18} aria-hidden="true" />
                        <span className="r2-riel-texto">{it.etiqueta}</span>
                        <button type="button" className="r2-boton-icono r2-boton-icono--chico r2-boton-icono--fantasma" onClick={() => alternarOculto(it.clave)}
                          aria-label={it.oculto ? `Mostrar ${it.etiqueta}` : `Ocultar ${it.etiqueta}`} aria-pressed={!it.oculto}>
                          {it.oculto ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </div>
                      {it.clave === 'compras' && it.subitems && it.subitems.length > 1 && (
                        <div className="r2-riel-subitems" aria-label={`Orden de las pestañas de ${it.etiqueta}`}>
                          {it.subitems.map((s) => (
                            <div key={s.clave} className="r2-riel-item r2-riel-item--sub" draggable
                              onDragStart={(e) => alArrastrar(e, `${it.clave}:sub`, s.clave)} onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => { e.preventDefault(); alSoltar({ id: `${it.clave}:sub`, items: it.subitems }, s.clave); }}>
                              <GripVertical size={16} aria-hidden="true" className="r2-riel-asa" />
                              <span className="r2-riel-texto">{s.etiqueta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const subs = (it.subitems || []).filter((s) => !s.oculto);
                if (subs.length > 1) {
                  const abiertaYa = desplegada(it);
                  // Clic en la entrada: la despliega (y lleva a su primera pantalla si todavía no estás en la sección).
                  // Si ya estás en ella, solo la abre o la cierra. En el riel compacto (solo íconos) lleva a la sección.
                  return (
                    <div key={it.clave} className={clases('r2-riel-seccion', abiertaYa && 'r2-riel-seccion--abierta')}>
                      <Link to={it.destino} className={clases('r2-riel-item', 'r2-riel-item--padre', activo(it) && 'r2-riel-item--en-seccion')}
                        aria-expanded={abiertaYa} title={it.etiqueta}
                        onClick={(e) => { if (activo(it)) e.preventDefault(); alternar(it); }}>
                        <Icono size={18} aria-hidden="true" />
                        <span className="r2-riel-texto">{it.etiqueta}</span>
                        <ChevronDown size={16} aria-hidden="true" className="r2-riel-flecha" />
                      </Link>
                      {abiertaYa && (
                        <div className="r2-riel-submenu" role="group" aria-label={`Pantallas de ${it.etiqueta}`}>
                          {subs.map((s) => (
                            <Link key={s.clave} to={s.destino} className="r2-riel-item r2-riel-item--hijo"
                              aria-current={rutaActual === s.destino ? 'page' : undefined} onClick={abierto ? alCerrar : undefined}>
                              <span className="r2-riel-texto">{s.etiqueta}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <Link key={it.clave} to={it.destino} className="r2-riel-item" aria-current={activo(it) ? 'page' : undefined}
                    title={it.etiqueta} onClick={abierto ? alCerrar : undefined}>
                    <Icono size={18} aria-hidden="true" />
                    <span className="r2-riel-texto">{it.etiqueta}</span>
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        <div className="r2-riel-pie">
          {editando ? (
            <div className="r2-riel-personalizar">
              <p className="r2-nota">Arrastra para cambiar el orden dentro de cada grupo (y el de las pestañas de Compras). El ojo oculta o muestra una entrada.</p>
              <div className="r2-riel-personalizar-botones">
                {hayOcultos && <button type="button" className="r2-boton r2-boton--contorno r2-boton--chico" onClick={mostrarTodos}><Eye size={16} aria-hidden="true" /><span className="r2-boton-texto">Mostrar todos</span></button>}
                <button type="button" className="r2-boton r2-boton--contorno r2-boton--chico" onClick={ordenOriginal}><RotateCcw size={16} aria-hidden="true" /><span className="r2-boton-texto">Orden original</span></button>
                <button type="button" className="r2-boton r2-boton--principal r2-boton--chico" onClick={alTerminarEdicion}><Check size={16} aria-hidden="true" /><span className="r2-boton-texto">Listo</span></button>
              </div>
            </div>
          ) : (
            <button type="button" className="r2-riel-item" onClick={alEditar} title="Personalizar menú">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span className="r2-riel-texto">Personalizar menú</span>
            </button>
          )}
          {/* Solo en el cajón «Más» del celular: tema, apps y cerrar sesión (en escritorio viven en la barra) */}
          {abierto && (
            <div className="r2-riel-pie-movil r2-solo-movil">
              <BotonTema conTexto />
              <div className="r2-riel-item r2-riel-item--apps"><SelectorApps /><span className="r2-riel-texto">Otras apps de 3G</span></div>
            </div>
          )}
          <Link to="/perfil" className="r2-riel-item r2-riel-perfil" aria-current={rutaActual === '/perfil' ? 'page' : undefined}
            title="Mi perfil" onClick={abierto ? alCerrar : undefined}>
            <span className="g3-avatar" aria-hidden="true">{iniciales(usuario?.nombre)}</span>
            <span className="r2-riel-texto">{usuario?.nombre || 'Mi perfil'}<small>Mi perfil</small></span>
          </Link>
          {abierto && (
            <button type="button" className="r2-riel-item r2-riel-salir r2-solo-movil" onClick={alCerrarSesion}>
              <LogOut size={18} aria-hidden="true" />
              <span className="r2-riel-texto">Cerrar sesión</span>
            </button>
          )}
        </div>
      </aside>
      {abierto && <div className="r2-velo r2-velo--riel" onClick={alCerrar} aria-hidden="true" />}
    </>
  );
}
