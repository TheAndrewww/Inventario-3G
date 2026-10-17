// Rediseño 2 · Gestión · Usuarios (/usuarios), vista ENCENDIDA. Dirección, por mes: dar de alta, cambiar rol, desactivar,
// reactivar y (con Cuenta 3G) ver quién falta por entrar.
// Antes: «Editar» lleno en cada renglón + «⋮» + círculo de inicial + insignia de rol + «Activo» repetido; el filtro de rol en
// un menú de 365 px y «Ver inactivos» en otra franja; orden por alta. Ahora: una sola fila de filtros (búsqueda, rol e
// «Inactivos»), una tabla limpia por nombre donde el renglón abre el formulario, y lo raro en «⋯». Mismo estado, mismas
// confirmaciones y las mismas peticiones de UsuariosPage.
import { useMemo, useState } from 'react';
import { UserPlus, Pencil, UserX, RotateCcw, Trash2, Users, ExternalLink } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Pestanas, BarraFiltros, ChipFiltro, FiltroMenu, Tabla, Estado, Boton, Cajon, CajonCabecera, CajonCuerpo, CajonPie,
  SeccionCajon, Campo, Entrada, Selector, Casilla, Nota, Seccion, Fecha, plural, numero, useEsCelular,
} from '../fundacion';
import { nombreRol, motivoError } from './comunes';
import './gestion.css';

// Los mismos roles que ofrece hoy el filtro y el formulario
const ROLES_FORM = ['administrador', 'encargado', 'diseñador', 'almacen', 'compras'];

