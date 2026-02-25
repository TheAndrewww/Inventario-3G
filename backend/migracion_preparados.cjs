const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL || process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  }
});

(async () => {
  try {
    console.log('🔄 Iniciando migración de proyectos GTIA/MTO a Preparado en PRODUCCIÓN...');
    console.log('');
    
    // Mover proyectos GTIA/MTO que NO están completados a instalacion (Preparado)
    const [result] = await sequelize.query(`
      UPDATE produccion_proyectos
      SET etapa_actual = 'instalacion',
          instalacion_completado_en = COALESCE(instalacion_completado_en, NOW()),
          updated_at = NOW()
      WHERE activo = true
        AND (tipo_proyecto = 'GTIA' OR (tipo_proyecto = 'MTO' AND es_extensivo = false))
        AND etapa_actual NOT IN ('instalacion', 'completado')
      RETURNING id, nombre, tipo_proyecto
    `);
    
    console.log('✅ Proyectos migrados a Preparado:', result.length);
    result.forEach(p => {
      console.log(`  - ${p.nombre} (${p.tipo_proyecto})`);
    });
    
    console.log('');
    
    // Verificar estado final
    const [stats] = await sequelize.query(`
      SELECT etapa_actual, COUNT(*) as total
      FROM produccion_proyectos 
      WHERE activo = true 
      GROUP BY etapa_actual
      ORDER BY etapa_actual
    `);
    
    console.log('📊 Estado final de proyectos activos:');
    stats.forEach(s => {
      console.log(`  ${s.etapa_actual}: ${s.total}`);
    });
    
    console.log('');
    console.log('✅ Migración completada exitosamente en PRODUCCIÓN');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
