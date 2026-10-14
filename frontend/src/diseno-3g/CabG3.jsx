// Diseño 3G — encabezado de pantalla del paquete (g3-cab): título en oración, una línea de para qué sirve y acciones.
// Solo se monta con el interruptor encendido (cada pantalla decide: g3 ? <CabG3 …/> : <encabezado de siempre/>).
export default function CabG3({ titulo, descripcion, miga, children }) {
  return (
    <div className="g3-pila g3p-cab">
      {miga}
      <div className="g3-cab">
        <div>
          <h1>{titulo}</h1>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {children && <div className="g3-cab-acciones">{children}</div>}
      </div>
    </div>
  );
}
