// Rediseño 2 · públicas · carrusel de anuncios encendido. Lo pinta CarouselAnuncios (que sigue llevando la rotación de
// 16 s y su índice): aquí solo se muestra la imagen completa sobre fondo oscuro, sin texto encima (pedido del dueño), y al
// pie, discreto, qué anuncio va («2 / 5») con la línea de avance hasta el siguiente.
// Si una imagen no se puede mostrar (liga rota), en lugar del ícono roto del navegador sale la frase del anuncio en grande;
// no se pide nada de nuevo: la frase se queda hasta que la pantalla se vuelve a abrir o el anuncio trae otra imagen.
import { useState } from 'react';
import { clases } from '../fundacion';
import './publicas.css';

export default function CarruselAnunciosR2({ anuncios = [], actual = 0 }) {
  const [rotas, setRotas] = useState({});
  if (!anuncios.length) return null;
  const i = actual < anuncios.length ? actual : 0;
  const marcarRota = (anuncio) => setRotas((r) => (r[anuncio.imagen_url] ? r : { ...r, [anuncio.imagen_url]: true }));
  return (
    <div className="r2-pub-escenario" role="region" aria-roledescription="carrusel" aria-label="Anuncios de hoy">
      {anuncios.map((anuncio, k) => (
        <figure key={anuncio.id} className={clases('r2-pub-diapositiva', k === i && 'r2-pub-diapositiva--activa')} aria-hidden={k !== i}>
          {rotas[anuncio.imagen_url] ? (
            <figcaption className="r2-pub-sin-imagen">
              <span className="r2-pub-sin-imagen-frase">{anuncio.frase}</span>
              <span className="r2-pub-sin-imagen-nota">La imagen de este anuncio no se pudo mostrar</span>
            </figcaption>
          ) : (
            <img src={anuncio.imagen_url} alt={anuncio.frase} className="r2-pub-imagen" onError={() => marcarRota(anuncio)} />
          )}
        </figure>
      ))}
      {anuncios.length > 1 && (
        <>
          <p className="r2-pub-indicador" aria-live="off">
            <span className="r2-pub-puntos" aria-hidden="true">
              {anuncios.map((anuncio, k) => <span key={anuncio.id} className={clases('r2-pub-punto', k === i && 'r2-pub-punto--activo')} />)}
            </span>
            <span className="r2-pub-cuenta">{i + 1} / {anuncios.length}</span>
            <span className="r2-solo-lectores">anuncios</span>
          </p>
          <span key={i} className="r2-pub-avance" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
