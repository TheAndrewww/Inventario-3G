// Rediseño 2 · avisos flotantes de siempre (react-hot-toast) con el diseño nuevo (DISENO-v2 §4.15): abajo a la izquierda en
// escritorio, encima de la barra inferior en celular, 14 px y con su tono. Mismos toast.success / toast.error de las
// pantallas: solo cambia dónde y cómo se ven. App.jsx lo pinta en lugar del <Toaster> de siempre cuando está encendido.
import { Toaster } from 'react-hot-toast';

export function AvisosFlotantes() {
  return (
    <Toaster
      position="bottom-left"
      containerClassName="r2-avisos-flotantes"
      containerStyle={{ bottom: 'calc(16px + var(--g3-espacio-inferior, 0px))', left: 16, right: 16 }}
      toastOptions={{
        duration: 3000,
        className: 'r2-aviso-flotante',
        success: { className: 'r2-aviso-flotante r2-aviso-flotante--ok', iconTheme: { primary: 'var(--r2-flotante-ok)', secondary: 'var(--g3-flotante-fondo)' } },
        error: { className: 'r2-aviso-flotante r2-aviso-flotante--mal', iconTheme: { primary: 'var(--r2-flotante-mal)', secondary: 'var(--g3-flotante-fondo)' } },
      }}
    />
  );
}
