/**
 * Script para limpiar la base de datos antes de pasar a producción
 *
 * Este script:
 * 1. Limpia todos los datos de prueba
 * 2. Mantiene la estructura de la BD
 * 3. Conserva categorías y ubicaciones base
 * 4. Crea solo el usuario administrador inicial
 * 5. Resetea los contadores de tickets
 */

import { sequelize } from '../src/config/database.js';
import bcrypt from 'bcrypt';

const limpiarBaseDatos = async () => {
  try {
    console.log('🧹 Iniciando limpieza de base de datos para producción...\n');

    // 1. LIMPIAR DATOS TRANSACCIONALES (orden importante por foreign keys)
    console.log('📦 Limpiando datos transaccionales...');

    // Notificaciones (no tienen dependencias)
    await sequelize.query('DELETE FROM notificaciones');
    console.log('  ✅ Notificaciones eliminadas');

    // Solicitudes de compra (tienen FK a movimientos, eliminar primero)
    await sequelize.query('DELETE FROM solicitudes_compra');
    console.log('  ✅ Solicitudes de compra eliminadas');

    // Detalles de órdenes de compra
    await sequelize.query('DELETE FROM detalle_ordenes_compra');
    console.log('  ✅ Detalles de órdenes de compra eliminados');

    // Órdenes de compra
    await sequelize.query('DELETE FROM ordenes_compra');
    console.log('  ✅ Órdenes de compra eliminadas');

    // Detalles de movimientos
    await sequelize.query('DELETE FROM detalle_movimientos');
    console.log('  ✅ Detalles de movimientos eliminados');

    // Movimientos (pedidos, retiros, entradas)
    await sequelize.query('DELETE FROM movimientos');
    console.log('  ✅ Movimientos eliminados');

    // 2. LIMPIAR DATOS MAESTROS
    console.log('\n📋 Limpiando datos maestros...');

    // Artículos
    await sequelize.query('DELETE FROM articulos');
    console.log('  ✅ Artículos eliminados');

    // Proveedores
    await sequelize.query('DELETE FROM proveedores');
    console.log('  ✅ Proveedores eliminados');

    // Equipos
    await sequelize.query('DELETE FROM equipos');
    console.log('  ✅ Equipos eliminados');

    // Usuarios (dejaremos solo el admin)
    await sequelize.query('DELETE FROM usuarios WHERE email != \'admin@3g.com\'');
    console.log('  ✅ Usuarios de prueba eliminados (conservando admin)');

    // 3. MANTENER/CREAR CATEGORÍAS Y UBICACIONES BASE
    console.log('\n🏷️  Verificando categorías y ubicaciones base...');

    // Verificar si hay categorías
    const [categorias] = await sequelize.query('SELECT COUNT(*) as count FROM categorias');
    if (categorias[0].count === 0) {
      await sequelize.query(`
        INSERT INTO categorias (nombre, descripcion, activo, created_at, updated_at) VALUES
        ('Ferretería', 'Artículos de ferretería general', true, NOW(), NOW()),
        ('Eléctrico', 'Material eléctrico', true, NOW(), NOW()),
        ('Plomería', 'Material de plomería', true, NOW(), NOW()),
        ('Herramientas', 'Herramientas de trabajo', true, NOW(), NOW()),
        ('Consumibles', 'Materiales consumibles', true, NOW(), NOW())
      `);
      console.log('  ✅ Categorías base creadas');
    } else {
      console.log('  ℹ️  Categorías existentes conservadas');
    }

    // Verificar si hay ubicaciones
    const [ubicaciones] = await sequelize.query('SELECT COUNT(*) as count FROM ubicaciones');
    if (ubicaciones[0].count === 0) {
      await sequelize.query(`
        INSERT INTO ubicaciones (codigo, descripcion, activo, created_at, updated_at) VALUES
        ('ALM-A1', 'Almacén Principal - Anaquel A1', true, NOW(), NOW()),
        ('ALM-A2', 'Almacén Principal - Anaquel A2', true, NOW(), NOW()),
        ('ALM-B1', 'Almacén Principal - Anaquel B1', true, NOW(), NOW()),
        ('BDG-01', 'Bodega Externa 01', true, NOW(), NOW())
      `);
      console.log('  ✅ Ubicaciones base creadas');
    } else {
      console.log('  ℹ️  Ubicaciones existentes conservadas');
    }

    // 4. VERIFICAR/CREAR USUARIO ADMINISTRADOR
    console.log('\n👤 Verificando usuario administrador...');
    const [adminUser] = await sequelize.query(
      "SELECT * FROM usuarios WHERE email = 'admin@3g.com'"
    );

    if (adminUser.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await sequelize.query(`
        INSERT INTO usuarios (nombre, email, password, rol, activo, created_at, updated_at)
        VALUES ('Administrador', 'admin@3g.com', '${hashedPassword}', 'administrador', true, NOW(), NOW())
      `);
      console.log('  ✅ Usuario administrador creado');
      console.log('     Email: admin@3g.com');
      console.log('     Password: admin123');
    } else {
      console.log('  ℹ️  Usuario administrador ya existe');
    }

    // 5. RESETEAR SECUENCIAS/CONTADORES
    console.log('\n🔄 Reseteando secuencias...');

    // Resetear los IDs de las tablas principales
    const tablasParaResetear = [
      'articulos',
      'movimientos',
      'detalle_movimientos',
      'ordenes_compra',
      'detalle_ordenes_compra',
      'solicitudes_compra',
      'notificaciones',
      'proveedores',
      'equipos'
    ];

    for (const tabla of tablasParaResetear) {
      await sequelize.query(`
        SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), 1, false)
      `);
    }
    console.log('  ✅ Secuencias reseteadas');

    // 6. ESTADÍSTICAS FINALES
    console.log('\n📊 Estado final de la base de datos:');

    const [stats] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) as usuarios,
        (SELECT COUNT(*) FROM categorias) as categorias,
        (SELECT COUNT(*) FROM ubicaciones) as ubicaciones,
        (SELECT COUNT(*) FROM articulos) as articulos,
        (SELECT COUNT(*) FROM proveedores) as proveedores,
        (SELECT COUNT(*) FROM equipos) as equipos,
        (SELECT COUNT(*) FROM movimientos) as movimientos,
        (SELECT COUNT(*) FROM ordenes_compra) as ordenes_compra,
        (SELECT COUNT(*) FROM notificaciones) as notificaciones
    `);

    console.log(`  👤 Usuarios: ${stats[0].usuarios}`);
    console.log(`  🏷️  Categorías: ${stats[0].categorias}`);
    console.log(`  📍 Ubicaciones: ${stats[0].ubicaciones}`);
    console.log(`  📦 Artículos: ${stats[0].articulos}`);
    console.log(`  🏢 Proveedores: ${stats[0].proveedores}`);
    console.log(`  👷 Equipos: ${stats[0].equipos}`);
    console.log(`  📋 Movimientos: ${stats[0].movimientos}`);
    console.log(`  🛒 Órdenes de compra: ${stats[0].ordenes_compra}`);
    console.log(`  🔔 Notificaciones: ${stats[0].notificaciones}`);

    console.log('\n✅ ¡Base de datos limpiada exitosamente para producción!');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   - Usuario admin: admin@3g.com / admin123');
    console.log('   - Cambia la contraseña del admin inmediatamente');
    console.log('   - Crea los usuarios reales del sistema');
    console.log('   - Crea los proveedores reales');
    console.log('   - Configura los equipos de trabajo');

  } catch (error) {
    console.error('❌ Error al limpiar la base de datos:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Ejecutar el script
limpiarBaseDatos()
  .then(() => {
    console.log('\n🎉 Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error en el proceso:', error);
    process.exit(1);
  });
