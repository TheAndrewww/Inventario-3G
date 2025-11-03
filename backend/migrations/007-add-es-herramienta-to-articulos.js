import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

export const up = async () => {
  console.log('🔧 Agregando campo es_herramienta a la tabla articulos...');

  try {
    // Agregar columna es_herramienta
    await sequelize.query(`
      ALTER TABLE articulos
      ADD COLUMN IF NOT EXISTS es_herramienta BOOLEAN DEFAULT FALSE;
    `, { type: QueryTypes.RAW });

    console.log('✅ Campo es_herramienta agregado correctamente');

    // Crear índice para mejorar consultas
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_articulos_es_herramienta
      ON articulos(es_herramienta);
    `, { type: QueryTypes.RAW });

    console.log('✅ Índice creado correctamente');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  }
};

export const down = async () => {
  console.log('🔄 Revirtiendo migración es_herramienta...');

  try {
    // Eliminar índice
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_articulos_es_herramienta;
    `, { type: QueryTypes.RAW });

    // Eliminar columna
    await sequelize.query(`
      ALTER TABLE articulos
      DROP COLUMN IF EXISTS es_herramienta;
    `, { type: QueryTypes.RAW });

    console.log('✅ Migración revertida correctamente');

  } catch (error) {
    console.error('❌ Error al revertir migración:', error);
    throw error;
  }
};
