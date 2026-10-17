// Rediseño 2 · Gestión · Proveedores (/proveedores), vista ENCENDIDA. Compras (a diario) y encargados (editan): encontrar
// un proveedor, ver y corregir sus datos y su ficha maestra.
// Antes: una caja azul fija «Crédito, pagos y contacto para Julia» encima de todo, «Editar» de color en cada renglón y un
// diálogo de 1,400 px con campos de 1,360 px. Ahora: una línea con «Saber más», la búsqueda primero, una tabla donde todo el
// renglón abre la FICHA del proveedor en un cajón (con «Editar» arriba) y el formulario en un cajón con campos a su medida.
// Mismos datos, mismas fichas, mismo reporte «Sin RFC» y el mismo guardado de ProveedoresPage.
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Landmark, ExternalLink, Truck } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Pestanas, BarraFiltros, Tabla, Estado, Boton, MenuAcciones, Cajon, CajonCabecera, CajonDecision, CajonCuerpo,
  CajonPie, SeccionCajon, Campo, Entrada, Area, Datos, plural, useEsCelular,
} from '../fundacion';
import { FichaMaestraFormulario, FichaMaestraLectura, ReporteSinRfcR2 } from './FichaMaestra';
import { tieneRfc, creditoDe, textoCredito } from '../../components/proveedores/fichaDatos';
import { motivoError } from './comunes';
import './gestion.css';

// La liga a Finanzas (la misma regla de la página: solo si una página con sesión la configuró)
function LigaFinanzas({ urlFinanzas }) {
  const [url, setUrl] = useState(urlFinanzas);
  useEffect(() => {
    const actualizar = () => setUrl(urlFinanzas());
    window.addEventListener('g3:sistemas', actualizar);
    return () => window.removeEventListener('g3:sistemas', actualizar);
  }, [urlFinanzas]);
  return url
    ? <Boton nivel="tonal" tamano="chico" icono={ExternalLink} href={url}>Abrir en Finanzas</Boton>
    : <span className="r2g-sec">Ábrela desde Inicio 3G › Proveedores.</span>;
}

