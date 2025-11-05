/**
 * Script para cambiar el rol 'supervisor' a 'encargado' en Railway
 *
 * Este script usa las variables de entorno de Railway
 */

import pkg from 'pg';
const { Client } = pkg;

const ejecutarMigracion = async () => {
  let client;

  try {
    console.log('🔄 Conectando a la base de datos de Railway...\n');

    // Usar DATABASE_URL de Railway directamente
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida. Asegúrate de ejecutar esto con railway run');
    }

    client = new Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    console.log('✅ Conectado exitosamente a Railway\n');

    // 1. Verificar cuántos usuarios tienen el rol 'supervisor'
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM usuarios WHERE rol = 'supervisor'
    `);
    const totalSupervisores = countResult.rows[0].total;
    console.log(`📊 Total de usuarios con rol 'supervisor': ${totalSupervisores}\n`);

    if (totalSupervisores === '0') {
      console.log('ℹ️  No hay usuarios con rol supervisor para migrar.\n');

      // Mostrar todos los roles actuales
      const rolesResult = await client.query(`
        SELECT rol, COUNT(*) as cantidad
        FROM usuarios
        GROUP BY rol
      `);
      console.log('📋 Roles actuales en la base de datos:');
      rolesResult.rows.forEach(r => {
        console.log(`  - ${r.rol}: ${r.cantidad} usuario(s)`);
      });

      return;
    }

    // Mostrar los usuarios que se van a actualizar
    console.log('👥 Usuarios que serán actualizados:');
    const usuariosResult = await client.query(`
      SELECT id, nombre, email, rol
      FROM usuarios
      WHERE rol = 'supervisor'
      ORDER BY id
    `);
    usuariosResult.rows.forEach(u => {
      console.log(`  - ID: ${u.id} | ${u.nombre} (${u.email})`);
    });
    console.log('');

    // 2. PRIMERO: Actualizar el ENUM en la base de datos (agregar 'encargado' si no existe)
    console.log('🔄 Actualizando tipo ENUM enum_usuarios_rol...');
    try {
      // Primero verificar si el valor ya existe
      const enumCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'encargado'
          AND enumtypid = (
            SELECT oid
            FROM pg_type
            WHERE typname = 'enum_usuarios_rol'
          )
        ) as exists
      `);

      if (enumCheck.rows[0].exists) {
        console.log('ℹ️  El valor "encargado" ya existe en el ENUM\n');
      } else {
        await client.query(`
          ALTER TYPE enum_usuarios_rol ADD VALUE 'encargado'
        `);
        console.log('✅ Valor "encargado" agregado al ENUM\n');
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  El valor "encargado" ya existe en el ENUM\n');
      } else {
        throw error;
      }
    }

    // 3. AHORA SÍ: Actualizar el rol de 'supervisor' a 'encargado' en la tabla usuarios
    console.log('🔄 Actualizando rol en tabla usuarios...');
    const updateResult = await client.query(`
      UPDATE usuarios
      SET rol = 'encargado'
      WHERE rol = 'supervisor'
    `);
    console.log(`✅ ${updateResult.rowCount} usuarios actualizados de 'supervisor' a 'encargado'\n`);

    // 4. Verificar usuarios actualizados
    console.log('📋 Verificando usuarios con rol "encargado":');
    const verifyResult = await client.query(`
      SELECT id, nombre, email, rol
      FROM usuarios
      WHERE rol = 'encargado'
      ORDER BY id
    `);

    if (verifyResult.rows.length > 0) {
      verifyResult.rows.forEach(user => {
        console.log(`  ✅ ID: ${user.id} | ${user.nombre} (${user.email})`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ Migración completada exitosamente en Railway');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 Resumen:`);
    console.log(`   • ${updateResult.rowCount} usuarios migrados de 'supervisor' a 'encargado'`);
    console.log(`   • ENUM actualizado con el nuevo valor 'encargado'`);
    console.log(`\n⚠️  IMPORTANTE: Los cambios ya están aplicados en producción.\n`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.error('\nDetalles:', error.message);
    throw error;
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Conexión cerrada');
    }
  }
};

// Ejecutar migración
ejecutarMigracion()
  .then(() => {
    console.log('🎉 Proceso completado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 La migración falló:', error.message);
    process.exit(1);
  });
