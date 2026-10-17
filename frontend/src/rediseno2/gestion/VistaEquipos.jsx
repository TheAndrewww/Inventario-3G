// Rediseño 2 · Gestión · Equipos (/camionetas), vista ENCENDIDA. Dirección, por mes: revisar que cada camioneta tenga lo
// mínimo, configurar mínimos y checklist, dar de alta o editar equipos.
// Antes: 5 tarjetas de 365 × 330 con cajas dentro, «Mínimos» y «Checklist» escondidos tras «⋮» y la placa sin mostrar.
// Ahora: una tabla de un renglón por equipo con «Inventario», «Mínimos» y «Checklist» a la vista; «Editar» y «Eliminar» en
// «⋯»; el formulario en un cajón. Los diálogos (inventario, mínimos, checklist y catálogo) son los de siempre: cada uno
// pinta su vista nueva encendido. Todo el estado y los manejadores son los de CamionetasPage.
import { Plus, ClipboardList, Package, Settings, ClipboardCheck, Pencil, Trash2, Briefcase } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Tabla, Boton, Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Campo, Entrada, Selector, Area,
  Nota, plural, useEsCelular,
} from '../fundacion';
import { motivoError } from './comunes';
import './gestion.css';

const TIPOS = { instalacion: 'Instalación', mantenimiento: 'Mantenimiento', supervision: 'Supervisión', general: 'General' };

