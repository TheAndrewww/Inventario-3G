// Rediseño 2 · Gestión · diálogos de Herramientas de renta, encendidos: asignar, devolver, cambiar condición y nuevo tipo.
// Antes: diálogos centrados con cajas de color (azul, verde, gris) y emojis en las condiciones. Ahora: cajones con los
// datos de la unidad arriba, los mismos campos (cada uno a su medida) y el verbo concreto en el pie. Cada diálogo de
// siempre (dentro de RentaHerramientasPage) conserva su estado, sus cargas y su envío; aquí solo se pinta.
import { UserCheck, RotateCcw, Settings2, Plus, Check, Info } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Campo, Entrada, Selector, Area, Segmentado, Boton, Datos, Estado, Nota, clases,
} from '../fundacion';
import { nombreRol, CONDICION_HERRAMIENTA, ESTATUS_HERRAMIENTA } from './comunes';
import './gestion.css';

const hoyIso = () => new Date().toISOString().split('T')[0];
const estatusDe = (e) => ESTATUS_HERRAMIENTA[e] || [e, 'neutro'];
const condicionDe = (c) => CONDICION_HERRAMIENTA[c] || [c, 'neutro'];

function Formulario({ alEnviar, children }) {
  // El formulario va dentro del cajón para que la revisión del navegador (campos requeridos, fechas) sea la de siempre
  return <form className="r2g-form-cajon" onSubmit={alEnviar}>{children}</form>;
}

// ───────── Asignar ─────────
export function CajonAsignar({
  unidad, onClose, tipoAsignacion, setTipoAsignacion, usuarioSeleccionado, setUsuarioSeleccionado, camionetaSeleccionada,
  setCamionetaSeleccionada, observaciones, setObservaciones, fechaVencimiento, setFechaVencimiento, usuarios, camionetas, loading, handleSubmit,
}) {
  return (
    <Cajon abierto alCerrar={onClose} etiqueta="Asignar herramienta">
      <CajonCabecera titulo="Asignar herramienta" dato={`${unidad.tipo?.nombre || 'Herramienta'} · ${unidad.codigo_unico}`} alCerrar={onClose} />
      <Formulario alEnviar={handleSubmit}>
        <CajonCuerpo>
          <SeccionCajon>
            <div className="r2-campo">
              <span className="r2-campo-etiqueta" id="r2g-asignar-a">Asignar a</span>
              <Segmentado etiqueta="Asignar a" valor={tipoAsignacion} alCambiar={setTipoAsignacion}
                opciones={[{ valor: 'usuario', texto: 'Una persona' }, { valor: 'camioneta', texto: 'Una camioneta' }]} />
            </div>
            {tipoAsignacion === 'usuario' && (
              <Campo etiqueta="Persona" requerido>
                <Selector value={usuarioSeleccionado} onChange={(e) => setUsuarioSeleccionado(e.target.value)} required vacio="Elige a quién"
                  opciones={usuarios.filter((u) => u.activo).map((u) => ({ valor: u.id, texto: `${u.nombre} · ${u.puesto || nombreRol(u.rol)}` }))} />
              </Campo>
            )}
            {tipoAsignacion === 'camioneta' && (
              <Campo etiqueta="Camioneta" requerido>
                <Selector value={camionetaSeleccionada} onChange={(e) => setCamionetaSeleccionada(e.target.value)} required vacio="Elige la camioneta"
                  opciones={camionetas.filter((c) => c.activo).map((c) => ({ valor: c.id, texto: `${c.nombre}${c.matricula ? ` (${c.matricula})` : ''} · ${c.encargado?.nombre || 'sin encargado'}` }))} />
              </Campo>
            )}
            <Campo etiqueta="Devolver a más tardar" ayuda="Opcional. Fecha límite para devolver la herramienta." ancho="240px">
              <Entrada type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} min={hoyIso()} />
            </Campo>
            <Campo etiqueta="Notas">
              <Area rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas de la asignación" />
            </Campo>
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={UserCheck} cargando={loading}>Asignar herramienta</Boton>
        </CajonPie>
      </Formulario>
    </Cajon>
  );
}

// ───────── Devolver ─────────
export function CajonDevolver({ unidad, onClose, observaciones, setObservaciones, loading, handleSubmit }) {
  return (
    <Cajon abierto alCerrar={onClose} etiqueta="Devolver herramienta">
      <CajonCabecera titulo="Devolver herramienta" dato={`${unidad.tipo?.nombre || 'Herramienta'} · ${unidad.codigo_unico}`} alCerrar={onClose} />
      <Formulario alEnviar={handleSubmit}>
        <CajonCuerpo>
          <SeccionCajon titulo="La tiene">
            <Datos columnas={2} datos={[
              unidad.usuarioAsignado && ['Persona', unidad.usuarioAsignado.nombre],
              unidad.camioneta && ['Camioneta', unidad.camioneta.nombre],
            ]} />
          </SeccionCajon>
          <SeccionCajon>
            <Campo etiqueta="¿En qué estado regresa?" ayuda="Por ejemplo: en buen estado, con desgaste normal o necesita mantenimiento.">
              <Area rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </Campo>
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={RotateCcw} cargando={loading}>Registrar devolución</Boton>
        </CajonPie>
      </Formulario>
    </Cajon>
  );
}

