/**
 * Migración: Agregar campo etiquetado a artículos
 *
 * Este campo se usa para marcar artículos que ya tienen etiquetas
 * generadas, facilitando el control de inventario etiquetado.
 *
 * Ejecutar con: node migrations/add-etiquetado-articulos.js
 */

import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

async function runMigration() {
  try {
    console.log('🔄 Iniciando migración: agregar campo etiquetado...\n');

    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida\n');

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'articulos'
      AND column_name = 'etiquetado';
    `, { type: QueryTypes.SELECT });

    if (columns) {
      console.log('⚠️  La columna etiquetado ya existe, omitiendo...');
      process.exit(0);
    }

    // Agregar la columna
    await sequelize.query(`
      ALTER TABLE articulos
      ADD COLUMN etiquetado BOOLEAN DEFAULT false;
    `);

    console.log('✅ Columna etiquetado agregada exitosamente');

    // Actualizar la columna para que no permita NULL
    await sequelize.query(`
      UPDATE articulos
      SET etiquetado = false
      WHERE etiquetado IS NULL;
    `);

    await sequelize.query(`
      ALTER TABLE articulos
      ALTER COLUMN etiquetado SET NOT NULL;
    `);

    console.log('✅ Valores por defecto establecidos (false para artículos existentes)');

    console.log('\n📊 Resumen:');
    console.log('  - Campo: etiquetado (BOOLEAN)');
    console.log('  - Default: false');
    console.log('  - NOT NULL: true');
    console.log('  - Descripción: Indica si el artículo tiene etiquetas generadas\n');

    console.log('✅ Migración completada exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

runMigration();
