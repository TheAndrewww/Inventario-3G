/*! Diseño 3G v1.1.0 — diseno-3g.js (sin dependencias, sin CDN)
   API (window.G3):
     G3.activo()                      → true si html[data-diseno="3g"]
     G3.aplicar()                     → lee ?diseno=3g|actual y localStorage('diseno-3g') y pone/quita el atributo
                                        (en una ruta excluida lo quita siempre; llámalo al cambiar de ruta en una SPA)
     G3.excluida()                    → true si esta página no lleva Diseño 3G (data-g3-excluir o window.G3_RUTAS_SIN_DISENO)
     G3.configurar({urls})            → completa en tiempo de ejecución las direcciones privadas (operacion, entregas,
                                        finanzas, admin-sitio, inicio). Solo desde páginas CON sesión. Ver DESIGN.md §14.
     G3.encender({recargar}) / G3.apagar({recargar}) / G3.alternar({recargar})   (recargar: true por omisión)
     G3.tema('auto'|'claro'|'oscuro'|null) / G3.tema() / G3.esOscuro()
     G3.alCambiar(fn)                 → fn({activo, tema}); devuelve la función para dejar de escuchar
     G3.selectorApps(contenedor, {actual, interruptor, nuevaPestana, sistemas})  → {abrir, cerrar, alternar, destruir}
     G3.interruptor(contenedor, {etiqueta, compacto, bloque, recargar})          → {destruir}
     G3.aviso(texto, {tipo:'info'|'ok'|'aviso'|'mal', duracion, accion:{texto, alHacer}, alCerrar}) → {cerrar}
     G3.confirmar({titulo, texto, aviso, antes, despues, datos, cambios, pasa, firma, escribir,
                   confirmar, cancelar, peligro}) → Promise<boolean>   (vista previa → confirmar)
     G3.abrir(el|selector) / G3.cerrar(el|selector)   (cajones y diálogos; también data-g3-abre="#id" y data-g3-cierra)
     G3.icono(nombre, {tamano, clase, grosor}) → '<svg…>'   G3.iconos → nombres   G3.pintarIconos(raiz)
     G3.urlCon(url)                   → agrega ?diseno=3g si está encendido (para pasar de un sistema a otro)
     G3.sistemas                      → mismos datos que sistemas.json (las privadas llegan con url null + sensible true)
     G3.fragmentoHead                 → <style> + <script> cortos para pegar en <head> (sin parpadeo; .g3-si oculto
                                        aunque no cargue el CSS; respeta las rutas excluidas)
     G3.fragmentoPartes               → {css, js}: lo mismo por separado (Next.js: <style> y <script> con dangerouslySetInnerHTML)
   Íconos: Lucide (licencia ISC), copiados en línea. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = null;
    return;
  }
  if (window.G3 && window.G3.version) {
    if (typeof module === 'object' && module.exports) module.exports = window.G3;
    return;
  }

  var VERSION = '1.1.0';
  var CLAVE = 'diseno-3g';
  var CLAVE_TEMA = 'diseno-3g-tema';
  var RAIZ = document.documentElement;
  var FUENTES_URL = 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap';
  /* Una sola línea y sin comillas dobles dentro: hay sistemas que comparan su copia contra este texto. */
  var FRAGMENTO = "<style>:root:not([data-diseno='3g']) .g3-si{display:none!important}</style><script>(function(d,k){try{var x=d.hasAttribute('data-g3-excluir'),r=window.G3_RUTAS_SIN_DISENO||[],p=location.pathname,i,s;for(i=0;i<r.length&&!x;i++){s=r[i];x=s instanceof RegExp?s.test(p):(s=String(s),s.slice(-1)==='/'&&(s=s.slice(0,-1)),p===s||p.indexOf(s+'/')===0)}if(x){d.removeAttribute('data-diseno');return}var q=new URLSearchParams(location.search).get('diseno');if(q==='3g'||q==='actual')localStorage.setItem(k,q);else q=localStorage.getItem(k);if(q==='3g'){d.setAttribute('data-diseno','3g');var t=localStorage.getItem(k+'-tema');if(/^(auto|claro|oscuro)$/.test(t))d.setAttribute('data-g3-tema',t)}else if(q==='actual')d.removeAttribute('data-diseno')}catch(e){}})(document.documentElement,'diseno-3g')<\/script>";
  var PARTES = FRAGMENTO.match(/^<style>(.*)<\/style><script>(.*)<\/script>$/);

  /* Mismo contenido que sistemas.json.
     url null + sensible true = dirección privada: NO se escribe aquí (este archivo se sirve sin sesión en varios
     sistemas). La completa G3.configurar({urls}) desde una página con sesión; sin ella, el selector dice
     «Ábrela desde Inicio 3G». url null sin sensible = todavía no tiene dirección («Pronto»). */
  var SISTEMAS = [
    { id: 'inicio', nombre: 'Inicio 3G', descripcion: 'Todas las apps y los pendientes del día', icono: 'inicio', color: '#c4122f', degradado: ['#e0405a', '#b0102a'], url: null, sistema_clave: null },
    { id: 'ventas', nombre: 'Ventas', descripcion: 'Plataforma de asesores: leads, conversaciones y cotizaciones', icono: 'ventas', color: '#1f5fd1', degradado: ['#4f8df5', '#1f5fd1'], url: 'https://frontend-red-five-17.vercel.app', sistema_clave: 'asesores' },
    { id: 'operacion', nombre: 'Operación', descripcion: 'Pedidos, obras, calendario y avisos', icono: 'operacion', color: '#0b7d86', degradado: ['#20b8a8', '#0b7d86'], url: null, sensible: true, sistema_clave: 'operaciones' },
    { id: 'entregas', nombre: 'Entregas', descripcion: 'App de supervisores: entrega en obra, check y carta', icono: 'entregas', color: '#188a4c', degradado: ['#3fc27a', '#188a4c'], url: null, sensible: true, sistema_clave: 'operaciones' },
    { id: 'planta', nombre: 'Planta', descripcion: 'Inventario, tickets de material, compras y producción', icono: 'planta', color: '#e07a10', degradado: ['#ffad42', '#e07a10'], url: 'https://inventario-3-g.vercel.app', sistema_clave: 'inventario' },
    { id: 'finanzas', nombre: 'Finanzas', descripcion: 'Cobros, pagos, facturas y gastos', icono: 'finanzas', color: '#157347', degradado: ['#38c172', '#157347'], url: null, sensible: true, sistema_clave: 'contable' },
    { id: 'admin-sitio', nombre: 'Administrador del sitio', descripcion: 'Contenido de la página web, campañas y contactos', icono: 'admin-sitio', color: '#4250d6', degradado: ['#6b7cff', '#4250d6'], url: null, sensible: true, sistema_clave: 'web-y-otros' },
    { id: 'sitio', nombre: 'Sitio web', descripcion: 'www.3gvelarias.com, la página pública', icono: 'sitio', color: '#6b3fbf', degradado: ['#a77bff', '#6b3fbf'], url: 'https://www.3gvelarias.com', sistema_clave: 'web-y-otros' }
  ];

  /* Íconos (cuerpo del SVG de 24×24, trazo). Lucide, ISC. */
  var ICONOS = {
    inicio: "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
    ventas: "<path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\"/><path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\"/><path d=\"M8 6v8\"/>",
    operacion: "<path d=\"M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5\"/><path d=\"M14 6a6 6 0 0 1 6 6v3\"/><path d=\"M4 15v-3a6 6 0 0 1 6-6\"/><rect x=\"2\" y=\"15\" width=\"20\" height=\"4\" rx=\"1\"/>",
    entregas: "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"/><path d=\"M15 18H9\"/><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/>",
    planta: "<path d=\"M12 16h.01\"/><path d=\"M16 16h.01\"/><path d=\"M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z\"/><path d=\"M8 16h.01\"/>",
    finanzas: "<path d=\"M10 18v-7\"/><path d=\"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z\"/><path d=\"M14 18v-7\"/><path d=\"M18 18v-7\"/><path d=\"M3 22h18\"/><path d=\"M6 18v-7\"/>",
    "admin-sitio": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"M9 21V9\"/>",
    sitio: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>",
    apps: "<circle cx=\"12\" cy=\"5\" r=\"1\"/><circle cx=\"19\" cy=\"5\" r=\"1\"/><circle cx=\"5\" cy=\"5\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"19\" r=\"1\"/><circle cx=\"19\" cy=\"19\" r=\"1\"/><circle cx=\"5\" cy=\"19\" r=\"1\"/>",
    buscar: "<path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/>",
    cerrar: "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
    palomita: "<path d=\"M20 6 9 17l-5-5\"/>",
    mas: "<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>",
    menu: "<path d=\"M4 5h16\"/><path d=\"M4 12h16\"/><path d=\"M4 19h16\"/>",
    "flecha-der": "<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>",
    "flecha-izq": "<path d=\"m12 19-7-7 7-7\"/><path d=\"M19 12H5\"/>",
    "chevron-der": "<path d=\"m9 18 6-6-6-6\"/>",
    "chevron-abajo": "<path d=\"m6 9 6 6 6-6\"/>",
    alerta: "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
    info: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
    ok: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m9 12 2 2 4-4\"/>",
    error: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"/><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"/>",
    campana: "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"/><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/>",
    filtro: "<path d=\"M2 5h20\"/><path d=\"M6 12h12\"/><path d=\"M9 19h6\"/>",
    descargar: "<path d=\"M12 15V3\"/><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"m7 10 5 5 5-5\"/>",
    subir: "<path d=\"M12 3v12\"/><path d=\"m17 8-5-5-5 5\"/><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>",
    editar: "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/>",
    borrar: "<path d=\"M10 11v6\"/><path d=\"M14 11v6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M3 6h18\"/><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
    calendario: "<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/>",
    usuario: "<circle cx=\"12\" cy=\"8\" r=\"5\"/><path d=\"M20 21a8 8 0 0 0-16 0\"/>",
    ajustes: "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    sol: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
    luna: "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
    deshacer: "<path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/>",
    copiar: "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/>",
    externo: "<path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>",
    bandeja: "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\"/><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\"/>",
    "mas-acciones": "<circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/>",
    reloj: "<path d=\"M12 6v6l4 2\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
    paquete: "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/>",
    documento: "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>",
    foto: "<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>",
    telefono: "<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\"/>",
    mensaje: "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"/>",
    ubicacion: "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
    refrescar: "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
    ojo: "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    dinero: "<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M6 12h.01M18 12h.01\"/>",
    candado: "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
    tablero: "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/>",
    lista: "<path d=\"M3 5h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 19h.01\"/><path d=\"M8 5h13\"/><path d=\"M8 12h13\"/><path d=\"M8 19h13\"/>",
    guardar: "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"/><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"/><path d=\"M7 3v4a1 1 0 0 0 1 1h7\"/>",
    imprimir: "<path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\"/>",
    enlace: "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    estrella: "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>"
  };

  /* ---------------------------------------------------------------- utilidades */
  function leer(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: solo esta vez */ } }
  function borrar(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nada */ } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function resolver(el) { return typeof el === 'string' ? document.querySelector(el) : el; }
  function deUrl() {
    try {
      var v = new URLSearchParams(window.location.search).get('diseno');
      return v === '3g' || v === 'actual' ? v : null;
    } catch (e) { return null; }
  }
  var contador = 0;

  /* ---------------------------------------------------------------- interruptor (estado) */
  function activo() { return RAIZ.getAttribute('data-diseno') === '3g'; }

  function aplicarTema() {
    var t = leer(CLAVE_TEMA);
    if (t === 'auto' || t === 'claro' || t === 'oscuro') RAIZ.setAttribute('data-g3-tema', t);
  }

  function cargarFuentes() {
    var cfg = window.G3_CONFIG || {};
    if (cfg.fuentes === false || RAIZ.hasAttribute('data-g3-sin-fuentes')) return;
    if (document.getElementById('g3-fuentes')) return;
    var l = document.createElement('link');
    l.id = 'g3-fuentes';
    l.rel = 'stylesheet';
    l.href = cfg.fuentesUrl || FUENTES_URL;
    (document.head || RAIZ).appendChild(l);
  }

  /* Rutas excluidas (TV, terminal, anuncios…): nunca llevan el atributo ni piden fuentes. Misma regla que el
     fragmento: <html data-g3-excluir> o window.G3_RUTAS_SIN_DISENO = ['/tv', '/terminal', /^\/anuncios/] (un texto
     vale para esa ruta y todo lo que cuelga de ella; una RegExp se prueba contra location.pathname). */
  function excluida() {
    if (RAIZ.hasAttribute('data-g3-excluir')) return true;
    var r = window.G3_RUTAS_SIN_DISENO, p = window.location.pathname;
    if (!r || !r.length) return false;
    for (var i = 0; i < r.length; i++) {
      var x = r[i];
      if (x instanceof RegExp) { if (x.test(p)) return true; continue; }
      x = String(x);
      if (x.slice(-1) === '/') x = x.slice(0, -1); /* igual que el fragmento: '/tv/' = '/tv' */
      if (p === x || p.indexOf(x + '/') === 0) return true;
    }
    return false;
  }

  function aplicar() {
    var antes = activo();
    if (excluida()) {
      RAIZ.removeAttribute('data-diseno');
    } else {
      var v = deUrl();
      if (v) guardar(CLAVE, v); else v = leer(CLAVE);
      if (v === '3g') RAIZ.setAttribute('data-diseno', '3g');
      else if (v === 'actual') RAIZ.removeAttribute('data-diseno');
      if (activo()) { aplicarTema(); cargarFuentes(); }
    }
    if (antes !== activo()) emitir();
    return activo();
  }

  function tema(valor) {
    if (valor === undefined) return RAIZ.getAttribute('data-g3-tema');
    if (valor === null) { borrar(CLAVE_TEMA); RAIZ.removeAttribute('data-g3-tema'); emitir(); return null; }
    if (valor !== 'auto' && valor !== 'claro' && valor !== 'oscuro') throw new Error('G3.tema: usa "auto", "claro", "oscuro" o null');
    guardar(CLAVE_TEMA, valor);
    RAIZ.setAttribute('data-g3-tema', valor);
    emitir();
    return valor;
  }
  function esOscuro() {
    try { return /dark/.test(window.getComputedStyle(RAIZ).colorScheme || ''); } catch (e) { return false; }
  }

  function emitir() {
    try { window.dispatchEvent(new CustomEvent('g3:diseno', { detail: { activo: activo(), tema: tema() } })); } catch (e) { /* navegador viejo */ }
  }
  function alCambiar(fn) {
    function h(e) { fn(e.detail); }
    window.addEventListener('g3:diseno', h);
    return function () { window.removeEventListener('g3:diseno', h); };
  }

  function recargar() {
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.has('diseno')) { u.searchParams.delete('diseno'); window.location.replace(u.toString()); return; }
    } catch (e) { /* sigue */ }
    window.location.reload();
  }
  function encender(op) {
    guardar(CLAVE, '3g');
    if (excluida()) { emitir(); return; } /* se guarda para las demás pantallas; esta se queda como siempre */
    RAIZ.setAttribute('data-diseno', '3g');
    aplicarTema();
    cargarFuentes();
    emitir();
    if (!op || op.recargar !== false) recargar();
  }
  function apagar(op) {
    guardar(CLAVE, 'actual');
    RAIZ.removeAttribute('data-diseno');
    emitir();
    if (!op || op.recargar !== false) recargar();
  }
  function alternar(op) { if (activo()) apagar(op); else encender(op); }

  function urlCon(url) {
    if (!url || url === '#' || !activo()) return url;
    try { var u = new URL(url, window.location.href); u.searchParams.set('diseno', '3g'); return u.toString(); } catch (e) { return url; }
  }

  /* ---------------------------------------------------------------- G3.configurar (direcciones privadas) */
  var versionSistemas = 0;
  function limpiarUrl(v) {
    if (v == null || v === '' || v === '#') return null;
    try {
      var u = new URL(String(v), window.location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
    } catch (e) { return null; }
  }
  /* G3.configurar({ urls: { operacion, entregas, finanzas, 'admin-sitio', inicio } })
     Completa (o borra con null) la url de cada sistema en G3.sistemas. Solo acepta http(s); un id que no existe se ignora.
     Llámalo desde un archivo que solo se sirva CON sesión (nunca desde el JS público de una SPA). Devuelve los ids cambiados. */
  function configurar(op) {
    op = op || {};
    var urls = op.urls || {}, cambiados = [];
    SISTEMAS.forEach(function (s) {
      if (!Object.prototype.hasOwnProperty.call(urls, s.id)) return;
      var u = limpiarUrl(urls[s.id]);
      if (u !== s.url) { s.url = u; cambiados.push(s.id); }
    });
    if (cambiados.length) {
      versionSistemas++;
      try { window.dispatchEvent(new CustomEvent('g3:sistemas', { detail: { cambiados: cambiados } })); } catch (e) { /* navegador viejo */ }
    }
    return cambiados;
  }

  /* ---------------------------------------------------------------- íconos */
  function icono(nombre, op) {
    op = op || {};
    var cuerpo = ICONOS[nombre];
    if (!cuerpo) return '';
    var t = op.tamano || 20;
    return '<svg class="g3-icono' + (op.clase ? ' ' + esc(op.clase) : '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + t + '" height="' + t +
      '" fill="none" stroke="currentColor" stroke-width="' + (op.grosor || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + cuerpo + '</svg>';
  }
  /* Cambia <i data-g3-icono="buscar"></i> por el SVG (conserva clases y aria-label). Solo para HTML hecho a mano; en React usa lucide-react. */
  function pintarIconos(raiz) {
    var lista = (raiz || document).querySelectorAll('[data-g3-icono]');
    Array.prototype.forEach.call(lista, function (el) {
      var t = parseInt(el.getAttribute('data-g3-tamano'), 10) || 20;
      var svg = icono(el.getAttribute('data-g3-icono'), { tamano: t, clase: el.getAttribute('class') || '' });
      if (!svg) return;
      var caja = document.createElement('span');
      caja.innerHTML = svg;
      var nodo = caja.firstChild;
      var etq = el.getAttribute('aria-label');
      if (etq) { nodo.removeAttribute('aria-hidden'); nodo.setAttribute('role', 'img'); nodo.setAttribute('aria-label', etq); }
      el.parentNode.replaceChild(nodo, el);
    });
  }

  /* ---------------------------------------------------------------- estilos de los widgets (Shadow DOM: no chocan con el CSS del sistema) */
  var CSS_COMUN =
    ':host{all:initial;' +
    '--s:var(--g3-superficie,#fff);--t:var(--g3-tinta,#1f1f1f);--t2:var(--g3-tinta-2,#5e5e5e);--c:var(--g3-contenedor,#efefef);' +
    '--ca:var(--g3-contenedor-alto,#e5e5e5);--l:var(--g3-linea,#e3e3e3);--lc:var(--g3-linea-campo,#8f8f8f);' +
    '--p:var(--g3-primario,#0e4e92);--ps:var(--g3-primario-suave,#d6e4f5);--sps:var(--g3-sobre-primario-suave,#062448);' +
    '--h:var(--g3-hover,rgba(0,0,0,.05));--f:var(--g3-foco,rgba(14,78,146,.6));' +
    '--v:var(--g3-vidrio-fuerte,rgba(255,255,255,.9));--vb:var(--g3-vidrio-borde,rgba(255,255,255,.6));' +
    '--sh:var(--g3-sombra-3,0 8px 24px rgba(0,0,0,.12),0 24px 60px rgba(0,0,0,.14));' +
    '--ft:var(--g3-f-titulo,"Outfit",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);' +
    'font-family:var(--g3-f-texto,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);' +
    'color:var(--t);-webkit-font-smoothing:antialiased;line-height:1.4}' +
    '*,*::before,*::after{box-sizing:border-box}svg{display:block;flex:none}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';

  var CSS_BOTON =
    ':host{display:inline-flex;vertical-align:middle}' +
    '.b{display:inline-grid;place-items:center;width:40px;height:40px;padding:0;margin:0;border:0;border-radius:999px;background:transparent;color:var(--t2);cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.b:hover{background:var(--ca);color:var(--t)}.b[aria-expanded="true"]{background:var(--ps);color:var(--sps)}' +
    '.b:focus-visible{outline:3px solid var(--f);outline-offset:2px}';

  var CSS_PANEL =
    '.p{position:fixed;z-index:2147483000;width:336px;overflow:auto;padding:14px 12px 12px;border:1px solid var(--vb);border-radius:28px;' +
    'background:var(--v);-webkit-backdrop-filter:blur(24px) saturate(1.7);backdrop-filter:blur(24px) saturate(1.7);box-shadow:var(--sh);' +
    'color:var(--t);font-size:14px;animation:ap .18s cubic-bezier(.2,.8,.2,1)}' +
    '.p[hidden]{display:none}.p:focus{outline:none}' +
    '.cab{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:2px 8px 10px}.cab b{font:600 16px/1.2 var(--ft)}' +
    '.rej{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}' +
    '.app{display:grid;justify-items:center;align-content:start;gap:6px;min-height:100px;padding:10px 4px 8px;border-radius:16px;color:var(--t);text-decoration:none;text-align:center;cursor:pointer}' +
    'a.app:hover{background:var(--h)}.app:focus-visible{outline:3px solid var(--f);outline-offset:-1px}' +
    '.ico{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 4px 10px rgba(0,0,0,.14)}' +
    '.nom{font-size:13px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}' +
    '.nota{font-size:12px;font-weight:600;line-height:1.2;color:var(--t2)}' +
    '.app[aria-current="page"]{background:var(--ps);color:var(--sps)}.app[aria-current="page"] .nota{color:var(--sps)}' +
    '.app[aria-disabled="true"]{cursor:default}.app[aria-disabled="true"] .ico{opacity:.55}' +
    '.pie{margin-top:10px;padding-top:8px;border-top:1px solid var(--l)}' +
    '@keyframes ap{from{opacity:0;transform:translateY(-4px) scale(.97)}}' +
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.p{background:var(--s)}}';

  var CSS_INTERRUPTOR =
    '.i{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:8px 10px;border:0;border-radius:14px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.i:hover{background:var(--h)}.i:focus-visible{outline:3px solid var(--f);outline-offset:2px}' +
    '.tx{display:grid;gap:1px;min-width:0;flex:1}.tx b{font-size:14px;font-weight:600;line-height:1.25}.tx small{font-size:12px;line-height:1.3;color:var(--t2)}' +
    '.pista{position:relative;flex:none;width:46px;height:28px;border-radius:999px;background:var(--ca);box-shadow:inset 0 0 0 1px var(--lc);transition:background-color .2s}' +
    '.pista::after{content:"";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:transform .2s cubic-bezier(.2,.8,.2,1)}' +
    '.i[aria-checked="true"] .pista{background:var(--p);box-shadow:none}.i[aria-checked="true"] .pista::after{transform:translateX(18px)}';

  var CSS_AVISO =
    '.pila{position:fixed;left:24px;bottom:24px;z-index:2147483001;display:grid;gap:8px;width:min(440px,calc(100vw - 32px));pointer-events:none}' +
    '@media (max-width:860px){.pila{left:16px;right:16px;width:auto}}' +
    '.a{display:flex;align-items:center;gap:10px;padding:10px 6px 10px 14px;border-radius:14px;pointer-events:auto;' +
    'background:var(--g3-flotante-fondo,#2b2b2b);color:var(--g3-flotante-tinta,#f2f2f2);box-shadow:var(--sh);font-size:14px;font-weight:500;line-height:1.4;' +
    'animation:sube .25s cubic-bezier(.2,.8,.2,1);transition:opacity .2s,transform .2s}' +
    '.a.sale{opacity:0;transform:translateY(8px)}.ic{width:20px;height:20px}.t{flex:1;min-width:0;padding:4px 0}' +
    '.acc,.x{flex:none;min-height:36px;margin:0;border:0;border-radius:999px;background:transparent;cursor:pointer;font:inherit}' +
    '.acc{padding:0 12px;color:var(--g3-flotante-accion,#9cc3f0);font-size:13px;font-weight:700}' +
    '.x{display:grid;place-items:center;width:36px;color:inherit;opacity:.85}' +
    '.acc:hover,.x:hover{background:rgba(128,128,128,.2);opacity:1}' +
    '.acc:focus-visible,.x:focus-visible{outline:3px solid var(--g3-flotante-accion,#9cc3f0);outline-offset:1px}' +
    '@keyframes sube{from{opacity:0;transform:translateY(12px)}}';

  function crearHost(contenedor, nombre) {
    var c = resolver(contenedor);
    if (!c || !c.attachShadow) return null;
    var h = document.createElement('span');
    h.setAttribute('data-g3-widget', nombre);
    c.appendChild(h);
    return { host: h, raiz: h.attachShadow({ mode: 'open' }) };
  }

  function textoEstado() {
    return activo() ? 'Encendido: vista nueva en prueba' : 'Apagado: se ve como siempre';
  }
  function htmlInterruptor(op) {
    op = op || {};
    return '<button type="button" class="i" role="switch" aria-checked="' + activo() + '" aria-labelledby="g3i-t"' + (op.compacto ? '' : ' aria-describedby="g3i-d"') + '>' +
      '<span class="tx"><b id="g3i-t">' + esc(op.etiqueta || 'Diseño 3G') + '</b>' + (op.compacto ? '' : '<small id="g3i-d">' + esc(textoEstado()) + '</small>') + '</span>' +
      '<span class="pista" aria-hidden="true"></span></button>';
  }
  function enlazarInterruptor(raiz, op) {
    var b = raiz.querySelector('.i');
    if (!b) return function () {};
    b.addEventListener('click', function () {
      if (activo()) apagar({ recargar: !op || op.recargar !== false }); else encender({ recargar: !op || op.recargar !== false });
    });
    return alCambiar(function () {
      b.setAttribute('aria-checked', String(activo()));
      var d = raiz.querySelector('#g3i-d');
      if (d) d.textContent = textoEstado();
    });
  }

  /* ---------------------------------------------------------------- G3.interruptor */
  function interruptor(contenedor, op) {
    op = op || {};
    var w = crearHost(contenedor, 'interruptor');
    if (!w) return null;
    w.raiz.innerHTML = '<style>' + CSS_COMUN + CSS_INTERRUPTOR + ':host{display:' + (op.bloque ? 'block' : 'inline-block') + ';vertical-align:middle}</style>' + htmlInterruptor(op);
    var quitar = enlazarInterruptor(w.raiz, op);
    return { destruir: function () { quitar(); w.host.remove(); } };
  }

  /* ---------------------------------------------------------------- G3.selectorApps (botón de 9 puntos) */
  function selectorApps(contenedor, op) {
    op = op || {};
    var w = crearHost(contenedor, 'selector-apps');
    if (!w) return null;
    var lista = op.sistemas || SISTEMAS;
    w.raiz.innerHTML = '<style>' + CSS_COMUN + CSS_BOTON + '</style>' +
      '<button type="button" class="b" aria-haspopup="dialog" aria-expanded="false" aria-label="Apps de 3G" title="Apps de 3G">' + icono('apps', { tamano: 24 }) + '</button>';
    var boton = w.raiz.querySelector('.b');
    var capa = null, raizPanel = null, panel = null, abierto = false, quitarInt = null, armadoCon = -1;

    function construir() {
      armadoCon = versionSistemas;
      capa = document.createElement('div');
      capa.setAttribute('data-g3-widget', 'apps');
      raizPanel = capa.attachShadow({ mode: 'open' });
      var h = '<style>' + CSS_COMUN + CSS_PANEL + CSS_INTERRUPTOR + '</style>' +
        '<div class="p" role="dialog" aria-labelledby="g3a-t" tabindex="-1" hidden><div class="cab"><b id="g3a-t">Apps de 3G</b></div><ul class="rej">';
      lista.forEach(function (s) {
        var es = s.id === op.actual;
        var sinUrl = !s.url || s.url === '#';
        /* Sin dirección: privada (sensible) → «Ábrela desde Inicio 3G»; sin dirección todavía → «Pronto». Nunca un enlace roto. */
        var nota = es ? 'Estás aquí' : !sinUrl ? '' : s.sensible ? 'Ábrela desde Inicio 3G' : 'Pronto';
        var fondo = s.degradado ? 'linear-gradient(160deg,' + s.degradado[0] + ',' + s.degradado[1] + ')' : (s.color || '#5e5e5e');
        var dentro = '<span class="ico" style="background:' + esc(fondo) + '">' + icono(s.icono, { tamano: 24 }) + '</span>' +
          '<span class="nom">' + esc(s.nombre) + '</span>' +
          (nota ? '<span class="nota">' + esc(nota) + '</span>' : '');
        h += '<li>' + (sinUrl
          ? (es
            ? '<span class="app" aria-current="page" title="' + esc(s.descripcion) + '">' + dentro + '</span>'
            : '<span class="app" aria-disabled="true" title="' + esc(s.descripcion + (nota ? '. ' + nota + '.' : '')) + '">' + dentro + '</span>')
          : '<a class="app" href="' + esc(urlCon(s.url)) + '" title="' + esc(s.descripcion) + '"' + (es ? ' aria-current="page"' : '') +
            (op.nuevaPestana && !es ? ' target="_blank" rel="noopener"' : '') + '>' + dentro + '</a>') + '</li>';
      });
      h += '</ul>' + (op.interruptor === false ? '' : '<div class="pie">' + htmlInterruptor() + '</div>') + '</div>';
      raizPanel.innerHTML = h;
      panel = raizPanel.querySelector('.p');
      quitarInt = enlazarInterruptor(raizPanel, {});
      panel.addEventListener('keydown', teclado);
      (document.body || RAIZ).appendChild(capa);
    }
    function enfocables() { return Array.prototype.slice.call(panel.querySelectorAll('a.app, button')); }
    function posicionar() {
      if (!abierto) return;
      var r = boton.getBoundingClientRect();
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var vh = window.innerHeight;
      var ancho = Math.min(336, vw - 24);
      var izq = Math.max(12, Math.min(r.right - ancho, vw - ancho - 12));
      panel.style.width = ancho + 'px';
      panel.style.left = izq + 'px';
      panel.style.maxHeight = '';
      var alto = panel.offsetHeight;
      var abajo = vh - r.bottom - 20, arriba = r.top - 20;
      if (alto > abajo && arriba > abajo) {
        var maxA = Math.max(200, arriba);
        panel.style.maxHeight = maxA + 'px';
        panel.style.top = Math.max(12, r.top - 8 - Math.min(alto, maxA)) + 'px';
      } else {
        panel.style.top = (r.bottom + 8) + 'px';
        panel.style.maxHeight = Math.max(200, abajo) + 'px';
      }
    }
    function fuera(e) {
      var camino = e.composedPath ? e.composedPath() : [];
      if (camino.indexOf(capa) === -1 && camino.indexOf(w.host) === -1) cerrar(false);
    }
    function teclado(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(true); return; }
      var f = enfocables();
      var i = f.indexOf(raizPanel.activeElement);
      if (e.key === 'Tab' && f.length) {
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      var apps = Array.prototype.slice.call(panel.querySelectorAll('a.app'));
      var j = apps.indexOf(raizPanel.activeElement);
      if (j === -1) return;
      var paso = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
      if (!paso) return;
      e.preventDefault();
      var k = Math.max(0, Math.min(apps.length - 1, j + paso));
      apps[k].focus();
    }
    function abrir() {
      if (abierto) return;
      if (capa && armadoCon !== versionSistemas) { if (quitarInt) quitarInt(); capa.remove(); capa = null; }
      if (!capa) construir();
      abierto = true;
      panel.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
      posicionar();
      var foco = panel.querySelector('a.app[aria-current="page"]') || panel.querySelector('a.app') || panel;
      foco.focus();
      document.addEventListener('pointerdown', fuera, true);
      window.addEventListener('resize', posicionar);
      window.addEventListener('scroll', posicionar, true);
    }
    function cerrar(devolverFoco) {
      if (!abierto) return;
      abierto = false;
      panel.hidden = true;
      boton.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      if (devolverFoco) boton.focus();
    }
    boton.addEventListener('click', function () { if (abierto) cerrar(true); else abrir(); });
    return {
      abrir: abrir,
      cerrar: function () { cerrar(true); },
      alternar: function () { if (abierto) cerrar(true); else abrir(); },
      destruir: function () { cerrar(false); if (quitarInt) quitarInt(); if (capa) capa.remove(); w.host.remove(); }
    };
  }

  /* ---------------------------------------------------------------- G3.aviso (aviso flotante) */
  var pilaAvisos = null;
  function pila() {
    if (pilaAvisos && pilaAvisos.isConnected) return pilaAvisos;
    var capa = document.createElement('div');
    capa.setAttribute('data-g3-widget', 'avisos');
    var sr = capa.attachShadow({ mode: 'open' });
    sr.innerHTML = '<style>' + CSS_COMUN + CSS_AVISO + '</style><div class="pila" aria-live="polite" aria-relevant="additions"></div>';
    (document.body || RAIZ).appendChild(capa);
    pilaAvisos = sr.querySelector('.pila');
    return pilaAvisos;
  }
  function ajustarPila(p) {
    var base = window.innerWidth <= 860 ? 16 : 24, extra = 0;
    var bi = document.querySelector('.g3-barra-inferior');
    if (bi && window.getComputedStyle(bi).display !== 'none') extra = bi.getBoundingClientRect().height + 10;
    p.style.bottom = 'calc(' + (base + extra) + 'px + env(safe-area-inset-bottom, 0px))';
  }
  function aviso(texto, op) {
    if (typeof op === 'string') op = { tipo: op };
    op = op || {};
    var tipo = /^(ok|aviso|mal|info)$/.test(op.tipo) ? op.tipo : 'info';
    var recien = !pilaAvisos || !pilaAvisos.isConnected; /* la región viva debe existir antes del texto para que el lector lo anuncie */
    var p = pila();
    ajustarPila(p);
    var a = document.createElement('div');
    a.className = 'a a--' + tipo;
    if (tipo === 'mal') a.setAttribute('role', 'alert');
    a.innerHTML = icono({ ok: 'ok', aviso: 'alerta', mal: 'error', info: 'info' }[tipo], { clase: 'ic' }) + '<span class="t"></span>';
    a.querySelector('.t').textContent = String(texto == null ? '' : texto);
    var cerrado = false, reloj = null;
    var dur = op.duracion == null ? (op.accion ? 8000 : 5000) : op.duracion;
    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(reloj);
      a.classList.add('sale');
      setTimeout(function () { a.remove(); }, 220);
      if (typeof op.alCerrar === 'function') op.alCerrar();
    }
    if (op.accion && op.accion.texto) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'acc';
      bt.textContent = op.accion.texto;
      bt.addEventListener('click', function () {
        try { if (typeof op.accion.alHacer === 'function') op.accion.alHacer(); } finally { cerrar(); }
      });
      a.appendChild(bt);
    }
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.setAttribute('aria-label', 'Cerrar aviso');
    x.innerHTML = icono('cerrar', { tamano: 18 });
    x.addEventListener('click', cerrar);
    a.appendChild(x);
    function poner() { p.appendChild(a); while (p.children.length > 3) p.removeChild(p.firstElementChild); }
    if (recien) setTimeout(poner, 60); else poner();
    function programar() { clearTimeout(reloj); if (dur > 0 && !cerrado) reloj = setTimeout(cerrar, dur); }
    function pausar() { clearTimeout(reloj); }
    a.addEventListener('mouseenter', pausar);
    a.addEventListener('mouseleave', programar);
    a.addEventListener('focusin', pausar);
    a.addEventListener('focusout', programar);
    programar();
    return { cerrar: cerrar };
  }

  /* ---------------------------------------------------------------- G3.abrir / G3.cerrar (cajón, diálogo, riel en celular) */
  var abiertos = [];
  function abrir(el, origen) {
    el = resolver(el);
    if (!el) return;
    el.__g3Origen = origen || document.activeElement;
    if (el.tagName === 'DIALOG' && typeof el.showModal === 'function') {
      if (!el.open) el.showModal();
      return;
    }
    if (el.classList.contains('g3-riel')) el.setAttribute('data-abierto', ''); else el.setAttribute('open', '');
    if (!el.__g3Velo) {
      var velo = document.createElement('div');
      velo.className = 'g3-velo';
      velo.addEventListener('click', function () { cerrar(el); });
      el.parentNode.insertBefore(velo, el);
      el.__g3Velo = velo;
    }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    var f = el.querySelector('[autofocus], a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
    (f || el).focus();
    if (abiertos.indexOf(el) === -1) abiertos.push(el);
  }
  function cerrar(el) {
    el = resolver(el);
    if (!el) return;
    if (el.tagName === 'DIALOG' && el.open) el.close();
    el.removeAttribute('data-abierto');
    if (el.tagName !== 'DIALOG') el.removeAttribute('open');
    if (el.__g3Velo) { el.__g3Velo.remove(); el.__g3Velo = null; }
    abiertos = abiertos.filter(function (x) { return x !== el; });
    var o = el.__g3Origen;
    el.__g3Origen = null;
    if (o && typeof o.focus === 'function' && document.contains(o)) o.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('[data-g3-abre]');
    if (a) {
      var destino = document.querySelector(a.getAttribute('data-g3-abre'));
      if (destino) { e.preventDefault(); abrir(destino, a); }
      return;
    }
    var c = t.closest('[data-g3-cierra]');
    if (c) {
      var cont = c.closest('dialog, .g3-cajon, .g3-dialogo, .g3-riel[data-abierto]');
      if (cont) { e.preventDefault(); cerrar(cont); }
      return;
    }
    /* Clic en el fondo de un cajón <dialog>: lo cierra (en un diálogo de confirmar, no). */
    if (t.tagName === 'DIALOG' && t.open && t.classList.contains('g3-cajon')) {
      var r = t.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar(t);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && abiertos.length) cerrar(abiertos[abiertos.length - 1]);
  });

  /* ---------------------------------------------------------------- G3.confirmar (vista previa → confirmar) */
  function nodo(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = String(texto);
    return n;
  }
  function confirmar(op) {
    op = op || {};
    return new Promise(function (listo) {
      var d = document.createElement('dialog');
      if (typeof d.showModal !== 'function') {
        listo(window.confirm((op.titulo || '¿Confirmas?') + (op.texto ? '\n\n' + op.texto : '')));
        return;
      }
      var id = 'g3-confirmar-' + (++contador);
      d.className = 'g3-dialogo' + (op.ancho ? ' g3-dialogo--ancho' : '');
      d.setAttribute('aria-labelledby', id);

      var cab = nodo('div', 'g3-cajon-cab');
      var h = nodo('h2', '', op.titulo || 'Revisa antes de confirmar');
      h.id = id;
      var x = nodo('button', 'g3-btn-icono');
      x.type = 'button';
      x.setAttribute('aria-label', 'Cerrar sin confirmar');
      x.innerHTML = icono('cerrar');
      cab.appendChild(h);
      cab.appendChild(x);

      var cuerpo = nodo('div', 'g3-cajon-cuerpo g3-previa');
      if (op.aviso) {
        var caja = nodo('div', 'g3-caja ' + (op.peligro ? 'g3-caja--mal' : 'g3-caja--aviso'));
        caja.innerHTML = icono('alerta');
        caja.appendChild(nodo('div', 'g3-caja-cuerpo', op.aviso));
        cuerpo.appendChild(caja);
      }
      if (op.texto) cuerpo.appendChild(nodo('p', 'g3-tenue', op.texto));
      if (op.antes && op.despues) {
        var ad = nodo('div', 'g3-antes-despues');
        [op.antes, op.despues].forEach(function (lado, k) {
          var col = nodo('div');
          col.appendChild(nodo('span', 'g3-valor', lado.valor));
          col.appendChild(nodo('small', '', lado.texto || (k ? 'Queda' : 'Hoy')));
          ad.appendChild(col);
          if (!k) ad.insertAdjacentHTML('beforeend', icono('flecha-der'));
        });
        cuerpo.appendChild(ad);
      }
      if (op.datos && op.datos.length) {
        var dl = nodo('dl', 'g3-datos');
        op.datos.forEach(function (fila) {
          var etq = Array.isArray(fila) ? fila[0] : fila.etq;
          var val = Array.isArray(fila) ? fila[1] : fila.valor;
          var tono = Array.isArray(fila) ? fila[2] : fila.tono;
          dl.appendChild(nodo('dt', '', etq));
          dl.appendChild(nodo('dd', tono === 'mal' ? 'g3-mal' : tono === 'ok' ? 'g3-ok' : '', val));
        });
        cuerpo.appendChild(dl);
      }
      if (op.cambios && op.cambios.length) {
        var ul = nodo('ul', 'g3-cambios');
        ul.setAttribute('aria-label', 'Cambios');
        op.cambios.forEach(function (c) {
          var li = nodo('li', 'g3-cambio');
          li.appendChild(nodo('b', '', c.campo));
          var del = nodo('del', '', c.antes == null || c.antes === '' ? '(vacío)' : c.antes);
          del.setAttribute('aria-label', 'Antes: ' + (c.antes || 'vacío'));
          li.appendChild(del);
          li.insertAdjacentHTML('beforeend', icono('flecha-der'));
          var ins = nodo('ins', '', c.despues == null || c.despues === '' ? '(vacío)' : c.despues);
          ins.setAttribute('aria-label', 'Después: ' + (c.despues || 'vacío'));
          li.appendChild(ins);
          ul.appendChild(li);
        });
        cuerpo.appendChild(ul);
      }
      if (op.pasa && op.pasa.length) {
        cuerpo.appendChild(nodo('h3', 'g3-subtitulo', 'Qué va a pasar'));
        var lp = nodo('ul', 'g3-pasa');
        op.pasa.forEach(function (t) { lp.appendChild(nodo('li', '', t)); });
        cuerpo.appendChild(lp);
      }
      if (op.firma) {
        var fi = nodo('p', 'g3-firma');
        fi.innerHTML = icono('editar');
        fi.appendChild(document.createTextNode(String(op.firma)));
        cuerpo.appendChild(fi);
      }
      var entrada = null;
      if (op.escribir) {
        var campo = nodo('div', 'g3-campo');
        var idE = id + '-e';
        var etq = nodo('label', 'g3-etq', 'Para confirmar escribe ' + op.escribir);
        etq.setAttribute('for', idE);
        entrada = nodo('input', 'g3-entrada');
        entrada.id = idE;
        entrada.autocomplete = 'off';
        campo.appendChild(etq);
        campo.appendChild(entrada);
        cuerpo.appendChild(campo);
      }

      var pie = nodo('div', 'g3-cajon-pie');
      var no = nodo('button', 'g3-btn g3-btn--fantasma', op.cancelar || 'Regresar');
      no.type = 'button';
      var si = nodo('button', 'g3-btn ' + (op.peligro ? 'g3-btn--peligro-lleno' : 'g3-btn--primario'), '');
      si.type = 'button';
      si.innerHTML = icono('palomita', { tamano: 18 });
      si.appendChild(document.createTextNode(op.confirmar || 'Confirmar'));
      pie.appendChild(no);
      pie.appendChild(si);
      if (entrada) {
        si.disabled = true;
        entrada.addEventListener('input', function () { si.disabled = entrada.value.trim() !== String(op.escribir); });
      }

      d.appendChild(cab);
      d.appendChild(cuerpo);
      d.appendChild(pie);
      x.addEventListener('click', function () { d.close('no'); });
      no.addEventListener('click', function () { d.close('no'); });
      si.addEventListener('click', function () { d.close('si'); });
      d.addEventListener('close', function () { listo(d.returnValue === 'si'); d.remove(); });
      (document.body || RAIZ).appendChild(d);
      d.showModal();
      (entrada || (op.peligro ? no : si)).focus();
    });
  }

  /* ---------------------------------------------------------------- arranque */
  if (window.G3_CONFIG && window.G3_CONFIG.urls) configurar({ urls: window.G3_CONFIG.urls });
  aplicar();
  function alListo() { pintarIconos(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alListo); else alListo();

  var G3 = {
    version: VERSION,
    sistemas: SISTEMAS,
    iconos: Object.keys(ICONOS),
    fragmentoHead: FRAGMENTO,
    fragmentoPartes: { css: PARTES[1], js: PARTES[2] },
    activo: activo,
    aplicar: aplicar,
    excluida: excluida,
    configurar: configurar,
    encender: encender,
    apagar: apagar,
    alternar: alternar,
    tema: tema,
    esOscuro: esOscuro,
    alCambiar: alCambiar,
    urlCon: urlCon,
    icono: icono,
    pintarIconos: pintarIconos,
    selectorApps: selectorApps,
    interruptor: interruptor,
    aviso: aviso,
    confirmar: confirmar,
    abrir: abrir,
    cerrar: cerrar
  };
  window.G3 = G3;
  if (typeof module === 'object' && module.exports) module.exports = G3;
})();
