import { sequelize } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ejecutarMigracion() {
    try {
        console.log('🚀 Iniciando migración: Equipos → Camionetas\n');

        // Leer el archivo SQL
        const migracionPath = path.join(__dirname, '../migrations/011-migrar-equipos-a-camionetas.sql');
        const sql = fs.readFileSync(migracionPath, 'utf-8');

        console.log('📄 Leyendo archivo de migración...');
        console.log(`   Archivo: ${migracionPath}\n`);

        // Verificar que la tabla equipos existe
        const [tablas] = await sequelize.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'equipos';
        `);

        if (tablas.length === 0) {
            console.log('⚠️  Tabla "equipos" no existe. Puede ser que ya se haya migrado.');
            console.log('   Verific checking si existe tabla "camionetas"...\n');

            const [camionetas] = await sequelize.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'camionetas';
            `);

            if (camionetas.length > 0) {
                console.log('✅ Tabla "camionetas" ya existe. Migración probablemente ya ejecutada.');
                process.exit(0);
            } else {
                console.log('❌ Error: No existe ni "equipos" ni "camionetas".');
                console.log('   Por favor revisa el estado de la base de datos.');
                process.exit(1);
            }
        }

        console.log('✅ Tabla "equipos" encontrada. Procediendo con la migración...\n');

        // Contar equipos actuales
        const [equiposCount] = await sequelize.query('SELECT COUNT(*) as count FROM equipos;');
        console.log(`📊 Equipos actuales: ${equiposCount[0].count}\n`);

        // Ejecutar la migración
        console.log('🔄 Ejecutando migración SQL...');
        await sequelize.query(sql);

        console.log('✅ Migración SQL ejecutada correctamente\n');

        // Verificar el resultado
        const [camionetasCount] = await sequelize.query('SELECT COUNT(*) as count FROM camionetas;');
        console.log(`📊 Camionetas creadas: ${camionetasCount[0].count}`);

        const [stockCount] = await sequelize.query('SELECT COUNT(*) as count FROM stock_minimo_camioneta;');
        console.log(`📊 Registros en stock_minimo_camioneta: ${stockCount[0].count}\n`);

        // Verificar nuevas columnas
        const [columnas] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'unidades_herramienta_renta'
            AND column_name IN ('ubicacion_actual', 'camioneta_id', 'empleado_propietario_id');
        `);
        console.log(`📊 Nuevas columnas en unidades_herramienta_renta: ${columnas.length}/3`);

        if (columnas.length === 3) {
            console.log('   ✅ ubicacion_actual');
            console.log('   ✅ camioneta_id');
            console.log('   ✅ empleado_propietario_id\n');
        }

        console.log('✨ Migración completada exitosamente\n');
        console.log('📝 Resumen:');
        console.log(`   - Tabla "equipos" renombrada a "camionetas"`);
        console.log(`   - ${camionetasCount[0].count} camionetas migradas`);
        console.log(`   - Tabla "stock_minimo_camioneta" creada`);
        console.log(`   - Nuevos campos agregados a unidades_herramienta_renta`);
        console.log(`   - Referencias actualizadas en otras tablas\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        console.error('\n💡 Si ya ejecutaste la migración, puedes ignorar este error.');
        console.error('   De lo contrario, revisa el error y vuelve a intentar.\n');
        process.exit(1);
    }
}

ejecutarMigracion();
