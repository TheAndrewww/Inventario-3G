// Rediseño 2 · foto chica, indicador de pistola y zona heredada (DISENO-v2 §4.14 y §3.7).
//
// <Miniatura src={articulo.imagen_url} alt={articulo.nombre} tamano={48} />   (se amplía en un visor al tocarla)
// <Miniatura src={`/articulos/${id}/foto`} autenticada alt="…" />             (foto que pide sesión: AuthenticatedImage, la
//    MISMA petición de siempre; no se amplía para no pedirla otra vez)
// <IndicadorPistola activa={scannerActivo} />                                  («Pistola activa» con punto verde / «Pistola en pausa»)
// <ZonaHeredada><PiezaViejaSinRediseñar /></ZonaHeredada>                       (se ve como hoy encendido, con g3-zona)
//
// Miniatura: src, alt, tamano (40 | 48 | 64), autenticada, ampliable (true), vacio (nodo cuando no hay foto).
import { useRef, useState } from 'react';
import { ImageOff, ScanLine, X } from 'lucide-react';
import AuthenticatedImage from '../../../components/common/AuthenticatedImage';
import { useCapa } from '../useCapa';
import { clases } from '../formato';

function VisorFoto({ src, alt, alCerrar }) {
  const ref = useRef(null);
  useCapa({ abierta: true, ref, alCerrar });
  return (
    <div className="r2-capa r2-capa--visor" onClick={alCerrar}>
      <div className="r2-velo r2-velo--oscuro" aria-hidden="true" />
      <div ref={ref} className="r2-visor-foto" role="dialog" aria-modal="true" aria-label={alt || 'Foto'}>
        <button type="button" className="r2-boton-icono r2-boton-icono--grande r2-visor-cerrar" aria-label="Cerrar foto" data-r2-foco="" onClick={alCerrar}>
          <X size={22} aria-hidden="true" />
        </button>
        <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

export function Miniatura({ src, alt = '', tamano = 40, autenticada = false, ampliable = true, vacio, className }) {
  const [ver, setVer] = useState(false);
  const estilo = { '--r2-mini': `${tamano}px` };
  if (!src) {
    return <span className={clases('r2-miniatura r2-miniatura--vacia', className)} style={estilo} aria-hidden="true">{vacio || <ImageOff size={Math.round(tamano / 2.4)} />}</span>;
  }
  if (autenticada) {
    return (
      <span className={clases('r2-miniatura', className)} style={estilo}>
        <AuthenticatedImage src={src} alt={alt} className="r2-miniatura-img" placeholderClassName="r2-miniatura-hueco" placeholderText="" />
      </span>
    );
  }
  if (!ampliable) return <span className={clases('r2-miniatura', className)} style={estilo}><img src={src} alt={alt} className="r2-miniatura-img" loading="lazy" /></span>;
  return (
    <>
      <button type="button" className={clases('r2-miniatura r2-miniatura--boton', className)} style={estilo}
        aria-label={alt ? `Ver foto de ${alt}` : 'Ver foto'} onClick={(e) => { e.stopPropagation(); setVer(true); }}>
        <img src={src} alt="" className="r2-miniatura-img" loading="lazy" />
      </button>
      {ver && <VisorFoto src={src} alt={alt} alCerrar={() => setVer(false)} />}
    </>
  );
}

export function IndicadorPistola({ activa = true, className }) {
  return (
    <span className={clases('r2-pistola', activa ? 'r2-tono--ok' : 'r2-tono--neutro', className)} role="status">
      <ScanLine size={16} aria-hidden="true" />
      <span className="r2-estado-punto" aria-hidden="true" />
      {activa ? 'Pistola activa' : 'Pistola en pausa'}
    </span>
  );
}

// Pieza vieja dentro de una vista nueva: se ve como hoy encendido (las reglas de g3-zona de planta-3g.css).
export function ZonaHeredada({ children, className }) {
  return <div className={clases('g3-zona r2-zona-heredada', className)}>{children}</div>;
}
