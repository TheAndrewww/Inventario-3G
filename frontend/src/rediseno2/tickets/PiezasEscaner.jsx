// Rediseño 2 · grupo tickets · piezas del escáner, encendidas. Las usan Orden de salida e Inventario tal cual (mismos
// componentes de siempre: EAN13Scanner, BarcodeScannerIndicator y ScanSuccessNotification; cada uno decide aquí cómo se
// ve encendido). Todo el estado, la cámara, el sonido y las búsquedas siguen en el componente de siempre.
//
//   <EscanerCamaraR2 c={{ isScanning, cameras, selectedCamera, setSelectedCamera, carritoEscaneados, flashEffect,
//      startScanning, stopScanning, switchCamera, aumentarCantidad, disminuirCantidad, eliminarDelCarrito, crearPedido,
//      vaciarCarrito }} />
//   <IndicadorLecturaR2 />                         la pistola está escribiendo (lo que hoy es «Escaneando código…»)
//   <AvisoLecturaR2 articulo visible alCerrar />   «Agregado a la orden» con la foto, la clave y la existencia
import { Camera, CheckCircle2, ScanLine, SwitchCamera, Trash2, X, Minus, Plus, CameraOff } from 'lucide-react';
import { Boton, BotonIcono, Campo, Selector, Miniatura, Vacio, cantidad, numero, plural, clases } from '../fundacion';
import { getImageUrl } from '../../utils/imageUtils';
import './tickets.css';

// Mismo ajuste de siempre para ocultar las marcas que dibuja la librería de la cámara
const ESTILO_LIBRERIA = `
  #ean13-scanner #qr-shaded-region { border: none !important; box-shadow: none !important; }
  #ean13-scanner__scan_region { border: none !important; outline: none !important; }
  #ean13-scanner svg { display: none !important; }
  #ean13-scanner canvas:last-of-type { opacity: 0 !important; }
`;

