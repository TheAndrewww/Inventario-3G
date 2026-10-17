// Rediseño 2 · Producción · «Nuevo proyecto» en un cajón (antes: diálogo con botón morado).
// Mismos 5 campos, mismo aviso si falta el nombre, mismo cuerpo que se manda (crearProyecto de la página):
// { nombre, cliente, descripcion, prioridad (número 1–5), fecha_limite }. Al crear, se limpia y se cierra, como hoy.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, Campo, Entrada, Selector, Area, Boton } from '../fundacion';

const VACIO = { nombre: '', cliente: '', descripcion: '', prioridad: 3, fecha_limite: '' };
const PRIORIDADES = [
  { valor: 1, texto: 'Urgente' },
  { valor: 2, texto: 'Alta' },
  { valor: 3, texto: 'Normal' },
  { valor: 4, texto: 'Baja' },
  { valor: 5, texto: 'Muy baja' },
];

export function CajonNuevoProyecto({ abierto, alCerrar, onCrear }) {
  const [formData, setFormData] = useState(VACIO);
  const [loading, setLoading] = useState(false);
  const conCambios = Boolean(formData.nombre || formData.cliente || formData.descripcion || formData.fecha_limite || formData.prioridad !== 3);

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setLoading(true);
    try {
      const success = await onCrear(formData);
      if (success) {
        setFormData(VACIO);
        alCerrar();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} etiqueta="Nuevo proyecto de producción" alEnviar={handleSubmit} cambiosSinGuardar={conCambios}>
      <CajonCabecera titulo="Nuevo proyecto" dato="Entra al tablero en la etapa «En diseño»" alCerrar={alCerrar} />
      <CajonCuerpo>
        <div className="r2-prod-formulario">
          <Campo etiqueta="Nombre del proyecto" requerido>
            <Entrada type="text" value={formData.nombre} autoFocus placeholder="Ej: Velaria Residencial García"
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Cliente">
            <Entrada type="text" value={formData.cliente} placeholder="Nombre del cliente"
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })} />
          </Campo>
          <div className="r2-prod-formulario-par">
            <Campo etiqueta="Prioridad">
              <Selector value={formData.prioridad} opciones={PRIORIDADES}
                onChange={(e) => setFormData({ ...formData, prioridad: parseInt(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Fecha límite">
              <Entrada type="date" value={formData.fecha_limite}
                onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Descripción o notas">
            <Area rows={3} value={formData.descripcion} placeholder="Notas adicionales…"
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} />
          </Campo>
        </div>
      </CajonCuerpo>
      <CajonPie>
        <Boton nivel="fantasma" alHacer={alCerrar}>Cancelar</Boton>
        <Boton nivel="principal" tipo="submit" cargando={loading}>{loading ? 'Creando…' : 'Crear proyecto'}</Boton>
      </CajonPie>
    </Cajon>
  );
}