export default function VistaUsuarios(p) {
  const {
    usuarios, cargando, errorCarga, recargar, busqueda, setBusqueda, filtroRol, setFiltroRol, mostrarInactivos, setMostrarInactivos,
    usuariosFiltrados, totalInactivos, mostrarModal, usuarioEditando, formData, setFormData, abrirModalNuevo, abrirModalEditar, cerrarModal,
    handleSubmit, handleEliminar, handleReactivar, handleEliminarPermanente, reporteC3g,
  } = p;
  const [pestana, setPestana] = useState('usuarios');
  const celular = useEsCelular();
  const ordenados = useMemo(() => [...usuariosFiltrados].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' })), [usuariosFiltrados]);
  const activos = usuarios.filter((u) => u.activo).length;
  const quitarFiltros = () => { setBusqueda(''); setFiltroRol(''); setMostrarInactivos(false); };
  const puestos = (busqueda ? 1 : 0) + (filtroRol ? 1 : 0) + (mostrarInactivos ? 1 : 0);

  const columnas = [
    { id: 'nombre', titulo: 'Nombre', celda: (u) => <span className="r2g-fuerte">{u.nombre}</span> },
    { id: 'correo', titulo: 'Correo', celda: (u) => <span className="r2g-una-linea" title={u.email}>{u.email}</span> },
    { id: 'rol', titulo: 'Rol', ancho: '140px', celda: (u) => nombreRol(u.rol) },
    { id: 'puesto', titulo: 'Puesto', ocultarEn: 'celular-ancho', celda: (u) => u.puesto || <span className="r2g-sec">—</span> },
    { id: 'telefono', titulo: 'Teléfono', ancho: '140px', ocultarEn: 'tableta', celda: (u) => (u.telefono ? <span className="r2g-num">{u.telefono}</span> : <span className="r2g-sec">—</span>) },
    // «Activo» no se pinta: la columna solo aparece cuando se ven los inactivos
    mostrarInactivos && { id: 'estado', titulo: 'Estado', ancho: '110px', celda: (u) => (u.activo ? 'Activo' : <Estado dominio="usuario" valor="inactivo" />) },
  ].filter(Boolean);
  const masAcciones = (u) => (u.activo
    ? [{ texto: 'Editar', icono: Pencil, alHacer: () => abrirModalEditar(u) }, { texto: 'Desactivar usuario', icono: UserX, peligro: true, alHacer: () => handleEliminar(u.id) }]
    : [{ texto: 'Editar', icono: Pencil, alHacer: () => abrirModalEditar(u) }, { texto: 'Eliminar permanentemente', icono: Trash2, peligro: true, alHacer: () => handleEliminarPermanente(u) }]);

  const opcionesRol = [...ROLES_FORM, ...(formData.rol && !ROLES_FORM.includes(formData.rol) ? [formData.rol] : [])];

  const tabla = (
    <>
      <BarraFiltros busqueda={{ valor: busqueda, alCambiar: setBusqueda, texto: celular ? 'Buscar' : 'Buscar por nombre o correo', etiqueta: 'Buscar por nombre o correo' }}
        filtros={[
          <FiltroMenu key="rol" etiqueta="Rol" valor={filtroRol} alCambiar={setFiltroRol}
            opciones={[{ valor: '', texto: 'Todos los roles' }, ...ROLES_FORM.map((r) => ({ valor: r, texto: nombreRol(r), cuenta: usuarios.filter((u) => u.rol === r && u.activo !== mostrarInactivos).length }))]} />,
          <ChipFiltro key="inactivos" texto="Inactivos" cuenta={totalInactivos} activo={mostrarInactivos} alCambiar={setMostrarInactivos} />,
        ]}
        activos={puestos} alQuitar={quitarFiltros} resultados={ordenados.length} />
      <p className="r2g-linea r2g-linea-tabla" aria-live="polite">
        {mostrarInactivos
          ? <>Mostrando <b>{plural(ordenados.length, 'usuario inactivo', 'usuarios inactivos')}</b></>
          : <>Mostrando <b>{plural(ordenados.length, 'usuario activo', 'usuarios activos')}</b>{totalInactivos > 0 ? ` · ${plural(totalInactivos, 'inactivo oculto', 'inactivos ocultos')}` : ''}</>}
        {' '}· ordenados por nombre
      </p>
      <Tabla etiqueta={mostrarInactivos ? 'Usuarios inactivos' : 'Usuarios'} clave="id" columnas={columnas} filas={ordenados} densidad="compacta"
        alAbrir={abrirModalEditar} etiquetaAbrir={(u) => `Editar a ${u.nombre}`}
        accion={(u) => (u.activo ? null : <Boton nivel="tonal" tamano="chico" icono={RotateCcw} alHacer={() => handleReactivar(u.id)}>Reactivar</Boton>)}
        masAcciones={masAcciones}
        filaCelular={(u) => ({
          principal: u.nombre,
          secundario: [nombreRol(u.rol), u.puesto, u.email].filter(Boolean).join(' · '),
          debajo: u.activo ? null : <Estado dominio="usuario" valor="inactivo" />,
        })}
        cargando={cargando && !usuarios.length}
        error={errorCarga && !usuarios.length ? { mensaje: 'No se pudieron cargar los usuarios.', motivo: motivoError(errorCarga), alReintentar: recargar } : undefined}
        vacio={usuarios.length === 0
          ? { icono: Users, titulo: 'No hay usuarios', texto: 'Da de alta a la primera persona.', accion: { texto: 'Nuevo usuario', icono: UserPlus, alHacer: abrirModalNuevo } }
          : (!busqueda && !filtroRol && mostrarInactivos)
            ? { titulo: 'No hay usuarios inactivos', texto: 'Cuando desactives a alguien aparecerá aquí para reactivarlo.', accion: { texto: 'Ver activos', alHacer: () => setMostrarInactivos(false) } }
            : { sinResultados: true, busqueda: busqueda || undefined, alQuitar: quitarFiltros }} />
    </>
  );

  return (
    <Pagina className="r2g-pagina" titulo="Usuarios" densidad="compacta">
      <EncabezadoPagina titulo="Usuarios" dato={usuarios.length ? `${plural(activos, 'activo', 'activos')}${totalInactivos && !celular ? ` · ${plural(totalInactivos, 'inactivo', 'inactivos')}` : ''}` : undefined}
        principal={{ texto: 'Nuevo usuario', corto: 'Nuevo', icono: UserPlus, alHacer: abrirModalNuevo }} />
      {reporteC3g && (
        <Pestanas etiqueta="Usuarios" valor={pestana} alCambiar={setPestana} className="r2g-pestanas-pagina"
          pestanas={[{ id: 'usuarios', texto: 'Usuarios', cuenta: activos }, { id: 'c3g', texto: 'Cuenta 3G', cuenta: reporteC3g.faltan.length || undefined }]} />
      )}
      {reporteC3g && pestana === 'c3g' ? <ReporteCuenta3G r={reporteC3g} /> : tabla}

      {/* Nuevo / editar: los mismos campos y el mismo envío (handleSubmit) */}
      <Cajon abierto={mostrarModal} alCerrar={cerrarModal} etiqueta={usuarioEditando ? 'Editar usuario' : 'Nuevo usuario'}>
        <CajonCabecera titulo={usuarioEditando ? 'Editar usuario' : 'Nuevo usuario'} dato={usuarioEditando ? usuarioEditando.email : 'Completa los datos de la persona'} alCerrar={cerrarModal} />
        <form className="r2g-form-cajon" onSubmit={handleSubmit}>
          <CajonCuerpo>
            {reporteC3g && !usuarioEditando && (
              <SeccionCajon>
                <Nota>Para que entre con su cuenta 3G, dale de alta también en Cuentas 3G › Personas con este mismo correo (o anótalo como «correo en Planta» en su ficha). La contraseña solo sirve para el acceso de siempre.</Nota>
              </SeccionCajon>
            )}
            <SeccionCajon>
              <Campo etiqueta="Nombre completo" requerido>
                <Entrada type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Juan Pérez" required />
              </Campo>
              <Campo etiqueta="Correo" requerido>
                <Entrada type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="usuario@ejemplo.com" required />
              </Campo>
              <Campo etiqueta="Contraseña" requerido={!usuarioEditando} ayuda={usuarioEditando ? 'Déjala vacía para no cambiarla.' : undefined}>
                <Entrada type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!usuarioEditando} />
              </Campo>
              <div className="r2g-campos-dos">
                <Campo etiqueta="Rol" requerido>
                  <Selector value={formData.rol} onChange={(e) => setFormData({ ...formData, rol: e.target.value })} required vacio="Elige un rol"
                    opciones={opcionesRol.map((r) => ({ valor: r, texto: nombreRol(r) }))} />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Entrada type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="10 dígitos" inputMode="tel" />
                </Campo>
              </div>
              <Campo etiqueta="Puesto">
                <Entrada type="text" value={formData.puesto} onChange={(e) => setFormData({ ...formData, puesto: e.target.value })} placeholder="Ej. Gerente de operaciones" />
              </Campo>
              {usuarioEditando && (
                <Casilla marcada={formData.activo} alCambiar={(v) => setFormData({ ...formData, activo: v })} texto="Usuario activo" />
              )}
            </SeccionCajon>
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="fantasma" alHacer={cerrarModal}>Cancelar</Boton>
            <Boton nivel="principal" tipo="submit">{usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}</Boton>
          </CajonPie>
        </form>
      </Cajon>
    </Pagina>
  );
}

