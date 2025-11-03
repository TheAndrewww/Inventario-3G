/**
 * Migración: Actualizar roles de usuario
 *
 * Cambia los roles de usuario de:
 *   - empleado, supervisor, administrador
 * A:
 *   - administrador, diseñador, compras, almacen, supervisor
 */

export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Iniciando migración de roles de usuario...');

    // Paso 1: Agregar columna temporal con el nuevo tipo ENUM
    console.log('1️⃣ Creando nuevo ENUM y columna temporal...');
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_usuarios_rol_new AS ENUM (
        'administrador',
        'diseñador',
        'compras',
        'almacen',
        'supervisor'
      );
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios
      ADD COLUMN rol_new enum_usuarios_rol_new;
    `, { transaction });

    // Paso 2: Migrar datos existentes (mapeo de roles antiguos a nuevos)
    console.log('2️⃣ Migrando datos existentes...');

    // Mapeo de roles:
    // - 'empleado' -> 'almacen' (asumiendo que los empleados son del almacén)
    // - 'supervisor' -> 'supervisor' (mantiene el mismo)
    // - 'administrador' -> 'administrador' (mantiene el mismo)

    await queryInterface.sequelize.query(`
      UPDATE usuarios
      SET rol_new = CASE
        WHEN rol = 'administrador' THEN 'administrador'::enum_usuarios_rol_new
        WHEN rol = 'supervisor' THEN 'supervisor'::enum_usuarios_rol_new
        WHEN rol = 'empleado' THEN 'almacen'::enum_usuarios_rol_new
        ELSE 'almacen'::enum_usuarios_rol_new
      END;
    `, { transaction });

    // Paso 3: Eliminar columna antigua y tipo ENUM antiguo
    console.log('3️⃣ Eliminando columna y ENUM antiguos...');
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios DROP COLUMN rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      DROP TYPE enum_usuarios_rol;
    `, { transaction });

    // Paso 4: Renombrar nuevo ENUM y columna
    console.log('4️⃣ Renombrando nueva columna y ENUM...');
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_usuarios_rol_new RENAME TO enum_usuarios_rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios RENAME COLUMN rol_new TO rol;
    `, { transaction });

    // Paso 5: Establecer valor por defecto y NOT NULL
    console.log('5️⃣ Configurando restricciones finales...');
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios
      ALTER COLUMN rol SET DEFAULT 'almacen'::enum_usuarios_rol,
      ALTER COLUMN rol SET NOT NULL;
    `, { transaction });

    await transaction.commit();
    console.log('✅ Migración de roles completada exitosamente');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración de roles:', error);
    throw error;
  }
}

export async function down(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Revirtiendo migración de roles de usuario...');

    // Crear ENUM anterior
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_usuarios_rol_old AS ENUM (
        'empleado',
        'supervisor',
        'administrador'
      );
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios
      ADD COLUMN rol_old enum_usuarios_rol_old;
    `, { transaction });

    // Mapear de vuelta
    await queryInterface.sequelize.query(`
      UPDATE usuarios
      SET rol_old = CASE
        WHEN rol = 'administrador' THEN 'administrador'::enum_usuarios_rol_old
        WHEN rol = 'supervisor' THEN 'supervisor'::enum_usuarios_rol_old
        WHEN rol IN ('diseñador', 'compras', 'almacen') THEN 'empleado'::enum_usuarios_rol_old
        ELSE 'empleado'::enum_usuarios_rol_old
      END;
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios DROP COLUMN rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      DROP TYPE enum_usuarios_rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_usuarios_rol_old RENAME TO enum_usuarios_rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios RENAME COLUMN rol_old TO rol;
    `, { transaction });

    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios
      ALTER COLUMN rol SET DEFAULT 'empleado'::enum_usuarios_rol,
      ALTER COLUMN rol SET NOT NULL;
    `, { transaction });

    await transaction.commit();
    console.log('✅ Reversión de migración completada');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración:', error);
    throw error;
  }
}
