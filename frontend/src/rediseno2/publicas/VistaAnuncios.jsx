// Rediseño 2 · Anuncios (/anuncios), vista encendida (DISENO-v2 §5.7).
// TV de oficina y taller: los anuncios del día uno por uno, de lejos. Dirección (con sesión guardada en ese navegador)
// revisa las imágenes y genera o regenera las que hagan falta.
//   · La imagen a pantalla completa, sin texto encima; al pie «2 / 5» discreto (lo pinta CarouselAnuncios encendido).
//   · Controles (Actualizar, Pantalla completa, Administrar) y la hora de actualización SOLO al mover el ratón o tocar.
//   · Estados honestos: cargando, «Hoy no hay anuncios» y error con «Reintentar».
//   · Administrar en un cajón ancho: las imágenes grandes (16:9) con su estado en texto y su botón de generar o regenerar;
//     «Sincronizar y generar todo» es la única acción principal; «Solo leer la lista» es secundaria.
// Datos, carga cada hora, vistas contadas, manejadores y avisos son los de la página: aquí solo se pinta.
import { useState } from 'react';
import { FileText, ImageOff, Maximize2, Minimize2, RefreshCw, RotateCcw, Settings, Sparkles } from 'lucide-react';
import {
  AvisosFlotantes, Boton, Cajon, CajonCabecera, CajonCuerpo, CajonDecision, Estado, SeccionCajon, useTemaPiso, horaCorta, plural, clases,
  estadoDe,
} from '../fundacion';
import CarouselAnuncios from '../../components/anuncios/CarouselAnuncios';
import { BotonControl, ControlesPublicos } from './PiezasPublicas';
import './publicas.css';

// Estado de cada anuncio en la lista de administrar: el mismo cálculo de hoy, con el texto del vocabulario.
// (Las palabras viven en fundacion/vocabulario.js desde la revisión final.)
function estadoDeAnuncio(anuncio, estadoProgreso) {
  if (estadoProgreso === 'completado') return estadoDe('anuncio', 'generado_ahora');
  if (estadoProgreso === 'generando') return estadoDe('anuncio', 'generando');
  if (estadoProgreso === 'error') return estadoDe('anuncio', 'error');
  return estadoDe('anuncio', anuncio.generado ? 'generado' : 'pendiente');
}

// Imagen de la rejilla; si la liga está rota, «No se pudo mostrar» en lugar del ícono roto del navegador (no pide nada más).
function ImagenAnuncio({ src, alt }) {
  const [rota, setRota] = useState(null);
  if (rota === src) {
    return <span className="r2-pub-admin-sin-imagen"><ImageOff size={24} aria-hidden="true" />No se pudo mostrar la imagen</span>;
  }
  return <img src={src} alt={alt} onError={() => setRota(src)} />;
}

