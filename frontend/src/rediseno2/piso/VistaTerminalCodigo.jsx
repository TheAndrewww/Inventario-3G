// Rediseño 2 · Piso · Terminal: código del área (/terminal y /terminal/<área> sin código guardado), vista encendida.
// Antes: tarjeta flotante con candado, ejemplo «XXX-0000» y «Ingresar» morado; el error en letra roja de 16 px.
// Ahora: una sola columna, sin tarjeta: de qué área es la terminal, el campo grande (80 px, letra de 36 px), «Entrar a
// Manufactura» de 80 px y, si la liga trae un área, «Cambiar de área» como acción secundaria. El error se queda en una
// caja bajo el campo (código equivocado, demasiados intentos, sin internet), como hoy. Mismo formulario y mismo
// manejador (handleSubmit de la página): la misma petición validar-codigo y el mismo guardado del código.
import { Lock, LogIn } from 'lucide-react';
import { MarcoTerminal, CampoCodigo, BotonPiso, useTemaPiso, AREAS } from '../fundacion';
import './piso.css';

export default function VistaTerminalCodigo({
  area, nombreArea, codigo, alCambiarCodigo, alEnviar, cargando, error, alCambiarArea,
}) {
  const tema = useTemaPiso('terminal');
  const datosArea = area ? AREAS[area] : null;
  const vacio = !codigo.trim();
  return (
    <MarcoTerminal tema={tema} encabezado={false} className="r2-pi-terminal">
      <div className="r2-pi-codigo">
        <header className="r2-pi-codigo-cab">
          <span className="r2-pi-codigo-area">
            {datosArea
              ? <span className="r2-piso-punto" style={{ background: datosArea.color }} aria-hidden="true" />
              : <Lock size={24} aria-hidden="true" />}
            <h1 className="r2-pi-codigo-titulo">{nombreArea ? `Terminal de ${nombreArea}` : 'Terminal de producción'}</h1>
          </span>
          <p className="r2-pi-codigo-sub">
            {nombreArea ? `Escribe el código de ${nombreArea}. Se queda guardado en esta pantalla.` : 'Escribe el código de tu área. Se queda guardado en esta pantalla.'}
          </p>
        </header>

        <form className="r2-pi-codigo-form" onSubmit={alEnviar} noValidate>
          <CampoCodigo
            valor={codigo}
            alCambiar={(v) => alCambiarCodigo(String(v).slice(0, 20))}
            etiqueta="Código del área"
            ayuda="Tal como te lo dio tu encargado, con sus guiones."
            error={error || undefined}
          />
          <BotonPiso
            type="submit"
            nivel="principal"
            alto={80}
            anchoCompleto
            icono={LogIn}
            cargando={cargando}
            deshabilitado={cargando || vacio}
            motivo={vacio ? 'Escribe el código para entrar' : undefined}
          >
            {cargando ? 'Revisando el código…' : nombreArea ? `Entrar a ${nombreArea}` : 'Entrar'}
          </BotonPiso>
          {vacio && !cargando && <p className="r2-terminar-ayuda" aria-live="polite">Escribe el código para entrar.</p>}
          {alCambiarArea && (
            <BotonPiso nivel="fantasma" className="r2-pi-codigo-otra" alHacer={alCambiarArea}>Cambiar de área</BotonPiso>
          )}
        </form>

        <p className="r2-pi-codigo-pie"><span className="g3-logo-marca" aria-hidden="true">3G</span>3G Velarias · Sistema de producción</p>
      </div>
    </MarcoTerminal>
  );
}
