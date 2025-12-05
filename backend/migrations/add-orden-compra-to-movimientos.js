import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

const addOrdenCompraToMovimientos = async () => {
  try {
    console.log('🔄 Iniciando migración: Agregar orden_compra_id a movimientos y nuevo tipo de movimiento...');

    // 1. Verificar si la columna orden_compra_id ya existe
    const [column] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'movimientos'
      AND column_name = 'orden_compra_id'
    `, { type: QueryTypes.SELECT });

    if (!column) {
      // Agregar la columna orden_compra_id
      await sequelize.query(`
        ALTER TABLE movimientos
        ADD COLUMN orden_compra_id INTEGER NULL
        REFERENCES ordenes_compra(id) ON DELETE SET NULL;
      `);

      // Agregar comentario a la columna
      await sequelize.query(`
        COMMENT ON COLUMN movimientos.orden_compra_id
        IS 'ID de la orden de compra asociada (para entradas desde órdenes de compra)';
      `);

      // Crear índice para mejorar consultas
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_movimientos_orden_compra
        ON movimientos(orden_compra_id);
      `);

      console.log('✅ Columna orden_compra_id agregada exitosamente a movimientos');
      console.log('✅ Índice idx_movimientos_orden_compra creado');
    } else {
      console.log('⚠️  La columna orden_compra_id ya existe en movimientos');
    }

    // 2. Verificar y agregar nuevo tipo de movimiento 'entrada_orden_compra'
    const [tipoExiste] = await sequelize.query(`
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'enum_movimientos_tipo'
      AND e.enumlabel = 'entrada_orden_compra'
    `, { type: QueryTypes.SELECT });

    if (!tipoExiste) {
      await sequelize.query(`
        ALTER TYPE enum_movimientos_tipo ADD VALUE IF NOT EXISTS 'entrada_orden_compra';
      `);
      console.log('✅ Tipo de movimiento "entrada_orden_compra" agregado al ENUM');
    } else {
      console.log('⚠️  El tipo "entrada_orden_compra" ya existe en el ENUM');
    }

    console.log('✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  }
};

// Ejecutar migración si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  addOrdenCompraToMovimientos()
    .then(() => {
      console.log('✅ Migración completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default addOrdenCompraToMovimientos;
