// Panel de calidad: ¿está encendido para este usuario? Pregunta UNA vez por sesión a /api/calidad/yo (solo si el rol es
// administrador o almacén, los que pueden verlo). 404 (PANEL_CALIDAD apagada) o cualquier error = apagado: no se pinta nada
// de calidad y todo se ve como hoy. Avisa al menú (marcarPanelCalidad) para que «Tabletas de calidad» salga en el riel.
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { yoCalidad } from '../../services/calidad.service';
import { marcarPanelCalidad } from '../../diseno-3g/menuPlanta';

export const ROLES_CALIDAD = ['administrador', 'almacen'];

let usuarioConsultado;
let consulta = null;
let resultado = null;

/** La consulta compartida (una por usuario mientras la página esté abierta). */
export function leerPanelCalidad(userId) {
  if (usuarioConsultado !== userId) { usuarioConsultado = userId; consulta = null; resultado = null; }
  if (!consulta) {
    consulta = yoCalidad()
      .then((d) => ({ activo: true, banderas: d.banderas || {}, version: d.version || null }))
      .catch(() => ({ activo: false }))
      .then((r) => { resultado = r; marcarPanelCalidad(r.activo); return r; });
  }
  return consulta;
}

/** { activo, cargando, banderas: { avalCierra, defectoReabre } } */
export function usePanelCalidad() {
  const { user } = useAuth();
  const puede = !!user && ROLES_CALIDAD.includes(user.rol);
  const [estado, setEstado] = useState(() => (puede && resultado && usuarioConsultado === user?.id ? resultado : { activo: false, cargando: puede }));
  useEffect(() => {
    if (!puede) { setEstado({ activo: false, cargando: false }); return undefined; }
    let vivo = true;
    leerPanelCalidad(user.id).then((r) => { if (vivo) setEstado(r); });
    return () => { vivo = false; };
  }, [puede, user?.id]);
  return estado;
}
