// Rediseño 2 · Piso · los avisos flotantes de siempre (react-hot-toast) en las pantallas de piso.
// Mismos toast.success / toast.error de las páginas; solo cambia cómo se ven: letra de 22 px para leerse de pie a
// 50–70 cm, sin emojis, arriba al centro (donde los pone hoy la terminal). Las páginas públicas no montan el aviso
// común de la app, por eso cada pantalla de piso pinta el suyo (como hoy).
import { Toaster } from 'react-hot-toast';

export function AvisosPiso({ posicion = 'top-center', duracion = 3000 }) {
  return (
    <Toaster
      position={posicion}
      containerClassName="r2-pi-avisos"
      toastOptions={{
        duration: duracion,
        className: 'r2-pi-aviso',
        success: { className: 'r2-pi-aviso r2-pi-aviso--ok' },
        error: { className: 'r2-pi-aviso r2-pi-aviso--mal' },
      }}
    />
  );
}
