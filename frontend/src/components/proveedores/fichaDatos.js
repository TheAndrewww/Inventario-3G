/**
 * B3 paso 3 · PLA-20 — Ayudas de la ficha maestra del proveedor (sin componentes, para que Vite recargue bien).
 */
export const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
export const normRfc = (v) => String(v ?? '').toUpperCase().replace(/[\s.-]/g, '').trim();

export const fichaVacia = () => ({
  nombreCorto: '', razonesSociales: [], alias: [], contactos: [], trato: null, pideEdoCta: null, pideAlPagar: null,
});

/** La ficha del servidor → formulario (siempre con listas). */
export const fichaAFormulario = (f) => ({
  ...fichaVacia(),
  ...(f || {}),
  nombreCorto: f?.nombreCorto || '',
  razonesSociales: (f?.razonesSociales || []).map((r) => ({ razon: r.razon || '', rfc: r.rfc || '' })),
  alias: [...(f?.alias || [])],
  contactos: (f?.contactos || []).map((c) => ({ nombre: c.nombre || '', telefono: c.telefono || '', correo: c.correo || '', puesto: c.puesto || '', avisos: !!c.avisos })),
});

/** ¿El proveedor tiene RFC (el suyo o el de alguna razón social)? */
export const tieneRfc = (proveedor, ficha) => !!proveedor?.rfc || (ficha?.razonesSociales || []).some((r) => !!r.rfc);

/** El crédito vigente que Contabilidad dice para este proveedor (o null). */
export const creditoDe = (credito, proveedorId) => (credito || []).find((c) => c.proveedorId === proveedorId) || null;

export const textoCredito = (c) => (c ? `A crédito · ${c.plazoDias} día${c.plazoDias === 1 ? '' : 's'}` : null);

/** Lo que el formulario manda al servidor (sin renglones vacíos). */
export const fichaParaGuardar = (f) => ({
  nombreCorto: f.nombreCorto.trim() || null,
  razonesSociales: f.razonesSociales.filter((r) => r.razon.trim() || r.rfc.trim()).map((r) => ({ razon: r.razon.trim(), rfc: normRfc(r.rfc) || null })),
  alias: f.alias,
  contactos: f.contactos.filter((c) => c.nombre.trim() || c.telefono.trim() || c.correo.trim()).map((c) => ({ ...c, nombre: c.nombre.trim(), telefono: c.telefono.trim(), correo: c.correo.trim(), puesto: c.puesto.trim() })),
  trato: f.trato, pideEdoCta: f.pideEdoCta, pideAlPagar: f.pideAlPagar,
});