// ───────── Cambiar condición ─────────
export function CajonCondicion({
  unidad, onClose, condicionesDisponibles, nuevaCondicion, setNuevaCondicion, motivo, setMotivo, condicionActual, estatusActual, loading, handleSubmit,
}) {
  const [ct, ctono] = condicionDe(condicionActual);
  const [et, etono] = estatusDe(estatusActual);
  return (
    <Cajon abierto alCerrar={onClose} etiqueta="Cambiar la condición de la herramienta">
      <CajonCabecera titulo="Cambiar condición" dato={`${unidad.tipo?.nombre || 'Herramienta'} · ${unidad.codigo_unico}`} alCerrar={onClose} />
      <Formulario alEnviar={handleSubmit}>
        <CajonCuerpo>
          <SeccionCajon titulo="Hoy">
            <Datos columnas={2} datos={[['Condición', <Estado key="c" tono={ctono} texto={ct} />], ['Estatus', <Estado key="e" tono={etono} texto={et} />]]} />
          </SeccionCajon>
          <SeccionCajon titulo="Nueva condición">
            <Nota>Es el estado físico de la herramienta. Asignar y devolver no cambian aquí.</Nota>
            <div className="r2g-opciones" role="radiogroup" aria-label="Nueva condición">
              {condicionesDisponibles.map((c) => {
                const actual = c.value === condicionActual;
                const elegida = c.value === nuevaCondicion;
                const [texto, tono] = condicionDe(c.value);
                return (
                  <button key={c.value} type="button" role="radio" aria-checked={elegida} disabled={actual}
                    className={clases('r2g-opcion', elegida && 'r2g-opcion--elegida')} onClick={() => setNuevaCondicion(c.value)}>
                    <span className="r2g-opcion-marca" aria-hidden="true">{elegida && <Check size={16} />}</span>
                    <span className="r2g-celda-doble">
                      <span className="r2g-fuerte"><Estado tono={tono} texto={texto} />{actual && <span className="r2g-sec"> · la de hoy</span>}</span>
                      <span className="r2g-sec">{c.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Campo etiqueta="Motivo">
              <Area rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué cambia la condición" />
            </Campo>
            {estatusActual === 'asignado' && (
              <p className="r2g-aviso-linea"><Info size={16} aria-hidden="true" />Está asignada: cambiar la condición no cambia la asignación.</p>
            )}
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={Settings2} cargando={loading}
            deshabilitado={!nuevaCondicion || nuevaCondicion === condicionActual} motivo="Elige una condición distinta a la de hoy">
            Cambiar condición
          </Boton>
        </CajonPie>
      </Formulario>
    </Cajon>
  );
}

// ───────── Nuevo tipo de herramienta ─────────
export function CajonNuevoTipo({ onClose, formData, handleChange, categorias, ubicaciones, proveedores, loading, handleSubmit }) {
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta="Nuevo tipo de herramienta">
      <CajonCabecera titulo="Nuevo tipo de herramienta" dato="Se crean sus unidades con su código de barras" alCerrar={onClose} />
      <Formulario alEnviar={handleSubmit}>
        <CajonCuerpo>
          <SeccionCajon titulo="La herramienta">
            <Campo etiqueta="Nombre" requerido>
              <Entrada type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej. Pistola de pintar" required />
            </Campo>
            <Campo etiqueta="Descripción">
              <Area rows={2} name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Opcional" />
            </Campo>
            <div className="r2g-campos-dos">
              <Campo etiqueta="Categoría" requerido>
                <Selector name="categoria_id" value={formData.categoria_id} onChange={handleChange} required vacio="Elige la categoría"
                  opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))} />
              </Campo>
              <Campo etiqueta="Ubicación" requerido>
                <Selector name="ubicacion_id" value={formData.ubicacion_id} onChange={handleChange} required vacio="Elige la ubicación"
                  opciones={ubicaciones.map((u) => ({ valor: u.id, texto: u.nombre }))} />
              </Campo>
            </div>
            <Campo etiqueta="Proveedor" ayuda="Opcional">
              <Selector name="proveedor_id" value={formData.proveedor_id} onChange={handleChange} vacio="Sin proveedor"
                opciones={proveedores.filter((x) => x.activo).map((x) => ({ valor: x.id, texto: x.nombre }))} />
            </Campo>
          </SeccionCajon>
          <SeccionCajon titulo="Unidades y precio">
            <div className="r2g-campos-dos">
              <Campo etiqueta="Precio por unidad" requerido ancho="220px">
                <Entrada type="number" name="precio_unitario" value={formData.precio_unitario} onChange={handleChange} step="0.01" min="0" placeholder="0.00" inputMode="decimal" required className="r2g-entrada-num" />
              </Campo>
              <Campo etiqueta="Cuántas unidades" requerido ancho="220px">
                <Entrada type="number" name="cantidad_unidades" value={formData.cantidad_unidades} onChange={handleChange} min="1" placeholder="1" inputMode="numeric" required className="r2g-entrada-num" />
              </Campo>
            </div>
            <div className="r2g-campos-dos">
              <Campo etiqueta="Prefijo del código" ayuda="Hasta 3 letras. Si lo dejas vacío, se genera solo." ancho="220px">
                <Entrada type="text" name="prefijo_codigo" value={formData.prefijo_codigo} onChange={handleChange} maxLength="3" placeholder="Ej. PP" />
              </Campo>
              <Campo etiqueta="Dirección de la imagen" ayuda="Opcional">
                <Entrada type="url" name="imagen_url" value={formData.imagen_url} onChange={handleChange} placeholder="https://…" />
              </Campo>
            </div>
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={Plus} cargando={loading}>Crear tipo</Boton>
        </CajonPie>
      </Formulario>
    </Cajon>
  );
}
