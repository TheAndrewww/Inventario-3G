// Rediseño 2 · Piso · título de un grupo en las TV (Atrasadas / Esta semana / Después, o Falla / Por instalar).
// La tabla de la fundación pone junto al título cuántos renglones del grupo caben en ESTA página; con páginas que
// cambian solas eso confundía («Después 6» en la página 1, «Después 4» en la 2, y arriba «9 después»). Aquí el número
// es el total del grupo (el mismo de las cifras del encabezado) y, si el grupo empezó en la página anterior, lo dice.
// La cuenta automática de la tabla se esconde en piso.css (solo dentro de .r2-pi-tv). Los datos del título los arma
// gruposDePagina() de obrasPiso.js. No pide nada.
export function TituloGrupoTv({ titulo, total, sigue = false }) {
  return (
    <>
      {titulo}
      <span className="r2-pi-tv-grupo-total">{total}</span>
      {sigue && <span className="r2-pi-tv-grupo-sigue">continúa de la página anterior</span>}
    </>
  );
}

