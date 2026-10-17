// VIEJO: se borra a partir del 24-oct-2026 — todo el archivo. Era el armazón del Diseño 3G de antes (ola 1-3); con el rediseño 2
// el marco es rediseno2/fundacion/armazon/Armazon.jsx y nadie importa este archivo.
// Diseño 3G — armazón de Planta: riel agrupado por área, barra superior de vidrio (título, tema, avisos,
// selector de apps con el interruptor, perfil), pestañas de sección y barra inferior en celular.
// Solo se usa con el interruptor encendido (DashboardLayout decide). Las rutas y los permisos son los de siempre.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, MoreHorizontal, Sun, Moon, SunMoon, GripVertical, Eye, EyeOff, RotateCcw, Check, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificacionesDropdown from '../components/common/NotificacionesDropdown';
import { MENU_GRUPOS } from '../components/layout/Sidebar';
import {
  rielParaRol, tituloDeRuta, seccionDeRuta, pestanasDeSeccion, SECCIONES,
  claveOcultosG3 as claveOcultos, claveOrdenG3 as claveOrden, guardarSubOrdenG3, EVENTO_SUBORDEN_G3, heredarAjustesDelMenu,
} from './menuPlanta';
import { useTemaG3 } from './useDiseno3G';
const leerJSON = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const iniciales = (nombre = '') => nombre.split(/\s+/).filter((p) => p && !p.startsWith('(')).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U';

function BotonTema() {
  const tema = useTemaG3();
  const siguiente = { claro: 'oscuro', oscuro: 'auto', auto: 'claro' }[tema] || 'oscuro';
  const nombre = { claro: 'claro', oscuro: 'oscuro', auto: 'automático (como tu equipo)' }[tema] || 'claro';
  const Icono = tema === 'oscuro' ? Moon : tema === 'auto' ? SunMoon : Sun;
  return (
    <button type="button" className="g3-btn-icono" onClick={() => window.G3?.tema(siguiente)}
      aria-label={`Tema ${nombre}. Cambiar a ${({ oscuro: 'oscuro', auto: 'automático', claro: 'claro' })[siguiente]}`}
      title={`Tema ${nombre}`}>
      <Icono size={20} aria-hidden="true" />
    </button>
  );
}

function SelectorApps() {
  const ref = useRef(null);
  useEffect(() => {
    const s = window.G3?.selectorApps(ref.current, { actual: 'planta', interruptor: false });
    return () => s?.destruir();
  }, []);
  return <span ref={ref} className="g3p-selector" />;
}

