// Rediseño 2 · barra inferior del celular (≤ 860 px), 5 lugares: los 4 destinos que más usa ESE rol + «Más» (abre el riel
// como cajón). Etiquetas de una palabra. Usa la barra del paquete (g3-barra-inferior), que también avisa a las barras fijas
// de acción cuánto subir (--g3-espacio-inferior).
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

export function BarraInferior({ destinos, rutaActual, masAbierto, alMas }) {
  return (
    <nav className="g3-barra-inferior r2-barra-inferior" aria-label="Accesos rápidos">
      {destinos.map((d) => {
        const Icono = d.icono;
        return (
          <Link key={d.clave} to={d.destino} aria-current={d.rutas.includes(rutaActual) ? 'page' : undefined}>
            <Icono size={22} aria-hidden="true" />
            <span>{d.texto}</span>
          </Link>
        );
      })}
      <button type="button" onClick={alMas} aria-controls="r2-riel" aria-expanded={masAbierto}>
        <MoreHorizontal size={22} aria-hidden="true" />
        <span>Más</span>
      </button>
    </nav>
  );
}
