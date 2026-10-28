// Rediseño 2 · armazón encendido (DISENO-v2 §3.1 y §5.0). Lo monta DashboardLayout solo con el diseño encendido
// (apagado sigue el de siempre). Mismas rutas y mismos permisos (todo sale de ALL_MENU_ITEMS por medio de menuR2).
//
// - Riel por áreas (264 px; 72 px de 861 a 1200 px; cajón «Más» en celular), Compras y Tickets como una sola entrada.
// - Barra superior de 56 px con el área (escritorio) o el nombre de la pantalla (celular).
// - Barra inferior por rol en celular.
// - Las pantallas que ya son vista nueva empiezan con <Pagina> y avisan aquí: su zona de contenido va limpia. Las que todavía
//   no se rediseñan se ven como hoy encendido (zona heredada g3-zona) y, si son de Tickets o Compras, el armazón les pinta
//   sus pestañas de sección para que no se pierda la navegación.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { ContextoArmazon } from '../contexto';
import { Riel } from './Riel';
import { BarraSuperior } from './BarraSuperior';
import { BarraInferior } from './BarraInferior';
import {
  rielR2, areaDeRuta, tituloDeRutaR2, inferiorR2, inicioDeRol, pestanasDeRuta,
  claveOcultosG3, claveOrdenG3, guardarSubOrdenG3, EVENTO_SUBORDEN_G3, heredarAjustesDelMenu, EVENTO_PANEL_CALIDAD,
} from './menuR2';
import { usePanelCalidad } from '../../calidad/usePanelCalidad';
import { MENU_GRUPOS } from '../../../components/layout/Sidebar';
import { clases } from '../formato';