export default function VistaEquipos(p) {
  const {
    camionetas, encargados, ubicaciones, cargando, errorCarga, recargar, mostrarModal, camionetaEditando, formData, setFormData,
    abrirModalNuevo, abrirModalEditar, cerrarModal, handleSubmit, handleEliminar, abrirInventario, abrirConfiguracion,
    setMostrarChecklistManager, setEquipoChecklist, dialogos,
  } = p;
  const celular = useEsCelular();

  const columnas = [
    {
      id: 'equipo', titulo: 'Equipo',
      celda: (c) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{c.nombre}</span>
          {c.descripcion && <span className="r2g-sec r2g-una-linea" title={c.descripcion}>{c.descripcion}</span>}
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', ancho: '140px', celda: (c) => TIPOS[c.tipo_camioneta] || TIPOS.general },
    { id: 'placa', titulo: 'Placa', ancho: '120px', ocultarEn: 'celular-ancho', celda: (c) => (c.matricula ? <span className="r2g-clave">{c.matricula}</span> : <span className="r2g-sec">—</span>) },
    { id: 'encargado', titulo: 'Encargado', celda: (c) => c.encargado?.nombre || <span className="r2g-sec">Sin asignar</span> },
    // Error de hoy (anexo B, 3): el servidor no manda el nombre del almacén base; se pinta «—» cuando no viene
    { id: 'almacen', titulo: 'Almacén base', ocultarEn: 'tableta', celda: (c) => c.almacenBase?.nombre || <span className="r2g-sec">—</span> },
  ];

  const accion = (c) => (
    <span className="r2g-acciones-celda">
      <Boton nivel="fantasma" tamano="chico" icono={Package} alHacer={() => abrirInventario(c)}>Inventario</Boton>
      <Boton nivel="fantasma" tamano="chico" icono={Settings} alHacer={() => abrirConfiguracion(c)}>Mínimos</Boton>
      <Boton nivel="fantasma" tamano="chico" icono={ClipboardCheck} alHacer={() => setEquipoChecklist(c)}>Checklist</Boton>
    </span>
  );
  const masAcciones = (c) => [
    { texto: 'Editar equipo', icono: Pencil, alHacer: () => abrirModalEditar(c) },
    { texto: 'Eliminar equipo', icono: Trash2, peligro: true, alHacer: () => handleEliminar(c.id) },
  ];

  return (
    <Pagina className="r2g-pagina" titulo="Equipos" densidad="comoda">
      <EncabezadoPagina titulo="Equipos" dato={camionetas.length ? plural(camionetas.length, 'equipo', 'equipos') : undefined}
        secundarias={[{ texto: 'Catálogo del checklist', icono: ClipboardList, alHacer: () => setMostrarChecklistManager(true) }]}
        principal={{ texto: 'Nuevo equipo', corto: 'Nuevo', icono: Plus, alHacer: abrirModalNuevo }} />

      <Tabla etiqueta="Equipos" clave="id" columnas={columnas} filas={camionetas}
        alAbrir={abrirInventario} etiquetaAbrir={(c) => `${c.nombre}: ver su inventario`}
        accion={celular ? undefined : accion} masAcciones={(c) => [
          // En el celular el renglón abre el inventario y lo demás va en «⋯»
          celular && { texto: 'Configurar mínimos', icono: Settings, alHacer: () => abrirConfiguracion(c) },
          celular && { texto: 'Checklist del equipo', icono: ClipboardCheck, alHacer: () => setEquipoChecklist(c) },
          ...masAcciones(c),
        ]}
        filaCelular={(c) => ({
          principal: c.nombre,
          secundario: [TIPOS[c.tipo_camioneta] || TIPOS.general, c.matricula, c.encargado?.nombre || 'Sin encargado'].filter(Boolean).join(' · '),
        })}
        cargando={cargando && !camionetas.length}
        error={errorCarga && !camionetas.length ? { mensaje: 'No se pudieron cargar los equipos.', motivo: motivoError(errorCarga), alReintentar: recargar } : undefined}
        vacio={{ icono: Briefcase, titulo: 'No hay equipos registrados', texto: 'Registra el primer equipo para llevar su inventario, sus mínimos y su checklist.', accion: { texto: 'Nuevo equipo', icono: Plus, alHacer: abrirModalNuevo } }} />
      {camionetas.length > 0 && (
        <Nota className="r2g-nota-pie">Toca un equipo para ver su inventario. «Eliminar» lo marca como inactivo: no se borra.</Nota>
      )}

      {/* Nuevo / editar equipo: los mismos campos y el mismo envío (handleSubmit) */}
      <Cajon abierto={mostrarModal} alCerrar={cerrarModal} etiqueta={camionetaEditando ? 'Editar equipo' : 'Nuevo equipo'}>
        <CajonCabecera titulo={camionetaEditando ? 'Editar equipo' : 'Nuevo equipo'} dato={camionetaEditando ? camionetaEditando.nombre : 'Completa los datos del equipo'} alCerrar={cerrarModal} />
        <form className="r2g-form-cajon" onSubmit={handleSubmit}>
          <CajonCuerpo>
            <SeccionCajon>
              <Campo etiqueta="Nombre del equipo" requerido>
                <Entrada type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Área Norte 1" required />
              </Campo>
              <div className="r2g-campos-dos">
                <Campo etiqueta="Tipo de equipo" requerido>
                  <Selector value={formData.tipo_camioneta} onChange={(e) => setFormData({ ...formData, tipo_camioneta: e.target.value })} required
                    opciones={[{ valor: 'general', texto: 'General' }, { valor: 'instalacion', texto: 'Instalación' }, { valor: 'mantenimiento', texto: 'Mantenimiento' }, { valor: 'supervision', texto: 'Supervisión' }]} />
                </Campo>
                <Campo etiqueta="Encargado" requerido error={encargados.length === 0 ? 'No hay encargados disponibles. Crea un usuario con rol encargado primero.' : undefined}>
                  <Selector value={formData.encargado_id} onChange={(e) => setFormData({ ...formData, encargado_id: e.target.value })} required vacio="Elige un encargado"
                    opciones={encargados.map((e) => ({ valor: e.id, texto: e.nombre }))} />
                </Campo>
              </div>
              <Campo etiqueta="Almacén base" ayuda="Almacén de donde parte el equipo">
                <Selector value={formData.almacen_base_id} onChange={(e) => setFormData({ ...formData, almacen_base_id: e.target.value })} vacio="Sin almacén base"
                  opciones={ubicaciones.map((u) => ({ valor: u.id, texto: u.nombre }))} />
              </Campo>
              <Campo etiqueta="Descripción">
                <Area rows={3} value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Para qué se usa este equipo" />
              </Campo>
            </SeccionCajon>
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="fantasma" alHacer={cerrarModal}>Cancelar</Boton>
            <Boton nivel="principal" tipo="submit">{camionetaEditando ? 'Guardar cambios' : 'Crear equipo'}</Boton>
          </CajonPie>
        </form>
      </Cajon>

      {dialogos}
    </Pagina>
  );
}