export default function VistaProveedores(p) {
  const {
    proveedores, loading, errorCarga, recargar, searchTerm, setSearchTerm, filteredProveedores, showModal, editingProveedor, formData,
    handleInputChange, handleOpenModal, handleCloseModal, handleSubmit, handleDelete, puedeEditar, fichas, credito, fichasListas, vista,
    verVista, reporte, cargandoReporte, errorReporte, cargarReporte, abrirFicha, fichaForm, setFichaForm, urlFinanzas,
  } = p;
  const [abiertoId, setAbiertoId] = useState(null); // ficha abierta (solo lectura, con «Editar» arriba)
  const [saberMas, setSaberMas] = useState(false);
  const celular = useEsCelular();
  const abierto = proveedores.find((x) => x.id === abiertoId) || null;
  const sinRfc = proveedores.filter((x) => !tieneRfc(x, fichas[x.id])).length;
  const editar = (prov) => { setAbiertoId(null); handleOpenModal(prov); };

  const rfcDe = (x) => {
    if (x.rfc) return <span className="r2g-clave">{x.rfc}</span>;
    const deFicha = (fichas[x.id]?.razonesSociales || []).find((r) => r.rfc);
    if (deFicha) return <span className="r2g-celda-doble"><span className="r2g-clave">{deFicha.rfc}</span><span className="r2g-sec">de su razón social</span></span>;
    return <Estado tono="aviso" texto="Sin RFC" />;
  };

  const columnas = [
    {
      id: 'nombre', titulo: 'Proveedor',
      celda: (x) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{x.nombre}</span>
          {fichas[x.id]?.nombreCorto && <span className="r2g-sec">{fichas[x.id].nombreCorto}</span>}
        </span>
      ),
    },
    { id: 'rfc', titulo: 'RFC', ancho: '170px', celda: rfcDe },
    { id: 'contacto', titulo: 'Contacto', celda: (x) => x.contacto || <span className="r2g-sec">—</span> },
    { id: 'telefono', titulo: 'Teléfono', ancho: '140px', celda: (x) => (x.telefono ? <span className="r2g-num">{x.telefono}</span> : <span className="r2g-sec">—</span>) },
    { id: 'correo', titulo: 'Correo', ocultarEn: 'tableta', celda: (x) => (x.email ? <span className="r2g-una-linea" title={x.email}>{x.email}</span> : <span className="r2g-sec">—</span>) },
    {
      id: 'credito', titulo: 'Crédito', ancho: '170px', ocultarEn: 'celular-ancho',
      celda: (x) => { const c = creditoDe(credito, x.id); return c ? <span title={`CTAS CRÉDITO · pestaña «${c.pestana}»`}>{textoCredito(c)}</span> : <span className="r2g-sec">—</span>; },
    },
  ];
  const masAcciones = (x) => [
    { texto: 'Editar proveedor', icono: Pencil, alHacer: () => editar(x) },
    { texto: 'Eliminar proveedor', icono: Trash2, peligro: true, alHacer: () => handleDelete(x.id) },
  ];

  const lista = (
    <>
      <BarraFiltros busqueda={{ valor: searchTerm, alCambiar: setSearchTerm, texto: celular ? 'Buscar' : 'Buscar por nombre, RFC o contacto', etiqueta: 'Buscar por nombre, RFC o contacto', autoFoco: true }}
        activos={searchTerm ? 1 : 0} alQuitar={() => setSearchTerm('')} resultados={filteredProveedores.length} />
      <Tabla etiqueta="Proveedores" clave="id" columnas={columnas} filas={filteredProveedores} densidad="compacta"
        alAbrir={(x) => setAbiertoId(x.id)} etiquetaAbrir={(x) => `Ver la ficha de ${x.nombre}`} seleccionada={abiertoId}
        masAcciones={masAcciones}
        filaCelular={(x) => {
          const c = creditoDe(credito, x.id);
          return {
            principal: x.nombre,
            secundario: [c ? textoCredito(c) : null, x.contacto, x.telefono].filter(Boolean).join(' · ') || 'Sin contacto',
            debajo: !tieneRfc(x, fichas[x.id]) ? <Estado tono="aviso" texto="Sin RFC" /> : null,
          };
        }}
        cargando={loading && !proveedores.length}
        error={errorCarga && !proveedores.length ? { mensaje: 'No se pudieron cargar los proveedores.', motivo: motivoError(errorCarga), alReintentar: recargar } : undefined}
        vacio={proveedores.length === 0
          ? { icono: Truck, titulo: 'No hay proveedores', texto: 'Da de alta el primero para poder hacerle órdenes de compra.', accion: { texto: 'Nuevo proveedor', icono: Plus, alHacer: () => handleOpenModal() } }
          : { sinResultados: true, busqueda: searchTerm, alQuitar: () => setSearchTerm('') }} />
    </>
  );

  return (
    <Pagina className="r2g-pagina" titulo="Proveedores" densidad="compacta">
      <EncabezadoPagina titulo="Proveedores" pestanas="seccion" dato={plural(proveedores.length, 'proveedor', 'proveedores')}
        principal={{ texto: 'Nuevo proveedor', corto: 'Nuevo', icono: Plus, alHacer: () => handleOpenModal() }} />

      <div className="r2g-ayuda-linea">
        <p className="r2g-linea">
          {!celular && <Landmark size={16} aria-hidden="true" className="r2g-ayuda-icono" />}
          {/* Celular: una línea corta para que la lista quede arriba; «Saber más» abre lo mismo */}
          {celular ? 'El crédito y los pagos se llevan en Finanzas.' : 'El crédito y los pagos los lleva Contabilidad en Finanzas; aquí quedan los datos y la ficha para Julia.'}
          <button type="button" className="r2g-enlace" aria-expanded={saberMas} onClick={() => setSaberMas((v) => !v)}>{saberMas ? 'Ocultar' : 'Saber más'}</button>
        </p>
        {saberMas && (
          <div className="r2g-ayuda-detalle">
            <p className="r2g-parrafo">El crédito y el plazo de cada proveedor los lleva Contabilidad en Finanzas › Por pagar › Proveedores a crédito. Aquí quedan sus datos y artículos.</p>
            <LigaFinanzas urlFinanzas={urlFinanzas} />
          </div>
        )}
      </div>

      {puedeEditar && (
        <Pestanas etiqueta="Proveedores" valor={vista} alCambiar={verVista} className="r2g-pestanas-pagina"
          pestanas={[{ id: 'lista', texto: 'Proveedores', cuenta: proveedores.length }, { id: 'sinrfc', texto: 'Sin RFC', cuenta: sinRfc }]} />
      )}

      {puedeEditar && vista === 'sinrfc'
        ? <ReporteSinRfcR2 reporte={reporte} cargando={cargandoReporte} error={errorReporte} onReintentar={cargarReporte} onAbrir={abrirFicha} />
        : lista}

      {/* Ficha del proveedor (lectura): todo lo que ya llegó, con «Editar» arriba */}
      <Cajon abierto={!!abierto} alCerrar={() => setAbiertoId(null)} ancho="ancho" etiqueta={abierto ? `Ficha de ${abierto.nombre}` : 'Ficha'}>
        {abierto && (
          <>
            <CajonCabecera titulo={abierto.nombre} dato={fichas[abierto.id]?.nombreCorto}
              estado={!tieneRfc(abierto, fichas[abierto.id]) ? <Estado tono="aviso" texto="Sin RFC" /> : null} alCerrar={() => setAbiertoId(null)} />
            <CajonDecision>
              <Boton nivel="principal" icono={Pencil} alHacer={() => editar(abierto)}>Editar proveedor</Boton>
              <MenuAcciones titulo={abierto.nombre} acciones={[{ texto: 'Eliminar proveedor', icono: Trash2, peligro: true, alHacer: () => { setAbiertoId(null); handleDelete(abierto.id); } }]} />
            </CajonDecision>
            <CajonCuerpo>
              <SeccionCajon titulo="Datos">
                <Datos columnas={2} datos={[['RFC', abierto.rfc], ['Contacto', abierto.contacto], ['Teléfono', abierto.telefono], ['Correo', abierto.email]]} />
              </SeccionCajon>
              <SeccionCajon titulo="Dirección">
                <Datos columnas={2} datos={[
                  { etiqueta: 'Calle y número', valor: abierto.direccion, ancho: 'doble' },
                  ['Ciudad', abierto.ciudad], ['Estado', abierto.estado], ['Código postal', abierto.codigo_postal],
                ]} />
              </SeccionCajon>
              {abierto.notas && (
                <SeccionCajon titulo="Notas"><p className="r2g-parrafo">{abierto.notas}</p></SeccionCajon>
              )}
              {fichasListas && <FichaMaestraLectura ficha={fichas[abierto.id]} credito={creditoDe(credito, abierto.id)} />}
            </CajonCuerpo>
          </>
        )}
      </Cajon>

      {/* Nuevo / editar: los mismos campos y el mismo guardado (handleSubmit), con la ficha maestra para quien edita */}
      <Cajon abierto={showModal} alCerrar={handleCloseModal} ancho="ancho" etiqueta={editingProveedor ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <CajonCabecera titulo={editingProveedor ? 'Editar proveedor' : 'Nuevo proveedor'} dato={editingProveedor?.nombre} alCerrar={handleCloseModal} />
        <form className="r2g-form-cajon" onSubmit={handleSubmit}>
          <CajonCuerpo>
            <SeccionCajon titulo="Datos fiscales">
              <Campo etiqueta="Nombre o razón social" requerido>
                <Entrada type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder="Como aparece en sus facturas" required />
              </Campo>
              <Campo etiqueta="RFC" ancho="220px">
                <Entrada type="text" name="rfc" value={formData.rfc} onChange={handleInputChange} placeholder="12 o 13 caracteres" maxLength={13} />
              </Campo>
            </SeccionCajon>
            <SeccionCajon titulo="Contacto">
              <div className="r2g-campos-dos">
                <Campo etiqueta="Persona de contacto">
                  <Entrada type="text" name="contacto" value={formData.contacto} onChange={handleInputChange} />
                </Campo>
                <Campo etiqueta="Teléfono" ancho="220px">
                  <Entrada type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} inputMode="tel" />
                </Campo>
              </div>
              <Campo etiqueta="Correo" ancho="420px">
                <Entrada type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="correo@ejemplo.com" />
              </Campo>
            </SeccionCajon>
            <SeccionCajon titulo="Dirección">
              <Campo etiqueta="Calle, número y colonia">
                <Entrada type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} />
              </Campo>
              <div className="r2g-campos-tres">
                <Campo etiqueta="Ciudad"><Entrada type="text" name="ciudad" value={formData.ciudad} onChange={handleInputChange} /></Campo>
                <Campo etiqueta="Estado"><Entrada type="text" name="estado" value={formData.estado} onChange={handleInputChange} /></Campo>
                <Campo etiqueta="Código postal"><Entrada type="text" name="codigo_postal" value={formData.codigo_postal} onChange={handleInputChange} maxLength={10} inputMode="numeric" /></Campo>
              </div>
            </SeccionCajon>
            <SeccionCajon titulo="Notas">
              <Area name="notas" rows={3} value={formData.notas} onChange={handleInputChange} placeholder="Lo que conviene saber de este proveedor" />
            </SeccionCajon>
            {puedeEditar && fichaForm && (
              <FichaMaestraFormulario valor={fichaForm} onCambio={setFichaForm} credito={editingProveedor ? creditoDe(credito, editingProveedor.id) : null}
                rfcPrincipal={formData.rfc?.trim() || null} />
            )}
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="fantasma" alHacer={handleCloseModal}>Cancelar</Boton>
            <Boton nivel="principal" tipo="submit">{editingProveedor ? 'Guardar proveedor' : 'Crear proveedor'}</Boton>
          </CajonPie>
        </form>
      </Cajon>
    </Pagina>
  );
}
