import { sequelize } from '../src/config/database.js';

async function verificarColumnas() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    console.log('📋 Columnas de la tabla camionetas:');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'camionetas'
      ORDER BY ordinal_position
    `);

    columns.forEach(col => {
      console.log(`  - ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log('\n📊 Datos de camionetas:');
    const [camionetas] = await sequelize.query('SELECT * FROM camionetas LIMIT 1');
    console.log(JSON.stringify(camionetas, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verificarColumnas();
