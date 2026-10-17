// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3, g3, g3Activo() en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Package, Landmark } from 'lucide-react';
import proveedoresService from '../services/proveedores.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import { useDiseno3G } from '../diseno-3g/useDiseno3G';
import CabG3 from '../diseno-3g/CabG3';
import MasAcciones from '../diseno-3g/MasAcciones';
import { g3Activo, confirmarG3, cx, etq } from '../diseno-3g/dialogosG3';
import { useAuth } from '../context/AuthContext';
import { SeccionFicha, ReporteSinRfc } from '../components/proveedores/FichaProveedor';
import {
  fichaVacia, fichaAFormulario, fichaParaGuardar, tieneRfc, creditoDe, textoCredito
} from '../components/proveedores/fichaDatos';
// Rediseño 2 · vista encendida (apagado no la usa): mismos datos, mismas fichas y el mismo guardado
import { useDiseno3G as useDiseno3GR2 } from '../rediseno2/fundacion/useDiseno3G';
import VistaProveedores from '../rediseno2/gestion/VistaProveedores';

// B3 paso 1 · PLA-11 (solo con Diseño 3G): liga a la otra mitad de «Proveedores», que vive en Finanzas.
// La dirección de Finanzas es privada: Planta no la escribe en su JS público. Si una página con sesión la configuró
// (G3.configurar), es enlace; si no, dice «Ábrela desde Inicio 3G», como el selector de apps.
const VISTA_FINANZAS = '/#vista=proveedores-a-credito';
const urlFinanzas = () => {
  try {
    const base = window.G3?.sistemas?.find((s) => s.id === 'finanzas')?.url;
    if (!base) return null;
    const url = new URL(VISTA_FINANZAS, base).toString();
    return window.G3?.urlCon ? window.G3.urlCon(url) : url;
  } catch { return null; }
};
const LigaCreditoFinanzas = () => {
  const [url, setUrl] = useState(urlFinanzas);
  useEffect(() => {
    const actualizar = () => setUrl(urlFinanzas());
    window.addEventListener('g3:sistemas', actualizar);
    return () => window.removeEventListener('g3:sistemas', actualizar);
  }, []);
  return (
    <div className="g3-caja g3-caja--info mb-6">
      <Landmark aria-hidden="true" />
      <div className="g3-caja-cuerpo">
        <strong>Crédito, pagos y contacto para Julia</strong>
        <span>El crédito y el plazo de cada proveedor los lleva Contabilidad en Finanzas › Por pagar › Proveedores a crédito. Aquí quedan sus datos y artículos.</span>
        <span>
          {url
            ? <a className="g3-btn g3-btn--tonal g3-btn--ch" href={url}>Abrir en Finanzas</a>
            : <span className="g3-tenue">Ábrela desde Inicio 3G › Proveedores.</span>}
        </span>
      </div>
    </div>
  );
};