export default function MarcoPlanta() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false); // riel en celular
  const [editando, setEditando] = useState(false);
  const [ocultos, setOcultos] = useState(() => { heredarAjustesDelMenu(user?.id); return new Set(leerJSON(claveOcultos(user?.id), [])); });
  const [orden, setOrden] = useState(() => leerJSON(claveOrden(user?.id), []));
  const [versionSub, setVersionSub] = useState(0);
  const arrastre = useRef(null);

  useEffect(() => { heredarAjustesDelMenu(user?.id); setOcultos(new Set(leerJSON(claveOcultos(user?.id), []))); setOrden(leerJSON(claveOrden(user?.id), [])); }, [user?.id]);
  useEffect(() => {
    const alCambiar = () => setVersionSub((v) => v + 1);
    window.addEventListener(EVENTO_SUBORDEN_G3, alCambiar);
    return () => window.removeEventListener(EVENTO_SUBORDEN_G3, alCambiar);
  }, []);
  useEffect(() => { setAbierto(false); }, [pathname]);
  const pestanasRef = useRef(null);
  useEffect(() => {
    const a = pestanasRef.current?.querySelector('[aria-current="page"]');
    if (a && pestanasRef.current.scrollWidth > pestanasRef.current.clientWidth) a.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);
  useEffect(() => {
    if (!abierto) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);

  const grupos = useMemo(() => rielParaRol(user?.rol, user?.id, ocultos).map((g) => {
    // Compras sigue el orden de sus pestañas (guardado en la clave propia del riel); los demás, el del riel
    const ordenCompras = g.id === 'compras' ? pestanasDeSeccion('compras', user?.rol, user?.id).map((p) => p.path) : null;
    const pos = (it) => { const i = (ordenCompras || orden).indexOf(it.clave); return i === -1 ? 999 : i; };
    const items = [...g.items].sort((a, b) => pos(a) - pos(b) || g.items.indexOf(a) - g.items.indexOf(b));
    return { ...g, items };
  }), [user?.rol, user?.id, ocultos, orden, versionSub]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = grupos.map((g) => ({ ...g, items: editando ? g.items : g.items.filter((it) => !it.oculto) })).filter((g) => g.items.length);
  const seccion = seccionDeRuta(pathname);
  const pestanas = seccion ? pestanasDeSeccion(seccion, user?.rol, user?.id) : [];
  const titulo = seccion ? SECCIONES[seccion].titulo : tituloDeRuta(pathname);
  const activo = (it) => it.rutas.includes(pathname);

  const alternarOculto = (clave) => setOcultos((prev) => {
    const n = new Set(prev);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    guardarJSON(claveOcultos(user?.id), [...n]);
    return n;
  });
  const mostrarTodos = () => { guardarJSON(claveOcultos(user?.id), null); setOcultos(new Set()); };
  const ordenOriginal = () => { guardarJSON(claveOrden(user?.id), null); setOrden([]); guardarSubOrdenG3(user?.id, 'compras', null); };
  const soltar = (grupo, destino) => {
    const origen = arrastre.current;
    arrastre.current = null;
    if (!origen || origen.grupo !== grupo.id || origen.clave === destino) return;
    const claves = grupo.items.map((i) => i.clave);
    const [movida] = claves.splice(claves.indexOf(origen.clave), 1);
    claves.splice(claves.indexOf(destino), 0, movida);
    if (grupo.id === 'compras') {
      // Cambia el orden de las pestañas de Compras (y del riel), en la clave propia del diseño nuevo
      guardarSubOrdenG3(user?.id, 'compras', [...claves, ...MENU_GRUPOS.compras.orden.filter((p) => !claves.includes(p))]);
      return;
    }
    const resto = orden.filter((c) => !claves.includes(c));
    const nuevo = [...resto, ...claves];
    guardarJSON(claveOrden(user?.id), nuevo);
    setOrden(nuevo);
  };

  // Barra inferior (celular): hasta 4 destinos principales que el rol ve, y «Más» abre el riel con todo
  const todos = grupos.flatMap((g) => g.items.filter((it) => !it.oculto).map((it) => ({ ...it, grupo: g.id })));
  const inferiores = [
    todos.find((it) => it.clave === '/inventario') && { ...todos.find((it) => it.clave === '/inventario'), corto: 'Inventario' },
    todos.find((it) => it.clave === 'tickets') && { ...todos.find((it) => it.clave === 'tickets'), corto: 'Tickets' },
    todos.find((it) => it.grupo === 'compras') && { ...todos.find((it) => it.grupo === 'compras'), corto: 'Compras', rutas: todos.filter((it) => it.grupo === 'compras').flatMap((it) => it.rutas) },
    todos.find((it) => it.grupo === 'produccion') && { ...todos.find((it) => it.grupo === 'produccion'), corto: 'Producción', rutas: todos.filter((it) => it.grupo === 'produccion').flatMap((it) => it.rutas) },
    todos.find((it) => it.clave === '/calendario') && { ...todos.find((it) => it.clave === '/calendario'), corto: 'Calendario' },
    todos.find((it) => it.clave === '/mi-equipo') && { ...todos.find((it) => it.clave === '/mi-equipo'), corto: 'Mi equipo' },
  ].filter(Boolean).slice(0, 4);

  return (
    <div className="g3-marco g3p-marco">
      <aside id="g3p-riel" className="g3-riel g3p-riel" aria-label="Menú de Planta" data-abierto={abierto ? '' : undefined}>
        <div className="g3p-riel-cab">
          <Link to="/inventario" className="g3-logo">
            <span className="g3-logo-marca" aria-hidden="true">3G</span>
            <span>Planta<small>3G Velarias</small></span>
          </Link>
          {abierto && (
            <button type="button" className="g3-btn-icono g3p-solo-movil" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {visibles.map((g) => (
          <nav key={g.id} aria-label={g.titulo} className="g3p-riel-seccion">
            <div className="g3-riel-grupo">{g.titulo}</div>
            {g.items.map((it) => {
              const Icono = it.icono;
              if (editando) {
                return (
                  <div key={it.clave} className="g3-riel-item g3p-riel-editar" data-oculto={it.oculto ? '' : undefined}
                    draggable onDragStart={(e) => { arrastre.current = { grupo: g.id, clave: it.clave }; try { e.dataTransfer.setData('text/plain', it.clave); } catch { /* nada */ } }}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); soltar(g, it.clave); }}>
                    <GripVertical size={16} aria-hidden="true" className="g3p-asa" />
                    <Icono size={20} aria-hidden="true" />
                    <span className="g3p-riel-texto">{it.etiqueta}</span>
                    <button type="button" className="g3-btn-icono g3p-ojo" onClick={() => alternarOculto(it.clave)}
                      aria-label={it.oculto ? `Mostrar ${it.etiqueta}` : `Ocultar ${it.etiqueta}`} aria-pressed={!it.oculto}>
                      {it.oculto ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                );
              }
              return (
                <Link key={it.clave} to={it.destino} className="g3-riel-item" aria-current={activo(it) ? 'page' : undefined}>
                  <Icono size={20} aria-hidden="true" />
                  <span className="g3p-riel-texto">{it.etiqueta}</span>
                </Link>
              );
            })}
          </nav>
        ))}

        <div className="g3-riel-pie">
          {editando ? (
            <div className="g3p-personalizar">
              <p className="g3-chico g3-tenue">Arrastra para cambiar el orden dentro de cada grupo. El ojo oculta o muestra un panel.</p>
              <div className="g3-grupo">
                {ocultos.size > 0 && <button type="button" className="g3-btn g3-btn--ch" onClick={mostrarTodos}><Eye size={16} aria-hidden="true" />Mostrar todos</button>}
                <button type="button" className="g3-btn g3-btn--ch" onClick={ordenOriginal}><RotateCcw size={16} aria-hidden="true" />Orden original</button>
                <button type="button" className="g3-btn g3-btn--ch g3-btn--primario" onClick={() => setEditando(false)}><Check size={16} aria-hidden="true" />Listo</button>
              </div>
            </div>
          ) : (
            <button type="button" className="g3-riel-item" onClick={() => setEditando(true)}>
              <SlidersHorizontal size={20} aria-hidden="true" />
              <span className="g3p-riel-texto">Personalizar menú</span>
            </button>
          )}
          <Link to="/perfil" className="g3-riel-item g3p-perfil" aria-current={pathname === '/perfil' ? 'page' : undefined}>
            <span className="g3-avatar" aria-hidden="true">{iniciales(user?.nombre)}</span>
            <span className="g3p-riel-texto">{user?.nombre || 'Mi perfil'}<small>Ver perfil y cerrar sesión</small></span>
          </Link>
        </div>
      </aside>
      {abierto && <div className="g3-velo g3p-velo" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <div className="g3-columna">
        <header className="g3-barra g3p-barra">
          <button type="button" className="g3-btn-icono g3p-solo-movil" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-controls="g3p-riel" aria-expanded={abierto}>
            <Menu size={22} aria-hidden="true" />
          </button>
          {/* En celular, el cuadro 3G como en los demás sistemas (g3-logo--movil solo se ve ≤ 860 px) */}
          <Link to="/inventario" className="g3-logo g3-logo--movil" aria-label="Planta, inicio">
            <span className="g3-logo-marca" aria-hidden="true">3G</span>
          </Link>
          <h1 className="g3-barra-titulo" data-g3-titulo>{titulo}</h1>
          <div className="g3-barra-acciones">
            <BotonTema />
            <div className="g3p-avisos-campana"><NotificacionesDropdown /></div>
            <SelectorApps />
            {/* Sesión (patrón común g3-sesion): avatar siempre a la vista, también en celular; el nombre solo en escritorio */}
            <Link to="/perfil" className="g3-sesion" aria-label={`Mi perfil y cerrar sesión: ${user?.nombre || ''}`} title="Mi perfil">
              <span className="g3-avatar" aria-hidden="true">{iniciales(user?.nombre)}</span>
              <span className="g3-sesion-nombre">{(user?.nombre || 'Mi perfil').replace(/\s*\(.*$/, '').split(/\s+/)[0]}</span>
            </Link>
          </div>
        </header>

        {pestanas.length > 1 && (
          <nav ref={pestanasRef} className="g3-pestanas g3p-pestanas" aria-label={`Secciones de ${SECCIONES[seccion].titulo.toLowerCase()}`}>
            {pestanas.map((p) => {
              const Icono = p.icono;
              return (
                <Link key={p.path} to={p.path} aria-current={pathname === p.path ? 'page' : undefined}>
                  {Icono && <Icono size={16} aria-hidden="true" />}
                  {p.etiqueta}
                </Link>
              );
            })}
          </nav>
        )}

        <main className="g3p-principal g3-zona">
          <Outlet />
        </main>
      </div>

      <nav className="g3-barra-inferior g3p-barra-inferior" aria-label="Accesos rápidos">
        {inferiores.map((it) => {
          const Icono = it.icono;
          return (
            <Link key={it.clave} to={it.destino} aria-current={activo(it) ? 'page' : undefined}>
              <Icono size={22} aria-hidden="true" />
              <span>{it.corto}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setAbierto(true)} aria-controls="g3p-riel" aria-expanded={abierto}>
          <MoreHorizontal size={22} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
