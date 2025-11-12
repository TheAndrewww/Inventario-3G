/**
 * Script de migración: Normalizar proyectos existentes
 * Fecha: 2025-11-12
 * Descripción: Extrae proyectos únicos del campo 'proyecto' en movimientos
 *              y los inserta en la nueva tabla 'proyectos'
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Iniciando migración de proyectos existentes...');

    try {
      // Paso 1: Extraer proyectos únicos del campo 'proyecto' en movimientos
      console.log('📊 Paso 1/4: Extrayendo proyectos únicos de movimientos...');

      const [proyectosUnicos] = await queryInterface.sequelize.query(`
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

      // Paso 2: Insertar proyectos en la tabla 'proyectos'
      console.log('📥 Paso 2/4: Insertando proyectos en tabla normalizada...');

      for (const proyecto of proyectosUnicos) {
        // Verificar si ya existe
        const [existente] = await queryInterface.sequelize.query(`
          SELECT id FROM proyectos WHERE nombre = :nombre LIMIT 1;
        `, {
          replacements: { nombre: proyecto.nombre_normalizado }
        });

        if (existente.length === 0) {
          await queryInterface.sequelize.query(`
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
        } else {
          console.log(`   ℹ️  Proyecto ya existe: "${proyecto.nombre_normalizado}"`);
        }
      }

      // Paso 3: Actualizar movimientos con proyecto_id
      console.log('🔗 Paso 3/4: Vinculando movimientos con proyectos...');

      const [resultado] = await queryInterface.sequelize.query(`
        UPDATE movimientos m
        SET proyecto_id = p.id
        FROM proyectos p
        WHERE UPPER(TRIM(m.proyecto)) = p.nombre
          AND m.proyecto IS NOT NULL
          AND TRIM(m.proyecto) != ''
          AND m.proyecto_id IS NULL;
      `);

      console.log(`   ✅ ${resultado.rowCount || 0} movimientos vinculados con proyectos`);

      // Paso 4: Verificar resultados
      console.log('🔍 Paso 4/4: Verificando resultados...');

      const [estadisticas] = await queryInterface.sequelize.query(`
        SELECT
          (SELECT COUNT(*) FROM proyectos WHERE activo = true) as proyectos_activos,
          (SELECT COUNT(*) FROM movimientos WHERE proyecto_id IS NOT NULL) as movimientos_vinculados,
          (SELECT COUNT(*) FROM movimientos WHERE proyecto IS NOT NULL AND proyecto_id IS NULL) as movimientos_sin_vincular
      `);

      console.log(`
   ╔══════════════════════════════════════════╗
   ║        RESUMEN DE MIGRACIÓN              ║
   ╠══════════════════════════════════════════╣
   ║ ✅ Proyectos activos: ${estadisticas[0].proyectos_activos.toString().padEnd(18)} ║
   ║ ✅ Movimientos vinculados: ${estadisticas[0].movimientos_vinculados.toString().padEnd(13)} ║
   ║ ⚠️  Movimientos sin vincular: ${estadisticas[0].movimientos_sin_vincular.toString().padEnd(10)} ║
   ╚══════════════════════════════════════════╝
      `);

      if (parseInt(estadisticas[0].movimientos_sin_vincular) > 0) {
        console.log('   ⚠️  ATENCIÓN: Algunos movimientos no pudieron ser vinculados automáticamente');
        console.log('   💡 Esto puede ocurrir si hay variaciones en los nombres que no fueron normalizadas');
        console.log('   💡 Puede vincularlos manualmente desde la interfaz del sistema');
      }

      console.log('✅ Migración de proyectos completada exitosamente');
    } catch (error) {
      console.error('❌ Error durante la migración:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⏪ Revirtiendo migración de proyectos...');

    try {
      // Desvincular movimientos
      await queryInterface.sequelize.query(`
        UPDATE movimientos SET proyecto_id = NULL WHERE proyecto_id IS NOT NULL;
      `);

      console.log('✅ Movimientos desvinculados');

      // Eliminar proyectos migrados (solo los que no tienen información adicional)
      const [resultado] = await queryInterface.sequelize.query(`
        DELETE FROM proyectos
        WHERE descripcion IS NULL
          AND cliente IS NULL
          AND ubicacion_obra IS NULL
          AND presupuesto_estimado IS NULL
          AND presupuesto_real IS NULL;
      `);

      console.log(`✅ ${resultado.rowCount || 0} proyectos eliminados`);
      console.log('✅ Rollback completado');
    } catch (error) {
      console.error('❌ Error durante el rollback:', error);
      throw error;
    }
  }
};