// Cuenta 3G: quién falta por entrar (solo con Cuentas 3G encendido; mismos datos del reporte)
function ReporteCuenta3G({ r }) {
  return (
    <div className="r2g-reporte">
      <p className="r2g-linea r2g-reporte-resumen">
        <Estado tono={r.faltan.length ? 'aviso' : 'ok'} texto={r.faltan.length ? `Faltan ${numero(r.faltan.length)}` : 'Ya entraron todos'} />
        <span><b>{numero(r.conCuenta)}</b> de {numero(r.activos)} usuarios activos ya entraron a Planta con su cuenta 3G.</span>
      </p>
      <Nota>Planta pasa a «solo cuenta 3G» cuando esta lista queda vacía. Modo de hoy: {r.modo === 'solo' ? 'solo cuenta 3G' : 'cuenta 3G y acceso de siempre'}.</Nota>
      {r.lista?.vieja && <p className="r2g-aviso-linea r2g-aviso-linea--aviso">La lista de Cuentas 3G no se actualiza desde hace más de 24 horas. Las sesiones siguen; avisa a Dirección para revisar Cuentas 3G.</p>}
      {r.emergencia && <p className="r2g-aviso-linea r2g-aviso-linea--aviso">La llave de emergencia está puesta: Dirección puede entrar con su contraseña. Quítala en cuanto Cuentas 3G responda.</p>}
      {r.emergencias.length > 0 && (
        <p className="r2g-linea">Entradas de emergencia en los últimos 30 días: <b>{numero(r.emergencias.length)}</b> · última: {r.emergencias[0].usuario}, <Fecha valor={r.emergencias[0].cuando} /></p>
      )}
      {r.faltan.length > 0 && (
        <Seccion titulo="Quién falta" dato={numero(r.faltan.length)}>
          <Tabla etiqueta="Usuarios que faltan por entrar con su cuenta 3G" clave="id" densidad="compacta" fija={false} filas={r.faltan}
            columnas={[
              { id: 'nombre', titulo: 'Nombre', celda: (u) => <span className="r2g-fuerte">{u.nombre}</span> },
              { id: 'correo', titulo: 'Correo', celda: (u) => u.email },
              { id: 'rol', titulo: 'Rol', ancho: '160px', celda: (u) => nombreRol(u.rol) },
            ]}
            filaCelular={(u) => ({ principal: u.nombre, secundario: `${u.email} · ${nombreRol(u.rol)}` })} />
        </Seccion>
      )}
      <p className="r2g-linea">
        A las personas se les da (y se les quita) la entrada en Cuentas 3G › Personas. Aquí solo se elige su rol en Planta, con el mismo correo o con el «correo en Planta» de su ficha.
        {r.emisor && <> <a href={r.emisor} target="_blank" rel="noreferrer" className="r2g-enlace">Abrir Cuentas 3G <ExternalLink size={14} aria-hidden="true" /></a></>}
      </p>
    </div>
  );
}
