import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrado. Usa:');
    console.error('   DATABASE_URL="postgresql://..." node backend/migrations/run-adelantar-conteo-migration.js');
    process.exit(1);
}

const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
        ssl: DATABASE_URL.includes('railway.app') ? {
            require: true,
            rejectUnauthorized: false
        } : false
    }
});

async function runMigration() {
    try {
        console.log('🚀 Migración: Adelantar Conteo Cíclico\n');

        await sequelize.authenticate();
        console.log('✅ Conexión a base de datos establecida\n');

        // Leer y ejecutar el SQL
        const sqlPath = path.join(__dirname, 'adelantar-conteo-ciclico.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Ejecutando SQL:\n');
        console.log(sql);
        console.log('\n---\n');

        // Ejecutar cada statement por separado
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            console.log(`▶ Ejecutando: ${stmt.substring(0, 60)}...`);
            await sequelize.query(stmt);
            console.log('  ✅ OK\n');
        }

        console.log('✅ Migración completada exitosamente');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error.message);
        await sequelize.close();
        process.exit(1);
    }
}

runMigration();
