/**
 * Script para ejecutar la migración de proyectos
 * Uso: node scripts/run-proyectos-migration.js
 */

import dotenv from 'dotenv';
import { sequelize } from '../src/config/database.js';
import { Sequelize } from 'sequelize';

// Cargar variables de entorno
dotenv.config();

// Importar scripts de migración (adaptados a ES modules)
const migration1 = {
  up: async (queryInterface) => {
    console.log('🔄 Ejecutando migración: Crear tabla proyectos...');

    // Crear tabla proyectos
    await queryInterface.createTable('proyectos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cliente: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      ubicacion_obra: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fecha_fin_real: {
        type: Sequelize.DATE,
        allowNull: true
      },
      estado: {
        type: Sequelize.ENUM('planificado', 'activo', 'pausado', 'completado', 'cancelado'),
        defaultValue: 'activo',
        allowNull: false
      },
      presupuesto_estimado: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      presupuesto_real: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      supervisor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'usuarios',
          key: 'id'
        }
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Verificar si la columna proyecto_id ya existe
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'movimientos'
      AND column_name = 'proyecto_id';
    `);

    if (columns.length === 0) {
      // Agregar columna proyecto_id a movimientos
      await queryInterface.addColumn('movimientos', 'proyecto_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'proyectos',
          key: 'id'
        }
      });
      console.log('   ✅ Columna proyecto_id agregada a movimientos');
    } else {
      console.log('   ℹ️  Columna proyecto_id ya existe en movimientos');
    }

    console.log('✅ Tabla proyectos creada exitosamente');
  }
};

const migration2 = {
  up: async (queryInterface) => {
    console.log('🔄 Ejecutando migración: Normalizar proyectos existentes...');

    // Extraer proyectos únicos
    const [proyectosUnicos] = await sequelize.query(`
      SELECT DISTINCT
        UPPER(TRIM(proyecto)) as nombre_normalizado,
        MIN(fecha_hora) as fecha_inicio_estimada,
        COUNT(*) as cantidad_movimientos,
        CASE
          WHEN MAX(fecha_hora) > NOW() - INTERVAL '30 days' THEN 'activo'
          WHEN MAX(fecha_hora) > NOW() - INTERVAL '90 days' THEN 'completado'
          ELSE 'completado'
        END as estado_estimado
      FROM movimientos
      WHERE proyecto IS NOT NULL
        AND TRIM(proyecto) != ''
      GROUP BY UPPER(TRIM(proyecto))
      ORDER BY MIN(fecha_hora) DESC;
    `);

    console.log(`   ✅ Encontrados ${proyectosUnicos.length} proyectos únicos`);

    if (proyectosUnicos.length === 0) {
      console.log('   ℹ️  No hay proyectos existentes para migrar');
      return;
    }

    // Insertar proyectos
    for (const proyecto of proyectosUnicos) {
      const [existente] = await sequelize.query(`
        SELECT id FROM proyectos WHERE nombre = :nombre LIMIT 1;
      `, {
        replacements: { nombre: proyecto.nombre_normalizado }
      });

      if (existente.length === 0) {
        await sequelize.query(`
          INSERT INTO proyectos (
            nombre,
            fecha_inicio,
            estado,
            activo,
            created_at,
            updated_at
          ) VALUES (
            :nombre,
            :fecha_inicio,
            :estado,
            true,
            NOW(),
            NOW()
          );
        `, {
          replacements: {
            nombre: proyecto.nombre_normalizado,
            fecha_inicio: proyecto.fecha_inicio_estimada,
            estado: proyecto.estado_estimado
          }
        });

        console.log(`   ✅ Proyecto insertado: "${proyecto.nombre_normalizado}" (${proyecto.cantidad_movimientos} movimientos)`);
      }
    }

    // Vincular movimientos
    await sequelize.query(`
      UPDATE movimientos m
      SET proyecto_id = p.id
      FROM proyectos p
      WHERE UPPER(TRIM(m.proyecto)) = p.nombre
        AND m.proyecto IS NOT NULL
        AND TRIM(m.proyecto) != ''
        AND m.proyecto_id IS NULL;
    `);

    // Estadísticas
    const [stats] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM proyectos WHERE activo = true) as proyectos_activos,
        (SELECT COUNT(*) FROM movimientos WHERE proyecto_id IS NOT NULL) as movimientos_vinculados,
        (SELECT COUNT(*) FROM movimientos WHERE proyecto IS NOT NULL AND proyecto_id IS NULL) as movimientos_sin_vincular
    `);

    console.log(`
   ╔══════════════════════════════════════════╗
   ║        RESUMEN DE MIGRACIÓN              ║
   ╠══════════════════════════════════════════╣
   ║ ✅ Proyectos activos: ${stats[0].proyectos_activos.toString().padEnd(18)} ║
   ║ ✅ Movimientos vinculados: ${stats[0].movimientos_vinculados.toString().padEnd(13)} ║
   ║ ⚠️  Movimientos sin vincular: ${stats[0].movimientos_sin_vincular.toString().padEnd(10)} ║
   ╚══════════════════════════════════════════╝
    `);

    console.log('✅ Migración de proyectos completada exitosamente');
  }
};

const runMigrations = async () => {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🚀 MIGRACIÓN: Sistema de Proyectos');
    console.log('═══════════════════════════════════════════════════════\n');

    // Conectar a base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    const queryInterface = sequelize.getQueryInterface();

    // Ejecutar migración 1: Crear tabla
    console.log('📋 Migración 1/2: Crear estructura de tabla proyectos');
    await migration1.up(queryInterface);
    console.log('');

    // Ejecutar migración 2: Migrar datos
    console.log('📋 Migración 2/2: Normalizar proyectos existentes');
    await migration2.up(queryInterface);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('   ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n💡 Próximos pasos:');
    console.log('   1. Reiniciar el servidor backend');
    console.log('   2. Verificar endpoint: GET /api/proyectos');
    console.log('   3. Probar autocomplete en frontend\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    console.error('\n📋 Stack trace:', error.stack);
    process.exit(1);
  }
};

// Ejecutar migraciones
runMigrations();
