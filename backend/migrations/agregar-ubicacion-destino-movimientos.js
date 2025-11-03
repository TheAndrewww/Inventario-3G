import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

/**
 * Migración: Agregar campo ubicacion_destino_id a la tabla movimientos
 * Este campo permitirá especificar la ubicación destino para pedidos (ej: camionetas)
 */

async function migrar() {
  try {
    console.log('🚀 Iniciando migración: agregar ubicacion_destino_id a movimientos...\n');

    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'movimientos' AND column_name = 'ubicacion_destino_id';`,
      { type: QueryTypes.SELECT }
    );

    if (columns) {
      console.log('⚠️  La columna ubicacion_destino_id ya existe en la tabla movimientos');
      process.exit(0);
    }

    // Agregar la columna
    await sequelize.query(`
      ALTER TABLE movimientos
      ADD COLUMN ubicacion_destino_id INTEGER NULL
      REFERENCES ubicaciones(id)
      ON DELETE SET NULL;
    `);

    console.log('✅ Columna ubicacion_destino_id agregada exitosamente');

    // Agregar comentario a la columna
    await sequelize.query(`
      COMMENT ON COLUMN movimientos.ubicacion_destino_id
      IS 'ID de la ubicación destino para pedidos (ej: camionetas, almacenes específicos)';
    `);

    console.log('✅ Comentario agregado a la columna');

    // Crear índice para mejorar consultas
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_ubicacion_destino
      ON movimientos(ubicacion_destino_id);
    `);

    console.log('✅ Índice creado para ubicacion_destino_id\n');

    console.log('🎉 Migración completada exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

migrar();
