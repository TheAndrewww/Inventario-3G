// Rediseño 2 · grupo inventario · campo del código con escáner de cámara (EAN13InputScanner encendido).
// El campo, «Escanear» / «Detener» y el área de la cámara (el mismo id que usa la librería). La ayuda va UNA sola vez en
// el <Campo> de quien lo usa. La cámara la prende y la apaga el componente de siempre.
import { Camera, X, ScanLine, SwitchCamera } from 'lucide-react';
import { Boton, BotonIcono } from '../fundacion/piezas/Boton';
import { clases } from '../fundacion/formato';
import './inventario.css';

export default function CampoCodigoR2({ valor, alCambiar, deshabilitado, escaneando, mostrarEscaner, camaras, alIniciar, alDetener, alCambiarCamara, valido, resto = {} }) {
  return (
    <div className="r2-inv-codigo-campo">
      <div className="r2-inv-codigo-fila">
        <span className="r2-entrada-caja r2-inv-crece">
          <ScanLine size={18} aria-hidden="true" className="r2-entrada-icono" />
          <input type="text" className="r2-entrada r2-inv-mono" value={valor} onChange={alCambiar} disabled={deshabilitado || escaneando}
            placeholder="Por ejemplo: 7501234567890" maxLength={13} autoComplete="off" spellCheck={false} {...resto} />
          {valor && <span className={clases('r2-inv-codigo-largo', valido ? 'r2-tono--ok' : 'r2-tono--aviso')} aria-label={`${valor.length} caracteres`}>{valor.length}</span>}
        </span>
        {!escaneando ? (
          <Boton nivel="contorno" icono={Camera} alHacer={alIniciar} deshabilitado={deshabilitado}>Escanear</Boton>
        ) : (
          <Boton nivel="contorno" icono={X} alHacer={alDetener}>Detener</Boton>
        )}
      </div>
      {mostrarEscaner && (
        <div className="r2-inv-camara">
          <div id="ean13-input-scanner" className="r2-inv-camara-visor" />
          {escaneando && camaras.length > 1 && (
            <BotonIcono icono={SwitchCamera} etiqueta="Cambiar de cámara" alHacer={alCambiarCamara} tamano="grande" className="r2-inv-camara-girar" />
          )}
          <p className="r2-inv-camara-estado" role="status">{escaneando ? 'Apunta la cámara al código de barras o QR' : 'Prendiendo la cámara…'}</p>
        </div>
      )}
    </div>
  );
}
