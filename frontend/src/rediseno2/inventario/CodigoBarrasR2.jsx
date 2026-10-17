// Rediseño 2 · grupo inventario · código de barras del artículo (BarcodeDisplay encendido): la imagen sobre su placa
// blanca (es la imagen del código, no la interfaz: así se lee también en modo oscuro), el código y «Descargar» e
// «Imprimir». La imagen la pide BarcodeDisplay como siempre; aquí solo se pinta.
import { Download, Printer } from 'lucide-react';
import { Boton } from '../fundacion/piezas/Boton';
import './inventario.css';

export default function CodigoBarrasR2({ imagen, cargando, error, codigo, alCargar, alDescargar, alImprimir }) {
  return (
    <div className="r2-inv-codigo">
      <div className="r2-inv-codigo-placa" aria-busy={cargando || undefined}>
        {error ? (
          <p className="r2-inv-codigo-error" role="alert">No se pudo cargar el código de barras.</p>
        ) : imagen ? (
          <img src={imagen} alt={`Código de barras ${codigo || ''}`} onLoad={alCargar} />
        ) : (
          <span className="r2-hueso r2-inv-codigo-hueso" aria-hidden="true" />
        )}
      </div>
      <div className="r2-inv-codigo-pie">
        <span className="r2-inv-codigo-texto">{codigo || 'Sin código'}</span>
        <span className="r2-inv-codigo-botones">
          <Boton nivel="fantasma" tamano="chico" icono={Download} alHacer={alDescargar}>Descargar</Boton>
          <Boton nivel="fantasma" tamano="chico" icono={Printer} alHacer={alImprimir} deshabilitado={!imagen} motivo="El código todavía no carga">Imprimir</Boton>
        </span>
      </div>
    </div>
  );
}