function CajonAdministrar({
  abierto, alCerrar, listaAnuncios, progresoGeneracion, porcentajeProgreso, sincronizando, regenerandoId, generandoIndividual,
  handleSoloSincronizar, handleSincronizarYGenerar, handleRegenerar, handleGenerarIndividual,
}) {
  const ocupado = sincronizando || progresoGeneracion.activo;
  const pendientes = listaAnuncios.filter((a) => !a.generado).length;
  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} ancho="ancho" etiqueta="Administrar anuncios">
      <CajonCabecera
        titulo="Administrar anuncios"
        dato={`${plural(listaAnuncios.length, 'anuncio', 'anuncios')}${pendientes ? ` · ${pendientes} sin imagen` : ''}`}
        alCerrar={alCerrar}
      />
      <CajonDecision nota="Lee los anuncios de la pestaña del calendario y genera con IA las imágenes que falten.">
        <Boton nivel="principal" icono={Sparkles} alHacer={handleSincronizarYGenerar} deshabilitado={ocupado}>
          {progresoGeneracion.activo
            ? `Generando ${progresoGeneracion.completados + 1}/${progresoGeneracion.total}…`
            : 'Sincronizar y generar todo'}
        </Boton>
        <Boton nivel="contorno" icono={FileText} alHacer={handleSoloSincronizar} deshabilitado={ocupado}>
          {sincronizando ? 'Leyendo…' : 'Solo leer la lista'}
        </Boton>
      </CajonDecision>
      <CajonCuerpo>
        {progresoGeneracion.activo && (
          <div className="r2-pub-admin-progreso" role="status">
            <p>
              <span>Generando imágenes…</span>
              <span className="r2-pub-num">{progresoGeneracion.completados} de {progresoGeneracion.total}</span>
            </p>
            <span className="r2-pub-admin-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentajeProgreso} aria-label="Avance de la generación">
              <span style={{ width: `${porcentajeProgreso}%` }} />
            </span>
          </div>
        )}
        <SeccionCajon titulo={`Anuncios (${listaAnuncios.length})`}>
          {listaAnuncios.length === 0 ? (
            <div className="r2-pub-admin-vacio">
              <p className="r2-pub-admin-vacio-titulo">No hay anuncios</p>
              <p>Presiona «Solo leer la lista» para ver los anuncios del calendario.</p>
            </div>
          ) : (
            <ul className="r2-pub-admin-rejilla">
              {listaAnuncios.map((anuncio, index) => {
                const estadoProgreso = progresoGeneracion.estados[index];
                const est = estadoDeAnuncio(anuncio, estadoProgreso);
                const trabajando = regenerandoId === anuncio.id || generandoIndividual === index;
                const generando = estadoProgreso === 'generando';
                return (
                  <li key={anuncio.id || index} className="r2-pub-admin-item">
                    <div className={clases('r2-pub-admin-imagen', generando && 'r2-pub-admin-imagen--generando')}>
                      {anuncio.generado && anuncio.imagen_url ? (
                        <ImagenAnuncio src={anuncio.imagen_url} alt={`Anuncio ${index + 1}`} />
                      ) : generando ? (
                        <span className="r2-hueso r2-pub-admin-hueso" aria-hidden="true" />
                      ) : (
                        <span className="r2-pub-admin-sin-imagen"><ImageOff size={24} aria-hidden="true" />Sin imagen</span>
                      )}
                    </div>
                    <p className="r2-pub-admin-texto">{anuncio.textoAnuncio || anuncio.frase}</p>
                    <div className="r2-pub-admin-pie">
                      <Estado tono={est.tono} texto={est.texto} />
                      {!progresoGeneracion.activo && (
                        <Boton
                          nivel="contorno"
                          tamano="chico"
                          icono={anuncio.generado ? RotateCcw : Sparkles}
                          alHacer={() => (anuncio.generado ? handleRegenerar(anuncio.id) : handleGenerarIndividual(anuncio, index))}
                          deshabilitado={trabajando}
                        >
                          {trabajando
                            ? (anuncio.generado ? 'Regenerando…' : 'Generando…')
                            : (anuncio.generado ? 'Regenerar imagen' : 'Generar imagen')}
                        </Boton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SeccionCajon>
      </CajonCuerpo>
    </Cajon>
  );
}

function EstadoPantalla({ estado, error, isAdmin, alReintentar, alAdministrar, cargando }) {
  if (estado === 'cargando') {
    return (
      <div className="r2-pub-estado" role="status" aria-busy="true">
        <span className="r2-hueso r2-pub-hueso-anuncio" aria-hidden="true" />
        <p className="r2-pub-estado-titulo">Cargando anuncios…</p>
      </div>
    );
  }
  if (estado === 'error') {
    return (
      <div className="r2-pub-estado" role="alert">
        <p className="r2-pub-estado-titulo">No se pudieron cargar los anuncios</p>
        <p className="r2-pub-estado-texto">
          {error && error !== 'No se pudieron cargar los anuncios' ? `${error}. ` : ''}La pantalla lo vuelve a intentar sola cada hora.
        </p>
        <BotonControl icono={RefreshCw} texto={cargando ? 'Reintentando…' : 'Reintentar'} alHacer={alReintentar} deshabilitado={cargando} girando={cargando} nivel="principal" />
      </div>
    );
  }
  return (
    <div className="r2-pub-estado" role="status">
      <p className="r2-pub-estado-titulo">Hoy no hay anuncios</p>
      <p className="r2-pub-estado-texto">Los anuncios del día salen del calendario. La pantalla vuelve a revisar cada hora.</p>
      {isAdmin && (
        <BotonControl icono={Settings} texto="Administrar anuncios" alHacer={alAdministrar} nivel="tonal" />
      )}
    </div>
  );
}

export default function VistaAnuncios({
  anuncios, anunciosCalendario, loading, error, ultimaActualizacion, isFullscreen, showControls, showAdminMenu, setShowAdminMenu,
  regenerandoId, sincronizando, generandoIndividual, progresoGeneracion, isAdmin,
  cargarAnuncios, handleSincronizarYGenerar, handleSoloSincronizar, handleRegenerar, handleGenerarIndividual, toggleFullscreen,
}) {
  const tema = useTemaPiso('tv');
  // Lista de administrar y avance: el mismo cálculo de la página de hoy
  const listaAnuncios = anunciosCalendario.length > 0 ? anunciosCalendario : anuncios.map((a) => ({
    textoAnuncio: a.frase,
    generado: true,
    id: a.id,
    imagen_url: a.imagen_url,
  }));
  const porcentajeProgreso = progresoGeneracion.total > 0
    ? Math.round((progresoGeneracion.completados / progresoGeneracion.total) * 100)
    : 0;
  const n = anuncios.length;
  const estado = loading && n === 0 ? 'cargando' : error && n === 0 ? 'error' : n === 0 ? 'vacio' : 'lista';
  const resumen = [
    n > 0 ? plural(n, 'anuncio', 'anuncios') : null,
    ultimaActualizacion ? `datos de las ${horaCorta(ultimaActualizacion)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="r2-piso r2-pub-anuncios" data-tema={tema}>
      <AvisosFlotantes />
      {estado === 'lista'
        ? <CarouselAnuncios anuncios={anuncios} />
        : <EstadoPantalla estado={estado} error={error} isAdmin={isAdmin} cargando={loading} alReintentar={() => cargarAnuncios(true)} alAdministrar={() => setShowAdminMenu(true)} />}

      <ControlesPublicos visibles={showControls} posicion="arriba" etiqueta="Controles de anuncios">
        <p className="r2-pub-barra-titulo">
          <span className="r2-pub-barra-nombre">Anuncios de hoy</span>
          {resumen && <span className="r2-pub-barra-dato">{resumen}</span>}
          {error && n > 0 && <span className="r2-pub-barra-dato r2-tono--aviso">No se pudo actualizar</span>}
        </p>
        <BotonControl icono={RefreshCw} texto={loading ? 'Actualizando…' : 'Actualizar'} alHacer={() => cargarAnuncios(true)} girando={loading} />
        <BotonControl
          icono={isFullscreen ? Minimize2 : Maximize2}
          texto={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          alHacer={toggleFullscreen}
        />
        {isAdmin && (
          <BotonControl icono={Settings} texto="Administrar anuncios" title="Administrar anuncios" nivel="tonal" presionado={showAdminMenu} alHacer={() => setShowAdminMenu(!showAdminMenu)} />
        )}
      </ControlesPublicos>

      {isAdmin && (
        <CajonAdministrar
          abierto={showAdminMenu}
          alCerrar={() => setShowAdminMenu(false)}
          listaAnuncios={listaAnuncios}
          progresoGeneracion={progresoGeneracion}
          porcentajeProgreso={porcentajeProgreso}
          sincronizando={sincronizando}
          regenerandoId={regenerandoId}
          generandoIndividual={generandoIndividual}
          handleSoloSincronizar={handleSoloSincronizar}
          handleSincronizarYGenerar={handleSincronizarYGenerar}
          handleRegenerar={handleRegenerar}
          handleGenerarIndividual={handleGenerarIndividual}
        />
      )}
    </div>
  );
}