const ProveedoresPage = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const g3 = useDiseno3G(); // Diseño 3G: encabezado, tabla en tarjetas, acciones y confirmación del paquete (apagado, lo de siempre)
  const [editingProveedor, setEditingProveedor] = useState(null);
  // B3 paso 3 · PLA-20 (solo Diseño 3G): ficha maestra, crédito de CTAS CRÉDITO y reporte sin RFC
  const { user } = useAuth();
  const puedeEditar = ['compras', 'encargado', 'administrador'].includes(user?.rol);
  const [fichas, setFichas] = useState({});
  const [credito, setCredito] = useState([]);
  const [vista, setVista] = useState('lista');
  const [reporte, setReporte] = useState(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [errorReporte, setErrorReporte] = useState(null);
  // null = las fichas no han llegado (o fallaron): el formulario se guarda como siempre y no pisa ninguna ficha
  const [fichaForm, setFichaForm] = useState(null);
  const [fichasListas, setFichasListas] = useState(false);
  const d3 = useDiseno3GR2(); // Rediseño 2: vista nueva encendida (abajo, antes del return de siempre)
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»
  const [formData, setFormData] = useState({
    nombre: '',
    rfc: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    estado: '',
    codigo_postal: '',
    notas: ''
  });

  useEffect(() => {
    fetchProveedores();
  }, []);

  // Las fichas y el crédito solo se piden con Diseño 3G (apagado, la pantalla pide lo mismo que siempre)
  const cargarFichas = async () => {
    try {
      const r = await proveedoresService.fichas();
      setFichas(r.data?.fichas || {});
      setCredito(r.data?.credito || []);
      setFichasListas(true);
    } catch (error) {
      console.error('Error al cargar las fichas de proveedores:', error);
    }
  };
  useEffect(() => {
    // VIEJO: se borra a partir del 24-oct-2026 — g3 siempre es true; lo que corre con g3 en false (después de este if o en su else) es lo viejo.
    if (g3) cargarFichas();
  }, [g3]);

  const cargarReporte = async () => {
    setCargandoReporte(true);
    setErrorReporte(null);
    try {
      const r = await proveedoresService.reporteSinRfc();
      setReporte(r.data);
    } catch (error) {
      console.error('Error al cargar el reporte sin RFC:', error);
      setErrorReporte('No se pudo cargar el reporte de proveedores sin RFC.');
    } finally {
      setCargandoReporte(false);
    }
  };
  const verVista = (v) => {
    setVista(v);
    if (v === 'sinrfc') cargarReporte();
  };

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const data = await proveedoresService.listar({ activo: true });
      setProveedores(data.data?.proveedores || []);
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Error al cargar proveedores');
      setErrorCargaR2(error?.message || 'Error al cargar proveedores');
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (proveedor = null) => {
    if (proveedor) {
      setEditingProveedor(proveedor);
      setFormData({
        nombre: proveedor.nombre || '',
        rfc: proveedor.rfc || '',
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
        ciudad: proveedor.ciudad || '',
        estado: proveedor.estado || '',
        codigo_postal: proveedor.codigo_postal || '',
        notas: proveedor.notas || ''
      });
      setFichaForm(fichasListas ? fichaAFormulario(fichas[proveedor.id]) : null);
    } else {
      setEditingProveedor(null);
      setFormData({
        nombre: '',
        rfc: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        estado: '',
        codigo_postal: '',
        notas: ''
      });
      setFichaForm(fichasListas ? fichaVacia() : null);
    }
    setShowModal(true);
  };

  // Desde el reporte: abre el formulario del proveedor con su ficha
  const abrirFicha = (id) => {
    const p = proveedores.find((x) => x.id === id);
    if (p) handleOpenModal(p);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProveedor(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    // B3 · PLA-20 (Diseño 3G): la ficha se guarda junto con los datos. Si ya existe, primero la ficha (si no pasa la
    // revisión, no se guarda nada); si es nuevo, primero el proveedor (para tener su id).
    if (g3 && puedeEditar && fichaForm) {
      try {
        const ficha = fichaParaGuardar(fichaForm);
        if (editingProveedor) {
          await proveedoresService.guardarFicha(editingProveedor.id, ficha);
          await proveedoresService.actualizar(editingProveedor.id, formData);
          toast.success('Proveedor y ficha guardados');
        } else {
          const creado = await proveedoresService.crear(formData);
          const id = creado?.data?.id;
          if (id) {
            try {
              await proveedoresService.guardarFicha(id, ficha);
            } catch (error) {
              toast.error(`Se creó el proveedor, pero la ficha no se guardó: ${error.response?.data?.message || error.message}`);
            }
          }
          toast.success('Proveedor creado');
        }
        handleCloseModal();
        fetchProveedores();
        cargarFichas();
        if (reporte) cargarReporte();
      } catch (error) {
        console.error('Error al guardar proveedor:', error);
        toast.error(error.response?.data?.message || error.message || 'Error al guardar proveedor');
      }
      return;
    }

    try {
      if (editingProveedor) {
        await proveedoresService.actualizar(editingProveedor.id, formData);
        toast.success('Proveedor actualizado exitosamente');
      } else {
        await proveedoresService.crear(formData);
        toast.success('Proveedor creado exitosamente');
      }
      handleCloseModal();
      fetchProveedores();
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      toast.error(error.message || 'Error al guardar proveedor');
    }
  };

  const handleDelete = async (id) => {
    if (g3Activo()) {
      // Vista previa con lo que ya está en pantalla; la petición de después es la misma
      const p = proveedores.find(x => x.id === id);
      if (!(await confirmarG3({
        titulo: '¿Eliminar este proveedor?',
        aviso: 'Se elimina de forma permanente. Si tiene artículos asociados, el sistema no lo deja eliminar.',
        datos: p ? [['Proveedor', p.nombre], ['RFC', p.rfc || 'N/A'], ['Contacto', p.contacto || 'N/A']] : [],
        confirmar: 'Eliminar proveedor', cancelar: 'No eliminar', peligro: true,
      }))) return;
    } else if (!window.confirm('¿Estás seguro de eliminar este proveedor?')) {
      return;
    }

    try {
      await proveedoresService.eliminar(id);
      toast.success('Proveedor eliminado exitosamente');
      fetchProveedores();
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      toast.error(error.message || 'Error al eliminar proveedor');
    }
  };

  const filteredProveedores = proveedores.filter((proveedor) =>
    proveedor.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.rfc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Rediseño 2 · vista ENCENDIDA: los mismos datos y los mismos manejadores (el JSX de hoy sigue intacto debajo)
  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
    return (
      <VistaProveedores
        proveedores={proveedores} loading={loading} errorCarga={errorCargaR2} recargar={fetchProveedores} searchTerm={searchTerm}
        setSearchTerm={setSearchTerm} filteredProveedores={filteredProveedores} showModal={showModal} editingProveedor={editingProveedor}
        formData={formData} handleInputChange={handleInputChange} handleOpenModal={handleOpenModal} handleCloseModal={handleCloseModal}
        handleSubmit={handleSubmit} handleDelete={handleDelete} puedeEditar={puedeEditar} fichas={fichas} credito={credito}
        fichasListas={fichasListas} vista={vista} verVista={verVista} reporte={reporte} cargandoReporte={cargandoReporte}
        errorReporte={errorReporte} cargarReporte={cargarReporte} abrirFicha={abrirFicha} fichaForm={fichaForm} setFichaForm={setFichaForm}
        urlFinanzas={urlFinanzas}
      />
    );
  }

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      {g3 ? (
        <CabG3 titulo="Proveedores" descripcion="Gestiona los proveedores de artículos.">
          <button type="button" onClick={() => handleOpenModal()} className="g3-btn g3-btn--primario">
            <Plus size={18} aria-hidden="true" /> Nuevo proveedor
          </button>
        </CabG3>
      ) : (
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600">Gestiona los proveedores de artículos</p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Nuevo Proveedor
        </Button>
      </div>
      )}

      {g3 && <LigaCreditoFinanzas />}

      {g3 && puedeEditar && (
        <div className="g3-pestanas mb-6" role="tablist" aria-label="Proveedores">
          <button type="button" role="tab" aria-selected={vista === 'lista'} onClick={() => verVista('lista')}>
            Proveedores <span className="g3-insignia g3-insignia--neutra">{proveedores.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={vista === 'sinrfc'} onClick={() => verVista('sinrfc')}>
            Sin RFC <span className="g3-insignia g3-insignia--neutra">{proveedores.filter((p) => !tieneRfc(p, fichas[p.id])).length}</span>
          </button>
        </div>
      )}

      {g3 && puedeEditar && vista === 'sinrfc' ? (
        <ReporteSinRfc reporte={reporte} cargando={cargandoReporte} error={errorReporte} onReintentar={cargarReporte} onAbrir={abrirFicha} />
      ) : (<>

      {/* Barra de búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC o contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
      </div>

      {/* Tabla de proveedores */}
      <div className={g3 ? 'g3-tabla g3-tabla--tarjetas' : 'bg-white rounded-xl shadow-sm overflow-hidden'}>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RFC</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{g3 ? 'Correo' : 'Email'}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProveedores.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No se encontraron proveedores
                </td>
              </tr>
            ) : (
              filteredProveedores.map((proveedor) => (
                <tr key={proveedor.id} className="hover:bg-gray-50 transition-colors">
                  <td className={cx('px-6 py-4 whitespace-nowrap', g3 && 'g3-celda-titulo')}>
                    <div className="font-medium text-gray-900">{proveedor.nombre}</div>
                    {/* B3 · PLA-20: nombre corto, «Sin RFC» y el crédito de CTAS CRÉDITO (solo Diseño 3G) */}
                    {g3 && (() => {
                      const f = fichas[proveedor.id];
                      const c = creditoDe(credito, proveedor.id);
                      return (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {f?.nombreCorto && <span className="g3-tenue">{f.nombreCorto}</span>}
                          {!tieneRfc(proveedor, f) && <span className="g3-estado g3-estado--aviso">Sin RFC</span>}
                          {c && <span className="g3-estado g3-estado--info" title={`CTAS CRÉDITO · pestaña «${c.pestana}»`}>{textoCredito(c)}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...etq(g3, 'RFC')}>
                    {proveedor.rfc || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...etq(g3, 'Contacto')}>
                    {proveedor.contacto || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...etq(g3, 'Teléfono')}>
                    {proveedor.telefono || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...etq(g3, 'Correo')}>
                    {proveedor.email || 'N/A'}
                  </td>
                  <td className={cx('px-6 py-4 whitespace-nowrap text-right text-sm', g3 && 'g3-celda-acciones')}>
                    {g3 ? (
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handleOpenModal(proveedor)} className="g3-btn g3-btn--tonal g3-btn--ch">
                          <Edit2 size={16} aria-hidden="true" /> Editar
                        </button>
                        <MasAcciones titulo={proveedor.nombre} acciones={[
                          { texto: 'Eliminar proveedor', icono: Trash2, peligro: true, onClick: () => handleDelete(proveedor.id) },
                        ]} />
                      </div>
                    ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(proveedor)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(proveedor.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>)}

      {/* Modal de crear/editar */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProveedor ? (g3 ? 'Editar proveedor' : 'Editar Proveedor') : (g3 ? 'Nuevo proveedor' : 'Nuevo Proveedor')}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Nombre o razón social"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input
                type="text"
                name="rfc"
                value={formData.rfc}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="RFC del proveedor"
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
              <input
                type="text"
                name="contacto"
                value={formData.contacto}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Persona de contacto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Teléfono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dirección</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  placeholder="Calle, número, colonia"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="Ciudad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input
                    type="text"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="Estado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                  <input
                    type="text"
                    name="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="CP"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Notas adicionales sobre el proveedor..."
            />
          </div>

          {/* B3 paso 3 · PLA-20: la ficha maestra (solo Diseño 3G y quien puede editar proveedores) */}
          {g3 && puedeEditar && fichaForm && (
            <SeccionFicha valor={fichaForm} onCambio={setFichaForm} credito={editingProveedor ? creditoDe(credito, editingProveedor.id) : null} rfcPrincipal={formData.rfc?.trim() || null} />
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              fullWidth
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
            >
              {editingProveedor ? 'Actualizar' : 'Crear'} Proveedor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProveedoresPage;