const leerJSON = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export default function Armazon() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { user, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  // La primera vez se heredan los paneles ocultos y el orden del menú de siempre (una vez por usuario y navegador)
  const [ocultos, setOcultos] = useState(() => { heredarAjustesDelMenu(user?.id); return new Set(leerJSON(claveOcultosG3(user?.id), [])); });
  const [orden, setOrden] = useState(() => leerJSON(claveOrdenG3(user?.id), []));
  const [versionSub, setVersionSub] = useState(0);
  const [paginas, setPaginas] = useState([]);
  const arrastre = useRef(null);

  useEffect(() => { heredarAjustesDelMenu(user?.id); setOcultos(new Set(leerJSON(claveOcultosG3(user?.id), []))); setOrden(leerJSON(claveOrdenG3(user?.id), [])); }, [user?.id]);
  useEffect(() => {
    const alCambiar = () => setVersionSub((v) => v + 1);
    window.addEventListener(EVENTO_SUBORDEN_G3, alCambiar);
    // 28-oct · el panel de calidad se enciende o apaga: «Tabletas de calidad» entra o sale del riel
    window.addEventListener(EVENTO_PANEL_CALIDAD, alCambiar);
    return () => {
      window.removeEventListener(EVENTO_SUBORDEN_G3, alCambiar);
      window.removeEventListener(EVENTO_PANEL_CALIDAD, alCambiar);
    };
  }, []);
  // Pregunta una vez si el panel de calidad está encendido (solo administración y almacén; apagado no cambia nada)
  usePanelCalidad();
  useEffect(() => { setAbierto(false); }, [pathname]);

  // Las vistas nuevas (<Pagina>) se registran aquí
  const registrarPagina = useCallback((titulo) => {
    const marca = { titulo };
    setPaginas((p) => [...p, marca]);
    return () => setPaginas((p) => p.filter((x) => x !== marca));
  }, []);
  const contexto = useMemo(() => ({ usuario: user, registrarPagina }), [user, registrarPagina]);

  const grupos = useMemo(() => rielR2(user?.rol, user?.id, ocultos).map((g) => {
    const pos = (it) => { const i = orden.indexOf(it.clave); return i === -1 ? 999 : i; };
    return { ...g, items: [...g.items].sort((a, b) => pos(a) - pos(b) || g.items.indexOf(a) - g.items.indexOf(b)) };
  }), [user?.rol, user?.id, ocultos, orden, versionSub]); // eslint-disable-line react-hooks/exhaustive-deps

  const inicio = inicioDeRol(user?.rol);
  const area = areaDeRuta(grupos, pathname);
  const tituloPagina = paginas.length ? paginas[paginas.length - 1].titulo : null;
  const titulo = tituloPagina || tituloDeRutaR2(pathname);
  const destinos = inferiorR2(user?.rol, grupos);
  const heredada = paginas.length === 0;
  const seccion = heredada ? pestanasDeRuta(pathname, user?.rol, user?.id) : null;

  const alternarOculto = (clave) => setOcultos((prev) => {
    const n = new Set(prev);
    // Compras y Tickets son una sola entrada, pero también se ven ocultas cuando lo están todas las pestañas que el rol ve
    // (así las deja la herencia del menú de siempre: Compras guarda las cinco y Tickets, si el rol solo ve una o dos, esas
    // rutas). «Mostrar» la destapa completa; si no, el ojo no la podría regresar.
    const seccion = (clave === 'compras' || clave === 'tickets') && grupos.flatMap((g) => g.items).find((it) => it.clave === clave);
    if (seccion && seccion.oculto) { n.delete(clave); seccion.rutas.forEach((r) => n.delete(r)); }
    else if (n.has(clave)) n.delete(clave); else n.add(clave);
    guardarJSON(claveOcultosG3(user?.id), [...n]);
    return n;
  });
  const mostrarTodos = () => { guardarJSON(claveOcultosG3(user?.id), null); setOcultos(new Set()); };
  const ordenOriginal = () => { guardarJSON(claveOrdenG3(user?.id), null); setOrden([]); guardarSubOrdenG3(user?.id, 'compras', null); };
  const alArrastrar = (e, grupo, clave) => {
    arrastre.current = { grupo, clave };
    try { e.dataTransfer.setData('text/plain', clave); } catch { /* nada */ }
  };
  const alSoltar = (grupo, destino) => {
    const origen = arrastre.current;
    arrastre.current = null;
    if (!origen || origen.grupo !== grupo.id || origen.clave === destino) return;
    const claves = grupo.items.map((i) => i.clave);
    const [movida] = claves.splice(claves.indexOf(origen.clave), 1);
    claves.splice(claves.indexOf(destino), 0, movida);
    if (grupo.id === 'compras:sub') {
      // Orden de las pestañas de Compras, en la clave propia del diseño nuevo (la misma de hoy encendido)
      guardarSubOrdenG3(user?.id, 'compras', [...claves, ...MENU_GRUPOS.compras.orden.filter((p) => !claves.includes(p))]);
      return;
    }
    const nuevo = [...orden.filter((c) => !claves.includes(c)), ...claves];
    guardarJSON(claveOrdenG3(user?.id), nuevo);
    setOrden(nuevo);
  };
  // Cerrar sesión desde el cajón «Más» (lo mismo que hace Mi perfil)
  const cerrarSesion = () => {
    logout();
    toast.success('Sesión cerrada correctamente');
    navegar('/login');
  };

  return (
    <ContextoArmazon.Provider value={contexto}>
      <div className="r2-marco">
        <a href="#r2-contenido" className="r2-saltar">Saltar al contenido</a>
        <Riel grupos={grupos} rutaActual={pathname} usuario={user} inicio={inicio}
          abierto={abierto} alAbrir={() => setAbierto(true)} alCerrar={() => { setAbierto(false); setEditando(false); }}
          editando={editando} alEditar={() => setEditando(true)} alTerminarEdicion={() => setEditando(false)}
          alternarOculto={alternarOculto} mostrarTodos={mostrarTodos} ordenOriginal={ordenOriginal} hayOcultos={ocultos.size > 0}
          alArrastrar={alArrastrar} alSoltar={alSoltar} alCerrarSesion={cerrarSesion} />
        <div className="r2-columna">
          <BarraSuperior area={area} titulo={titulo} usuario={user} inicio={inicio} />
          {heredada && seccion?.pestanas.length > 1 && (
            <nav className="r2-pestanas r2-pestanas--heredadas" aria-label={`Pantallas de ${seccion.titulo.toLowerCase()}`}>
              {seccion.pestanas.map((p) => (
                <Link key={p.ruta} to={p.ruta} className="r2-pestana" aria-current={p.activa ? 'page' : undefined}>{p.texto}</Link>
              ))}
            </nav>
          )}
          <main id="r2-contenido" tabIndex={-1} className={clases('r2-contenido', heredada && 'g3-zona r2-contenido--heredado')}>
            <Outlet />
          </main>
        </div>
        <BarraInferior destinos={destinos} rutaActual={pathname} masAbierto={abierto} alMas={() => setAbierto(true)} />
      </div>
    </ContextoArmazon.Provider>
  );
}
