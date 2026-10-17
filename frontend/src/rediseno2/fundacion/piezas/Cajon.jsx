// Rediseño 2 · ficha en cajón lateral (DISENO-v2 §4.6): el detalle o la decisión de una cosa sin perder la lista.
// Del lado derecho con velo (480 / 720 / 960 px); en celular sale de abajo y ocupa la pantalla (deja 16 px arriba).
// La DECISIÓN va arriba, pegada bajo la cabecera. Sin tarjetas dentro. Solo el cuerpo se desplaza.
//
// <Cajon abierto={!!orden} alCerrar={() => setOrden(null)} ancho="ancho" etiqueta={`Orden ${orden?.folio}`}>
//   <CajonCabecera titulo={orden.folio} dato={orden.proveedor} estado={<Estado dominio="orden" valor={orden.estado} />}
//     alCerrar={() => setOrden(null)} />
//   <CajonDecision>
//     <Boton nivel="principal" alHacer={aprobar}>Aprobar orden</Boton>
//     <Boton nivel="contorno" alHacer={rechazar}>Rechazar</Boton>
//     <MenuAcciones acciones={…} />
//   </CajonDecision>
//   <CajonCuerpo>
//     <SeccionCajon titulo="Datos"><Datos datos={[['Proveedor', orden.proveedor], ['Total', dinero(orden.total)]]} columnas={2} /></SeccionCajon>
//     <SeccionCajon titulo="Artículos"><Tabla densidad="compacta" … /></SeccionCajon>
//   </CajonCuerpo>
//   <CajonPie><Boton nivel="fantasma" alHacer={cerrar}>Cancelar</Boton><Boton nivel="principal" tipo="submit">Guardar artículo</Boton></CajonPie>
// </Cajon>
//
// Cajon: abierto, alCerrar, ancho ('normal' 480 | 'ancho' 720 | 'extra' 960), etiqueta (nombre para lectores),
// cambiosSinGuardar (Esc o el velo preguntan «¿Salir sin guardar?»), alEnviar (si se pasa, el cajón es un <form>).
// Esc y el velo cierran; el foco entra al título y regresa a lo que lo abrió. No pide nada al abrirse.
// Va en una capa normal (no en la capa superior del navegador) para que los avisos flotantes y los diálogos de siempre
// queden encima, como hoy.
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCapa } from '../useCapa';
import { confirmarG3 } from '../../../diseno-3g/dialogosG3';
import { clases } from '../formato';

async function puedeCerrar(cambiosSinGuardar) {
  if (!cambiosSinGuardar) return true;
  if (!window.G3) return true;
  return confirmarG3({
    titulo: '¿Salir sin guardar?', texto: 'Lo que escribiste en este formulario se pierde.',
    confirmar: 'Salir sin guardar', cancelar: 'Seguir editando', peligro: true,
  });
}

export function Cajon({ abierto, alCerrar, ancho = 'normal', etiqueta, cambiosSinGuardar = false, alEnviar, className, children }) {
  const ref = useRef(null);
  const intentarCerrar = async () => { if (await puedeCerrar(cambiosSinGuardar)) alCerrar?.(); };
  useCapa({ abierta: abierto, ref, alCerrar: intentarCerrar });
  if (!abierto) return null;
  const Hoja = alEnviar ? 'form' : 'div';
  return createPortal(
    <div className="r2-capa r2-capa--cajon">
      <div className="r2-velo" onClick={intentarCerrar} aria-hidden="true" />
      <Hoja ref={ref} className={clases('r2-cajon', `r2-cajon--${ancho}`, className)} role="dialog" aria-modal="true" aria-label={etiqueta}
        onSubmit={alEnviar ? (e) => { e.preventDefault(); alEnviar(e); } : undefined} noValidate={alEnviar ? true : undefined}>
        {children}
      </Hoja>
    </div>,
    document.body,
  );
}

export function CajonCabecera({ titulo, dato, estado, alCerrar, children }) {
  return (
    <div className="r2-cajon-cabecera">
      <div className="r2-cajon-titulos">
        <h2 className="r2-cajon-titulo" tabIndex={-1} data-r2-foco="">{titulo}</h2>
        {(dato || estado) && (
          <div className="r2-cajon-dato">
            {dato && <span>{dato}</span>}
            {estado}
          </div>
        )}
        {children}
      </div>
      {alCerrar && (
        <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma r2-cajon-cerrar" aria-label="Cerrar" title="Cerrar (Esc)" onClick={alCerrar}>
          <X size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// La decisión de esa cosa en ese estado y para ese rol. Si no hay nada que decidir, no se pinta.
export function CajonDecision({ children, nota }) {
  if (!children) return null;
  return (
    <div className="r2-cajon-decision">
      <div className="r2-cajon-decision-botones">{children}</div>
      {nota && <p className="r2-cajon-decision-nota">{nota}</p>}
    </div>
  );
}

export function CajonCuerpo({ children, className }) {
  return <div className={clases('r2-cajon-cuerpo', className)}>{children}</div>;
}

export function SeccionCajon({ titulo, accion, children, className }) {
  return (
    <section className={clases('r2-seccion-cajon', className)}>
      {(titulo || accion) && (
        <div className="r2-seccion-cajon-cab">
          {titulo && <h3 className="r2-seccion-cajon-titulo">{titulo}</h3>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

// Pie (solo en formularios): «Cancelar» fantasma + el verbo concreto en azul.
export function CajonPie({ children, resumen }) {
  return (
    <div className="r2-cajon-pie">
      {resumen && <span className="r2-cajon-pie-resumen">{resumen}</span>}
      <div className="r2-cajon-pie-botones">{children}</div>
    </div>
  );
}