export function EscanerCamaraR2({ c }) {
  const n = c.carritoEscaneados.length;
  const piezas = c.carritoEscaneados.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
  return (
    <div className="r2-tk-camara">
      <style>{ESTILO_LIBRERIA}</style>

      <div className={clases('r2-tk-camara-visor', c.flashEffect && 'r2-tk-camara-visor--leido')}>
        <div id="ean13-scanner" className="r2-tk-camara-video" />
        {c.isScanning && (
          <span className="r2-tk-camara-guia" aria-hidden="true"><i /><i /><i /><i /></span>
        )}
        {c.isScanning && c.cameras.length > 1 && (
          <BotonIcono icono={SwitchCamera} etiqueta="Cambiar de cámara" alHacer={c.switchCamera} tamano="grande" className="r2-tk-camara-girar" />
        )}
        {!c.isScanning && (
          <div className="r2-tk-camara-apagada">
            <CameraOff size={32} aria-hidden="true" />
            <p>La cámara está apagada</p>
            <Boton nivel={n ? 'tonal' : 'principal'} icono={Camera} alHacer={c.startScanning}>Activar cámara</Boton>
          </div>
        )}
        {c.flashEffect && <span className="r2-solo-lectores" role="status">Código leído</span>}
      </div>

      <div className="r2-tk-camara-controles">
        {c.isScanning && <Boton nivel="contorno" icono={X} alHacer={c.stopScanning}>Detener cámara</Boton>}
        {c.cameras.length > 1 && (
          <Campo etiqueta="Cámara" className="r2-tk-camara-selector">
            <Selector value={c.selectedCamera || ''} onChange={(e) => c.setSelectedCamera(e.target.value)} disabled={c.isScanning}
              opciones={c.cameras.map((cam) => ({ valor: cam.id, texto: cam.label || `Cámara ${cam.id}` }))} />
          </Campo>
        )}
      </div>
      <p className="r2-tk-camara-ayuda">
        Pon el código de barras (EAN-13) dentro del recuadro, quieto y con buena luz. Cada lectura suma una pieza y se junta abajo.
      </p>

      <section className="r2-tk-camara-escaneados" aria-label="Artículos escaneados">
        <h3 className="r2-tk-subtitulo">Escaneados <span className="r2-tk-subtitulo-dato">{numero(n)}</span></h3>
        {n === 0 ? (
          <Vacio compacto icono={ScanLine} titulo="Todavía no hay lecturas" texto="Activa la cámara y apunta al código de barras del artículo." />
        ) : (
          <ul className="r2-lista r2-tk-camara-lista">
            {c.carritoEscaneados.map((it) => (
              <li key={it.articulo.id} className="r2-tk-camara-fila">
                <Miniatura src={it.articulo.imagen_url ? getImageUrl(it.articulo.imagen_url) : null} alt={it.articulo.nombre} tamano={40} ampliable={false} />
                <span className="r2-tk-articulo-lineas">
                  <span className="r2-tk-articulo-nombre">{it.articulo.nombre}</span>
                  <span className="r2-tk-articulo-clave">{it.articulo.codigo_ean13}</span>
                </span>
                <span className="r2-cantidad r2-tk-cantidad" role="group" aria-label={`Cantidad de ${it.articulo.nombre}`}>
                  <button type="button" className="r2-cantidad-boton" aria-label="Quitar 1" disabled={it.cantidad <= 1 || undefined}
                    onClick={() => c.disminuirCantidad(it.articulo.id)}>
                    <Minus size={18} aria-hidden="true" />
                  </button>
                  <span className="r2-cantidad-campo r2-tk-cantidad-fija" aria-live="polite">{numero(it.cantidad)}</span>
                  <button type="button" className="r2-cantidad-boton" aria-label="Agregar 1" onClick={() => c.aumentarCantidad(it.articulo.id)}>
                    <Plus size={18} aria-hidden="true" />
                  </button>
                  {it.articulo.unidad && <span className="r2-cantidad-unidad">{cantidad(it.cantidad, it.articulo.unidad).replace(/^[\d.,\s]+/, '')}</span>}
                </span>
                <BotonIcono icono={Trash2} etiqueta={`Quitar ${it.articulo.nombre}`} alHacer={() => c.eliminarDelCarrito(it.articulo.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {n > 0 && (
        <div className="r2-tk-camara-pie">
          <span className="r2-tk-camara-pie-resumen">{plural(n, 'artículo', 'artículos')} · {cantidad(piezas, 'piezas')}</span>
          <span className="r2-tk-camara-pie-botones">
            <Boton nivel="fantasma" alHacer={c.vaciarCarrito}>Vaciar</Boton>
            <Boton nivel="principal" icono={CheckCircle2} alHacer={c.crearPedido}>Agregar a la orden</Boton>
          </span>
        </div>
      )}
    </div>
  );
}

export function IndicadorLecturaR2() {
  return (
    <div className="r2-tk-lectura" role="status">
      <ScanLine size={18} aria-hidden="true" />
      <span>Leyendo código de la pistola…</span>
    </div>
  );
}

export function AvisoLecturaR2({ articulo, visible, alCerrar }) {
  const foto = articulo.imagen_url ? getImageUrl(articulo.imagen_url) : null;
  return (
    <div className={clases('r2-tk-aviso-lectura', !visible && 'r2-tk-aviso-lectura--sale')} role="status">
      <CheckCircle2 size={20} aria-hidden="true" className="r2-tk-aviso-lectura-icono" />
      <Miniatura src={foto} alt={articulo.nombre} tamano={40} ampliable={false} />
      <span className="r2-tk-aviso-lectura-lineas">
        <span className="r2-tk-aviso-lectura-titulo">Agregado a la orden</span>
        <span className="r2-tk-aviso-lectura-nombre">{articulo.nombre}</span>
        <span className="r2-tk-aviso-lectura-detalle">
          {[articulo.codigo_ean13, `Hay ${cantidad(articulo.stock_actual, articulo.unidad)}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <BotonIcono icono={X} etiqueta="Cerrar aviso" alHacer={alCerrar} tamano="chico" />
    </div>
  );
}
