// Rediseño 2 · panel de avisos (la campana) (DISENO-v2 §4.17). Lo pinta components/common/NotificacionesDropdown.jsx
// cuando el diseño está encendido, con SUS MISMOS datos y manejadores (mismas peticiones y mismo sondeo del contexto).
// Escritorio: panel de 400 px bajo la barra. Celular: hoja completa. Lista con título, mensaje, hace cuánto,
// «Marcar como leída», «Eliminar» en «⋯», «Marcar todas como leídas», «Ver todas», «Activar notificaciones push» y el sonido.
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useCapa } from '../useCapa';
import { Boton } from '../piezas/Boton';
import { MenuAcciones } from '../piezas/MenuAcciones';
import { Vacio } from '../piezas/Estados';
import { Fecha } from '../piezas/Fecha';
import { Interruptor } from '../piezas/Campos';
import { clases, plural } from '../formato';

export function PanelAvisos({
  abierto, alAlternar, alCerrar, avisos = [], noLeidos = 0, alAbrirAviso, alMarcarLeido, alMarcarTodos, alEliminar,
  pedirPush, mostrarPush, mostrarFcm, mostrarSonido, sonido, alSonido,
}) {
  const ref = useRef(null);
  useCapa({ abierta: abierto, ref, alCerrar });
  const etiqueta = noLeidos ? `Avisos, ${plural(noLeidos, 'sin leer', 'sin leer')}` : 'Avisos';
  return (
    <span className="r2-campana">
      <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma r2-campana-boton"
        aria-label={etiqueta} title="Avisos" aria-expanded={abierto} aria-haspopup="dialog" onClick={alAlternar}>
        <Bell size={20} aria-hidden="true" />
        {noLeidos > 0 && <span className="r2-campana-cuenta" aria-hidden="true">{noLeidos > 9 ? '9+' : noLeidos}</span>}
      </button>
      {abierto && createPortal(
        <div className="r2-capa r2-capa--avisos">
          <div className="r2-velo r2-velo--avisos" onClick={alCerrar} aria-hidden="true" />
          <div ref={ref} className="r2-panel-avisos" role="dialog" aria-modal="true" aria-label="Avisos">
            <div className="r2-panel-avisos-cab">
              <h2 className="r2-cajon-titulo" tabIndex={-1} data-r2-foco="">Avisos{noLeidos > 0 && <span className="r2-panel-avisos-dato">{plural(noLeidos, 'sin leer', 'sin leer')}</span>}</h2>
              <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma" aria-label="Cerrar avisos" onClick={alCerrar}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {noLeidos > 0 && (
              <div className="r2-panel-avisos-barra">
                <Boton nivel="fantasma" tamano="chico" icono={CheckCheck} alHacer={alMarcarTodos}>Marcar todas como leídas</Boton>
              </div>
            )}

            {mostrarPush && (
              <div className="r2-panel-avisos-nota">
                <BellRing size={20} aria-hidden="true" />
                <div>
                  <p className="r2-panel-avisos-nota-titulo">Activa las notificaciones push</p>
                  <p className="r2-nota">Recibe alertas de pedidos, órdenes y más, aunque no tengas Planta abierta.</p>
                </div>
                <Boton nivel="tonal" tamano="chico" alHacer={pedirPush}>Activar notificaciones</Boton>
              </div>
            )}
            {mostrarFcm && (
              <div className="r2-panel-avisos-nota">
                <BellRing size={20} aria-hidden="true" />
                <div>
                  <p className="r2-panel-avisos-nota-titulo">Registra este equipo</p>
                  <p className="r2-nota">Para recibir notificaciones push en tiempo real.</p>
                </div>
                <Boton nivel="tonal" tamano="chico" alHacer={pedirPush}>Activar notificaciones push</Boton>
              </div>
            )}
            {mostrarSonido && (
              <div className="r2-panel-avisos-sonido">
                <Interruptor activo={sonido} alCambiar={alSonido} texto="Sonido de notificaciones" />
              </div>
            )}

            <div className="r2-panel-avisos-lista">
              {avisos.length === 0 ? (
                <Vacio icono={Bell} titulo="No tienes avisos" texto="Aquí llegan las solicitudes, órdenes y tickets que te tocan." />
              ) : (
                <ul className="r2-lista">
                  {avisos.map((n) => (
                    <li key={n.id} className={clases('r2-aviso', !n.leida && 'r2-aviso--nuevo')}>
                      <button type="button" className="r2-aviso-objetivo" onClick={() => alAbrirAviso(n)}>
                        <span className="r2-aviso-marca" aria-hidden="true" />
                        <span className="r2-aviso-cuerpo">
                          <span className="r2-aviso-titulo">{n.titulo}{!n.leida && <span className="r2-solo-lectores"> (sin leer)</span>}</span>
                          {n.mensaje && <span className="r2-aviso-mensaje">{n.mensaje}</span>}
                          <span className="r2-aviso-fecha"><Fecha valor={n.created_at} /></span>
                        </span>
                      </button>
                      <span className="r2-aviso-acciones">
                        {!n.leida && (
                          <button type="button" className="r2-boton-icono r2-boton-icono--chico r2-boton-icono--fantasma" aria-label={`Marcar como leída: ${n.titulo}`}
                            title="Marcar como leída" onClick={(e) => alMarcarLeido(e, n.id)}>
                            <Check size={16} aria-hidden="true" />
                          </button>
                        )}
                        <MenuAcciones tamano="chico" titulo={n.titulo}
                          acciones={[{ texto: 'Eliminar', icono: Trash2, peligro: true, alHacer: (e) => alEliminar(e, n.id) }]} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {avisos.length > 0 && (
              <div className="r2-panel-avisos-pie">
                <Boton nivel="fantasma" anchoCompleto>Ver todas las notificaciones</Boton>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
