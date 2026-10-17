// Rediseño 2 · barra superior (DISENO-v2 §3.1), 56 px, vidrio, pegada arriba.
// Escritorio: a la izquierda el ÁREA (Almacén, Compras, Producción…) que orienta al desplazar; a la derecha campana, tema,
// selector de apps (sin el interruptor) y sesión. El título grande vive en el encabezado de la página.
// Celular (≤ 860 px): logo chico + NOMBRE DE LA PANTALLA (17 px) + campana + avatar; tema y apps pasan al cajón «Más».
import { Link } from 'react-router-dom';
import NotificacionesDropdown from '../../../components/common/NotificacionesDropdown';
import { BotonTema, SelectorApps } from './Riel';
import { iniciales } from '../formato';

export function BarraSuperior({ area, titulo, usuario, inicio }) {
  const nombreCorto = (usuario?.nombre || 'Mi perfil').replace(/\s*\(.*$/, '').split(/\s+/)[0];
  return (
    <header className="r2-barra">
      <Link to={inicio} className="g3-logo r2-barra-logo r2-solo-movil" aria-label="Planta, inicio">
        <span className="g3-logo-marca" aria-hidden="true">3G</span>
      </Link>
      <p className="r2-barra-area r2-solo-ancho">{area}</p>
      <p className="r2-barra-titulo r2-solo-movil">{titulo}</p>
      <div className="r2-barra-acciones">
        <NotificacionesDropdown />
        <span className="r2-solo-ancho r2-barra-grupo">
          <BotonTema />
          <SelectorApps />
        </span>
        <Link to="/perfil" className="g3-sesion r2-sesion" aria-label={`Mi perfil: ${usuario?.nombre || ''}`} title="Mi perfil">
          <span className="g3-avatar" aria-hidden="true">{iniciales(usuario?.nombre)}</span>
          <span className="g3-sesion-nombre r2-solo-ancho">{nombreCorto}</span>
        </Link>
      </div>
    </header>
  );
}
