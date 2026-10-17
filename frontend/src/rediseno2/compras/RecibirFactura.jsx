// Rediseño 2 · Compras · Recepción «Con foto de la factura» (vista ENCENDIDA de RecibirConFacturaModal). Va DENTRO del cajón
// «Recibir» de la vista de Recepción. Dos pasos: 1) fotos (agregar y quitar, siempre visible para el dedo) → «Leer factura»;
// 2) cada renglón leído con su artículo de la orden (elegir), cuánto entra y su estado con texto → «Registrar recepción».
// La lectura, el aprendizaje de equivalencias (aprender-cruce) y el registro son los mismos de hoy.
import { Camera, Sparkles, PackageCheck, X } from 'lucide-react';
import {
  CajonCuerpo, CajonPie, SeccionCajon, Tabla, Casilla, Boton, BotonIcono, Selector, Estado, Nota, numero, dinero, plural,
} from '../fundacion';
import './compras.css';

const ESTADO_RENGLON = {
  identificado: { tono: 'ok', texto: 'Identificado' },
  revisar: { tono: 'aviso', texto: 'Por confirmar' },
  sin_identificar: { tono: 'mal', texto: 'Sin identificar' },
};

export default function RecibirFactura({ archivos, setArchivos, agregarArchivos, inputArchivoRef, analizando, analizar, lectura,
  renglones, actualizarRenglon, asignarArticulo, incluidos, excedidos, registrando, registrar, onClose, alPie }) {
  const columnas = [
    {
      id: 'incluir', titulo: <span className="r2-solo-lectores">Entra al stock</span>, ancho: '56px', sinBoton: true,
      celda: (r) => (
        <Casilla soloCasilla marcada={r.incluir} deshabilitado={!r.detalle_id} alCambiar={(v) => actualizarRenglon(r.key, { incluir: v })}
          etiqueta={`Registrar «${r.descripcion}»`} />
      ),
    },
    {
      id: 'factura', titulo: 'Dice la factura', sinBoton: true,
      celda: (r) => (
        <span className="r2c-celda-doble">
          <span className="r2c-fuerte">{r.descripcion}</span>
          <span className="r2c-sec">
            {[`${numero(r.cantidad)} ${r.unidad || ''}`.trim(), r.precio_unitario > 0 ? dinero(r.precio_unitario) : null,
              r.codigo_proveedor ? `cód. ${r.codigo_proveedor}` : null, r.codigo_barras ? `barras ${r.codigo_barras}` : null].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    {
      id: 'articulo', titulo: 'Artículo de la orden', sinBoton: true,
      celda: (r) => {
        const e = ESTADO_RENGLON[r.estado] || ESTADO_RENGLON.sin_identificar;
        return (
          <span className="r2c-celda-doble r2c-celda-cruce">
            <Selector value={r.detalle_id || ''} onChange={(ev) => asignarArticulo(r.key, ev.target.value)} aria-label={`Artículo de la orden para «${r.descripcion}»`}
              aria-invalid={!r.detalle_id ? true : undefined} vacio="Elegir artículo de la orden…"
              opciones={lectura.articulos_orden.map((a) => ({ valor: a.detalle_id, texto: `${a.nombre} (faltan ${numero(a.cantidad_pendiente)} ${a.unidad})` }))} />
            <Estado tono={e.tono} texto={e.texto} detalle={r.motivo && r.estado !== 'identificado' ? r.motivo : undefined} />
          </span>
        );
      },
    },
    {
      id: 'entra', titulo: 'Entra', alinear: 'der', ancho: '132px', sinBoton: true,
      celda: (r) => {
        const excede = r.cantidad_pendiente != null && parseFloat(r.cantidad_recibida) > r.cantidad_pendiente;
        return (
          <span className="r2c-celda-doble r2c-celda-doble--der">
            <input type="number" step="0.01" min="0" value={r.cantidad_recibida} disabled={!r.detalle_id} inputMode="decimal"
              aria-label={`Cantidad que entra de «${r.descripcion}»`} aria-invalid={excede ? true : undefined}
              className="r2-entrada r2c-entrada-num" onChange={(ev) => actualizarRenglon(r.key, { cantidad_recibida: ev.target.value })} />
            {r.cantidad_pendiente != null && (
              <span className={excede ? 'r2c-error-celda' : 'r2c-sec'}>{excede ? 'Más de lo que falta: ' : 'faltan '}{numero(r.cantidad_pendiente)}</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <CajonCuerpo>
        {!lectura ? (
          <SeccionCajon titulo="1. Foto de la factura">
            <Nota>Toma la foto de la factura o remisión que entregó el proveedor. Se lee sola, se cruza con esta orden y solo te pregunta lo que no pueda identificar.</Nota>
            <button type="button" className="r2c-zona-foto" onClick={() => inputArchivoRef.current?.click()}>
              <Camera size={28} aria-hidden="true" />
              <span className="r2c-celda-doble">
                <span className="r2c-fuerte">Tomar foto o subir archivo</span>
                <span className="r2c-sec">Hasta 5 fotos si la factura tiene varias hojas</span>
              </span>
            </button>
            <input ref={inputArchivoRef} type="file" accept="image/*" capture="environment" multiple className="r2c-oculto"
              onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ''; }} />
            {archivos.length > 0 && (
              <ul className="r2c-fotos">
                {archivos.map((archivo, idx) => (
                  <li key={idx} className="r2c-foto">
                    <img src={URL.createObjectURL(archivo)} alt={`Factura, hoja ${idx + 1}`} />
                    <BotonIcono icono={X} tamano="chico" nivel="tonal" etiqueta={`Quitar la hoja ${idx + 1}`} className="r2c-foto-quitar"
                      alHacer={() => setArchivos((prev) => prev.filter((_, i) => i !== idx))} />
                  </li>
                ))}
              </ul>
            )}
          </SeccionCajon>
        ) : (
          <SeccionCajon titulo="2. Revisa lo que se leyó">
            <p className="r2c-resumen-linea">
              {[`Factura ${lectura.factura.folio || 'sin folio'}`, lectura.factura.proveedor].filter(Boolean).join(' · ')}
            </p>
            <div className="r2c-estados-linea">
              <Estado tono="ok" texto={plural(lectura.resumen.identificados, 'identificado', 'identificados')} />
              {lectura.resumen.revisar > 0 && <Estado tono="aviso" texto={`${lectura.resumen.revisar} por confirmar`} />}
              {lectura.resumen.sin_identificar > 0 && <Estado tono="mal" texto={`${lectura.resumen.sin_identificar} sin identificar`} />}
            </div>
            <Tabla etiqueta="Renglones de la factura" densidad="compacta" fija={false} clave="key" columnas={columnas} filas={renglones}
              className="r2c-tabla-factura"
              filaCelular={(r) => ({
                inicio: columnas[0].celda(r),
                principal: r.descripcion,
                secundario: columnas[2].celda(r),
                derecha: columnas[3].celda(r),
              })} />
            <Nota>Al registrar se guarda cómo le llama este proveedor a cada artículo, para que la próxima factura se cruce sola. Si la factura trae un código de barras distinto al nuestro, se le manda al administrador para que decida si lo reemplaza.</Nota>
          </SeccionCajon>
        )}
        {alPie}
      </CajonCuerpo>
      <CajonPie resumen={lectura ? `${plural(incluidos.length, 'renglón entra', 'renglones entran')} al stock` : plural(archivos.length, 'foto elegida', 'fotos elegidas')}>
        <Boton nivel="fantasma" alHacer={onClose}>Cancelar</Boton>
        {!lectura ? (
          <Boton nivel="tonal" icono={Sparkles} alHacer={analizar} cargando={analizando} deshabilitado={archivos.length === 0}
            motivo="Primero toma o sube la foto">{analizando ? 'Leyendo la factura…' : 'Leer factura'}</Boton>
        ) : (
          <Boton nivel="principal" icono={PackageCheck} alHacer={registrar} cargando={registrando}
            deshabilitado={incluidos.length === 0 || excedidos.length > 0}
            motivo={excedidos.length > 0 ? 'Un renglón entra más de lo que falta' : 'No hay renglones para registrar'}>Registrar recepción</Boton>
        )}
      </CajonPie>
    </>
  );
}
