/**
 * Migración: Agregar campo pendiente_revision a artículos
 *
 * Este campo se usa para marcar artículos creados por almacén que
 * necesitan revisión por parte del administrador.
 *
 * Ejecutar con: node migrations/add-pendiente-revision.js
 */

import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

async function runMigration() {
  try {
    console.log('🔄 Iniciando migración: agregar campo pendiente_revision...\n');

    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida\n');

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'articulos'
      AND column_name = 'pendiente_revision';
    `, { type: QueryTypes.SELECT });

    if (columns) {
      console.log('⚠️  La columna pendiente_revision ya existe, omitiendo...');
      process.exit(0);
    }

    // Agregar la columna
    await sequelize.query(`
      ALTER TABLE articulos
      ADD COLUMN pendiente_revision BOOLEAN DEFAULT false;
    `);

    console.log('✅ Columna pendiente_revision agregada exitosamente');

    // Actualizar la columna para que no permita NULL
    await sequelize.query(`
      UPDATE articulos
      SET pendiente_revision = false
      WHERE pendiente_revision IS NULL;
    `);

    await sequelize.query(`
      ALTER TABLE articulos
      ALTER COLUMN pendiente_revision SET NOT NULL;
    `);

    console.log('✅ Valores por defecto establecidos (false para artículos existentes)');

    console.log('\n📊 Resumen:');
    console.log('  - Campo: pendiente_revision (BOOLEAN)');
    console.log('  - Default: false');
    console.log('  - NOT NULL: true');
    console.log('  - Descripción: Marca artículos creados por almacén pendientes de revisión\n');

    console.log('✅ Migración completada exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

runMigration();
