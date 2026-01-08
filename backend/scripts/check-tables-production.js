import { sequelize } from '../src/config/database.js';

async function verificarTablas() {
  try {
    console.log('🔄 Conectando a la base de datos de producción...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    // Verificar si existe tabla equipos
    const [equiposCheck] = await sequelize.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipos'"
    );
    const equiposExiste = parseInt(equiposCheck[0].count) > 0;
    console.log(`📦 Tabla 'equipos': ${equiposExiste ? '✅ Existe' : '❌ No existe'}`);

    // Verificar si existe tabla camionetas
    const [camionetasCheck] = await sequelize.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'camionetas'"
    );
    const camionetasExiste = parseInt(camionetasCheck[0].count) > 0;
    console.log(`🚗 Tabla 'camionetas': ${camionetasExiste ? '✅ Existe' : '❌ No existe'}`);

    // Verificar si existe columna camioneta_id en movimientos
    const [camionetaIdCheck] = await sequelize.query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'movimientos' AND column_name = 'camioneta_id'"
    );
    const camionetaIdExiste = parseInt(camionetaIdCheck[0].count) > 0;
    console.log(`🔗 Columna 'movimientos.camioneta_id': ${camionetaIdExiste ? '✅ Existe' : '❌ No existe'}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarTablas();
