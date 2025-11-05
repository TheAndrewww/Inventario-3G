/**
 * Script para cambiar el rol 'supervisor' a 'encargado' en la base de datos
 *
 * USO: node backend/scripts/cambiar-rol-supervisor-a-encargado.js
 */

import pkg from 'pg';
const { Client } = pkg;

const ejecutarMigracion = async () => {
  let client;

  try {
    console.log('🔄 Conectando a la base de datos...\n');

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'inventario3g',
      user: process.env.DB_USER || 'andrewww',
      password: process.env.DB_PASSWORD || ''
    };

    client = new Client(config);
    await client.connect();
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar cuántos usuarios tienen el rol 'supervisor'
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM usuarios WHERE rol = 'supervisor'
    `);
    const totalSupervisores = countResult.rows[0].total;
    console.log(`📊 Total de usuarios con rol 'supervisor': ${totalSupervisores}\n`);

    if (totalSupervisores === '0') {
      console.log('ℹ️  No hay usuarios con rol supervisor para migrar.\n');
      return;
    }

    // 2. Actualizar el rol de 'supervisor' a 'encargado' en la tabla usuarios
    console.log('🔄 Actualizando rol en tabla usuarios...');
    const updateResult = await client.query(`
      UPDATE usuarios
      SET rol = 'encargado'
      WHERE rol = 'supervisor'
    `);
    console.log(`✅ ${updateResult.rowCount} usuarios actualizados de 'supervisor' a 'encargado'\n`);

    // 3. Actualizar el ENUM en la base de datos (agregar 'encargado' si no existe)
    console.log('🔄 Actualizando tipo ENUM enum_usuarios_rol...');
    try {
      await client.query(`
        ALTER TYPE enum_usuarios_rol ADD VALUE IF NOT EXISTS 'encargado'
      `);
      console.log('✅ Valor "encargado" agregado al ENUM\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  El valor "encargado" ya existe en el ENUM\n');
      } else {
        throw error;
      }
    }

    // 4. Mostrar usuarios actualizados
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
    console.log('✅ Migración completada exitosamente');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 Resumen:`);
    console.log(`   • ${updateResult.rowCount} usuarios migrados de 'supervisor' a 'encargado'`);
    console.log(`   • ENUM actualizado con el nuevo valor 'encargado'`);
    console.log(`\n⚠️  IMPORTANTE: Reinicia el servidor backend para que los cambios surtan efecto.\n`);

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
