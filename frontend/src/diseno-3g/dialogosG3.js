// Diseño 3G — confirmaciones y avisos de las pantallas: G3.confirmar (vista previa con «Qué va a pasar», armada SOLO con
// datos que la pantalla ya tiene), G3.aviso y un cajón con un campo en lugar de prompt(). La acción que sigue es la de
// siempre; todo lo que se manda se lee ANTES de abrir el diálogo. (La rama con el confirm()/alert()/prompt() del navegador
// en cada pantalla se borró el 7-nov-2026.)
export const confirmarG3 = (opciones) => window.G3.confirmar(opciones);
export const avisoG3 = (texto, tipo = 'info') => window.G3.aviso(texto, { tipo });

// prompt() → cajón con un campo (solo encendido; apagado la pantalla sigue con su prompt() de siempre).
// Devuelve EXACTAMENTE lo que devolvería prompt(): el texto escrito tal cual (sin recortar, aunque quede vacío) al
// confirmar, o null al regresar, cerrar o pulsar Esc. La pantalla sigue con SU MISMA validación después; el cajón no
// valida, no bloquea el botón y no pide nada al servidor.
//   op: { titulo, texto, aviso, peligro, datos: [[etq, valor]], etiqueta, ayuda, valor, multilinea, modoTeclado,
//         confirmar, cancelar }
export const pedirTextoG3 = (op = {}) => new Promise((listo) => {
  const G3 = window.G3;
  const d = document.createElement('dialog');
  if (typeof d.showModal !== 'function' || !G3) {
    listo(window.prompt([op.titulo, op.texto, op.etiqueta].filter(Boolean).join('\n\n'), op.valor == null ? '' : String(op.valor)));
    return;
  }
  const nodo = (tag, clase, texto) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = String(texto);
    return n;
  };
  const id = `g3p-texto-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  d.className = 'g3-cajon g3p-cajon-texto';
  d.setAttribute('aria-labelledby', `${id}-t`);

  const cab = nodo('div', 'g3-cajon-cab');
  const h = nodo('h2', '', op.titulo || 'Escribe para continuar');
  h.id = `${id}-t`;
  const x = nodo('button', 'g3-btn-icono');
  x.type = 'button';
  x.setAttribute('aria-label', 'Cerrar sin continuar');
  x.innerHTML = G3.icono('cerrar');
  cab.append(h, x);

  const cuerpo = nodo('div', 'g3-cajon-cuerpo g3-previa');
  if (op.aviso) {
    const caja = nodo('div', `g3-caja ${op.peligro ? 'g3-caja--mal' : 'g3-caja--aviso'}`);
    caja.innerHTML = G3.icono('alerta');
    caja.appendChild(nodo('div', 'g3-caja-cuerpo', op.aviso));
    cuerpo.appendChild(caja);
  }
  if (op.texto) cuerpo.appendChild(nodo('p', 'g3-tenue', op.texto));
  if (op.datos && op.datos.length) {
    const dl = nodo('dl', 'g3-datos');
    op.datos.forEach(([e, v]) => { dl.append(nodo('dt', '', e), nodo('dd', '', v)); });
    cuerpo.appendChild(dl);
  }
  const campo = nodo('div', 'g3-campo');
  const etq = nodo('label', 'g3-etq', op.etiqueta || 'Escribe aquí');
  etq.setAttribute('for', `${id}-c`);
  const entrada = op.multilinea ? nodo('textarea', 'g3-area') : nodo('input', 'g3-entrada');
  entrada.id = `${id}-c`;
  if (!op.multilinea) entrada.type = 'text';
  if (op.multilinea) entrada.rows = 3;
  entrada.autocomplete = 'off';
  if (op.modoTeclado) entrada.inputMode = op.modoTeclado;
  entrada.value = op.valor == null ? '' : String(op.valor);
  campo.append(etq, entrada);
  if (op.ayuda) {
    const ayuda = nodo('p', 'g3-ayuda', op.ayuda);
    ayuda.id = `${id}-a`;
    entrada.setAttribute('aria-describedby', ayuda.id);
    campo.appendChild(ayuda);
  }
  cuerpo.appendChild(campo);

  const pie = nodo('div', 'g3-cajon-pie');
  const no = nodo('button', 'g3-btn g3-btn--fantasma', op.cancelar || 'Regresar');
  no.type = 'button';
  const si = nodo('button', `g3-btn ${op.peligro ? 'g3-btn--peligro-lleno' : 'g3-btn--primario'}`);
  si.type = 'button';
  si.innerHTML = G3.icono('palomita', { tamano: 18 });
  si.appendChild(document.createTextNode(op.confirmar || 'Continuar'));
  pie.append(no, si);
  d.append(cab, cuerpo, pie);

  let valor = null;
  const confirmar = () => { valor = entrada.value; d.close('si'); };
  x.addEventListener('click', () => d.close('no'));
  no.addEventListener('click', () => d.close('no'));
  si.addEventListener('click', confirmar);
  // Enter confirma en una sola línea (como prompt()); en varias líneas, Ctrl/Cmd + Enter.
  entrada.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (op.multilinea && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    confirmar();
  });
  d.addEventListener('close', () => { listo(d.returnValue === 'si' ? valor : null); d.remove(); });
  (document.body || document.documentElement).appendChild(d);
  d.showModal();
  entrada.focus();
  if (!op.multilinea && entrada.value) entrada.select();
});
