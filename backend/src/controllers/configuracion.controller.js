import { Configuracion } from '../models/index.js';

// Clave del interruptor que permite a ALMACÉN aplicar entradas/salidas
// de stock sin requerir aprobación del administrador.
export const CLAVE_AJUSTE_DIRECTO = 'almacen_ajuste_directo';

/**
 * Helper reutilizable: ¿está activo el modo de ajuste directo para almacén?
 * Devuelve false ante cualquier error (modo seguro = requiere aprobación).
 */
export const esAjusteDirectoActivo = async (transaction = null) => {
  try {
    const config = await Configuracion.findOne({
      where: { clave: CLAVE_AJUSTE_DIRECTO },
      ...(transaction ? { transaction } : {})
    });
    return config?.valor === 'true';
  } catch (e) {
    console.error('Error al leer configuración de ajuste directo:', e.message);
    return false;
  }
};

/**
 * Obtener la configuración relevante (cualquier usuario autenticado).
 * El frontend la usa para saber si mostrar/ocultar el interruptor.
 */
export const obtenerConfiguracion = async (req, res) => {
  try {
    const ajusteDirecto = await esAjusteDirectoActivo();
    res.json({ success: true, data: { almacen_ajuste_directo: ajusteDirecto } });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
};

/**
 * Activar/desactivar el ajuste directo de almacén (solo administrador).
 */
export const actualizarAjusteDirecto = async (req, res) => {
  try {
    const { activo } = req.body;
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ success: false, message: 'El campo "activo" debe ser true o false' });
    }

    const [config] = await Configuracion.findOrCreate({
      where: { clave: CLAVE_AJUSTE_DIRECTO },
      defaults: {
        clave: CLAVE_AJUSTE_DIRECTO,
        valor: activo ? 'true' : 'false',
        descripcion: 'Permite que el rol almacen aplique entradas/salidas de stock sin aprobación del administrador'
      }
    });

    config.valor = activo ? 'true' : 'false';
    await config.save();

    res.json({
      success: true,
      message: activo
        ? 'Ajuste directo de almacén ACTIVADO — las entradas/salidas se aplican sin aprobación'
        : 'Ajuste directo de almacén DESACTIVADO — las entradas/salidas requieren aprobación',
      data: { almacen_ajuste_directo: activo }
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
};
