// Rediseño 2 · esqueleto del armazón mientras se revisa la sesión (PrivateRoute encendido), en lugar de la rueda.
// No necesita al usuario: riel y barra vacíos con la forma real y una tabla de esqueleto.
import { Cargando } from '../piezas/Estados';

export function EsqueletoArmazon() {
  return (
    <div className="r2-marco r2-marco--esqueleto" aria-busy="true">
      <aside className="r2-riel" aria-hidden="true">
        <div className="r2-riel-cab"><span className="g3-logo"><span className="g3-logo-marca">3G</span></span></div>
        <div className="r2-riel-grupos">
          {[70, 55, 62, 48, 66, 52, 58].map((a, i) => (
            <span key={i} className="r2-riel-item r2-riel-item--hueso"><span className="r2-hueso" style={{ width: `${a}%` }} /></span>
          ))}
        </div>
      </aside>
      <div className="r2-columna">
        <header className="r2-barra" aria-hidden="true"><span className="r2-hueso" style={{ width: 120 }} /></header>
        <main className="r2-contenido">
          <div className="r2-pagina r2-pagina--completo">
            <div className="r2-encabezado"><div className="r2-encabezado-fila"><span className="r2-hueso r2-hueso--titulo" style={{ width: 260 }} /></div></div>
            <Cargando forma="tabla" columnas={5} filas={8} etiqueta="Revisando tu sesión…" />
          </div>
        </main>
      </div>
    </div>
  );
}
