// Rediseño 2 · fundación: todo lo común se importa de aquí.
//   import { useDiseno3G, Pagina, EncabezadoPagina, TiraCifras, BarraFiltros, Tabla, Cajon, Estado, Fecha, dinero } from '../fundacion';
// API de cada pieza: comentario al inicio de su archivo y Plataforma-3G/rediseno-2/planta/fundacion/REPORTE.md.
// Reglas: CSS solo bajo :root[data-diseno="3g"] (r2.css, r2-piso.css), clases r2-*, sin clases de color/tamaño de letra/
// radio/sombra de Tailwind en las vistas nuevas; ninguna pieza pide datos por su cuenta.

// Interruptor y formatos
export { useDiseno3G, useTemaR2, useAnchoR2, useEsCelular, leerDiseno3G, leerTemaR2 } from './useDiseno3G';
export * from './formato';
export { VOCABULARIO, estadoDe, tipoTrabajo, AREAS } from './vocabulario';
export { useCapa } from './useCapa';

// Armazón (lo monta DashboardLayout; las páginas no lo usan directo)
export { default as Armazon } from './armazon/Armazon';
export { EsqueletoArmazon } from './armazon/EsqueletoArmazon';
export { AvisosFlotantes } from './armazon/AvisosFlotantes';
export { PanelAvisos } from './armazon/PanelAvisos';
export { tituloDeRutaR2, pestanasDeRuta, inicioDeRol } from './armazon/menuR2';

// Piezas de oficina
export { Pagina } from './piezas/Pagina';
export { EncabezadoPagina } from './piezas/EncabezadoPagina';
export { TiraCifras } from './piezas/TiraCifras';
export { BarraFiltros, Busqueda, FiltroMenu, ChipFiltro, QuitarFiltros } from './piezas/BarraFiltros';
export { Tabla } from './piezas/Tabla';
export { Lista, GrupoLista, FilaLista } from './piezas/FilaLista';
export { Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon, CajonPie } from './piezas/Cajon';
export { Dialogo } from './piezas/Dialogo';
export { Pestanas, Segmentado } from './piezas/Pestanas';
export { Estado, TipoTrabajo, Plazo } from './piezas/Estado';
export { Fecha } from './piezas/Fecha';
export { Cargando, Vacio, ErrorCarga } from './piezas/Estados';
export { Boton, BotonIcono } from './piezas/Boton';
export { MenuAcciones } from './piezas/MenuAcciones';
export { BarraAccion } from './piezas/BarraAccion';
export { Campo, Entrada, Selector, SelectorBuscable, Area, Casilla, Interruptor } from './piezas/Campos';
export { Cantidad } from './piezas/Cantidad';
export { Datos, LineaTiempo, Mensaje } from './piezas/Datos';
export { Miniatura, IndicadorPistola, ZonaHeredada } from './piezas/Miniatura';
export { Pila, Fila, Seccion, Nota } from './piezas/Ayudas';
export { confirmarG3, pedirTextoG3, avisoG3, g3Activo } from './piezas/dialogos';

// Piezas de piso (TV y terminal)
export { MarcoTv, TablaTv, CeldaTv, ObraTv, PaginasTv, ControlesTv, HoraDeDatos } from './piso/Tv';
export { MarcoTerminal, FilaPiso, BotonPiso, BotonTerminar, CampoCodigo, VisorPlano } from './piso/Terminal';
export { useTemaPiso, usePaginasAuto, useHoraDeDatos } from './piso/usePiso';
