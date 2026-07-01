import { Configuracion } from '../models/index.js';

// Clave del interruptor que permite a ALMACÉN aplicar entradas/salidas
// de stock sin requerir aprobación del administrador.
export const CLAVE_AJUSTE_DIRECTO = 'almacen_ajuste_directo';

// Clave del interruptor que permite a ALMACÉN editar por completo los artículos
// (categoría, ubicación, sección, stock, unidad, proveedor, descripción, foto),
// además de crearlos. Los SKUs nuevos siguen entrando como pendientes de revisión.
export const CLAVE_EDICION_ALMACEN = 'almacen_edicion_completa';

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
 * Helper reutilizable: ¿está activa la edición completa para almacén?
 * Devuelve false ante cualquier error (modo seguro = permisos restringidos).
 */
export const esEdicionAlmacenActiva = async (transaction = null) => {
  try {
    const config = await Configuracion.findOne({
      where: { clave: CLAVE_EDICION_ALMACEN },
      ...(transaction ? { transaction } : {})
    });
    return config?.valor === 'true';
  } catch (e) {
    console.error('Error al leer configuración de edición de almacén:', e.message);
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
    const edicionAlmacen = await esEdicionAlmacenActiva();
    res.json({
      success: true,
      data: {
        almacen_ajuste_directo: ajusteDirecto,
        almacen_edicion_completa: edicionAlmacen
      }
    });
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

/**
 * Activar/desactivar la edición completa de artículos para almacén (solo admin).
 */
export const actualizarEdicionAlmacen = async (req, res) => {
  try {
    const { activo } = req.body;
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ success: false, message: 'El campo "activo" debe ser true o false' });
    }

    const [config] = await Configuracion.findOrCreate({
      where: { clave: CLAVE_EDICION_ALMACEN },
      defaults: {
        clave: CLAVE_EDICION_ALMACEN,
        valor: activo ? 'true' : 'false',
        descripcion: 'Permite que el rol almacen cree y edite por completo los artículos (categoría, ubicación, sección, stock, unidad, proveedor, descripción, foto)'
      }
    });

    config.valor = activo ? 'true' : 'false';
    await config.save();

    res.json({
      success: true,
      message: activo
        ? 'Edición completa de almacén ACTIVADA — almacén puede crear y editar artículos por completo'
        : 'Edición completa de almacén DESACTIVADA — almacén vuelve a permisos restringidos',
      data: { almacen_edicion_completa: activo }
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
};
