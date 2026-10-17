// Rediseño 2 · Compras · confirmar «Cancelar solicitud» (vista ENCENDIDA de CancelarSolicitudModal). Es destructivo: va en un
// diálogo corto con lo que se cancela, el motivo obligatorio (10 letras o más, como hoy) y «No cancelar» como salida.
import { useId } from 'react';
import { XCircle } from 'lucide-react';
import { Dialogo, Datos, Campo, Area, Boton, Nota, cantidad } from '../fundacion';
import './compras.css';

export default function DialogoCancelarSolicitud({ onClose, solicitud, motivo, setMotivo, loading, handleSubmit }) {
  const idForma = `r2c-cancelar-${useId().replace(/:/g, '')}`;
  const largo = motivo.trim().length;
  return (
    <Dialogo abierto alCerrar={onClose} cerrarConEsc titulo={`¿Cancelar la solicitud ${solicitud.ticket_id}?`} tamano="md"
      pie={(
        <>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>No cancelar</Boton>
          <Boton nivel="peligro-lleno" tipo="submit" form={idForma} icono={XCircle} cargando={loading} deshabilitado={largo < 10}
            motivo="Escribe el motivo (10 letras o más)">Cancelar solicitud</Boton>
        </>
      )}>
      <form id={idForma} onSubmit={handleSubmit} className="r2-pila" style={{ gap: 16 }}>
        <Datos columnas={2} datos={[
          { etiqueta: 'Artículo', valor: solicitud.articulo?.nombre, ancho: 'doble' },
          ['Cantidad', cantidad(solicitud.cantidad_solicitada, solicitud.articulo?.unidad)],
          ['Pidió', solicitud.solicitante?.nombre],
        ]} />
        <Campo etiqueta="Motivo de la cancelación" requerido ayuda={`${largo} de 10 letras como mínimo`}>
          <Area rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={10} autoFocus
            placeholder="Por qué ya no hace falta comprarlo" />
        </Campo>
        <Nota>La solicitud pasa a «cancelada» y ya no aparece en la lista de pendientes.</Nota>
      </form>
    </Dialogo>
  );
}
