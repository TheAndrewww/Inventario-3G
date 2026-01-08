import { sequelize } from '../src/config/database.js';

async function verificarTablas() {
  try {
    console.log('🔄 Conectando a la base de datos de producción...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    // Listar todas las tablas
    const [tables] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tablas en la base de datos:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    console.log('\n🔍 Verificando tablas específicas:');
    const [equiposCheck] = await sequelize.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipos'"
    );
    console.log(`  equipos: ${parseInt(equiposCheck[0].count) > 0 ? '✅ Existe' : '❌ No existe'}`);

    const [camionetasCheck] = await sequelize.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'camionetas'"
    );
    console.log(`  camionetas: ${parseInt(camionetasCheck[0].count) > 0 ? '✅ Existe' : '❌ No existe'}`);

    // Si existe camionetas, contar registros
    if (parseInt(camionetasCheck[0].count) > 0) {
      const [count] = await sequelize.query('SELECT COUNT(*) as total FROM camionetas');
      console.log(`\n📊 Total de camionetas: ${count[0].total}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarTablas();
