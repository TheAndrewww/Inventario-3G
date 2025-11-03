import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

const addFechaLlegadaToOrdenes = async () => {
  try {
    console.log('🔄 Iniciando migración: Agregar fecha_llegada_estimada a ordenes_compra...');

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ordenes_compra'
      AND column_name = 'fecha_llegada_estimada'
    `, { type: QueryTypes.SELECT });

    if (columns) {
      console.log('⚠️  La columna fecha_llegada_estimada ya existe en ordenes_compra');
      return;
    }

    // Agregar la columna
    await sequelize.query(`
      ALTER TABLE ordenes_compra
      ADD COLUMN fecha_llegada_estimada TIMESTAMP NULL;
    `);

    // Agregar comentario a la columna (PostgreSQL usa COMMENT ON)
    await sequelize.query(`
      COMMENT ON COLUMN ordenes_compra.fecha_llegada_estimada
      IS 'Fecha estimada de llegada de la orden';
    `);

    console.log('✅ Columna fecha_llegada_estimada agregada exitosamente a ordenes_compra');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  }
};

// Ejecutar migración si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  addFechaLlegadaToOrdenes()
    .then(() => {
      console.log('✅ Migración completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default addFechaLlegadaToOrdenes;
