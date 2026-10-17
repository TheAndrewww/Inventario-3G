// Rediseño 2 · ayudas de acomodo sin color (para no usar clases de color, tamaño, radio ni sombra de Tailwind en las vistas).
//
// <Pila separacion={12}>…</Pila>                     columna con separación (4 · 8 · 12 · 16 · 24 · 32 · 48)
// <Fila separacion={8} alinear="centro" envolver>…</Fila>   renglón flexible
// <Seccion titulo="Por preparar" dato="6 tickets" accion={…}>…</Seccion>   título de sección de página (32 px arriba, 12 abajo)
// <Nota>Texto de ayuda de 14 px en tinta-2.</Nota>
import { clases } from '../formato';

export function Pila({ separacion = 12, className, children, como = 'div', ...resto }) {
  const Como = como;
  return <Como className={clases('r2-pila', className)} style={{ gap: separacion }} {...resto}>{children}</Como>;
}

export function Fila({ separacion = 8, alinear = 'centro', envolver = false, entre = false, className, children, como = 'div', ...resto }) {
  const Como = como;
  return (
    <Como className={clases('r2-fila-flex', envolver && 'r2-fila-flex--envolver', entre && 'r2-fila-flex--entre', `r2-alinear--${alinear}`, className)}
      style={{ gap: separacion }} {...resto}>
      {children}
    </Como>
  );
}

export function Seccion({ titulo, dato, accion, className, children }) {
  return (
    <section className={clases('r2-seccion', className)}>
      {(titulo || accion) && (
        <div className="r2-seccion-cab">
          <h2 className="r2-seccion-titulo">{titulo}{dato && <span className="r2-seccion-dato">{dato}</span>}</h2>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Nota({ className, children, tono }) {
  return <p className={clases('r2-nota', tono && `r2-tono--${tono}`, className)}>{children}</p>;
}
