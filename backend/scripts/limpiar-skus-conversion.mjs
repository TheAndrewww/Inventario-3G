/**
 * Script: Limpiar SKUs creados por la conversión de UnidadHerramientaRenta → SKUs
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node backend/scripts/limpiar-skus-conversion.mjs
 *
 * O si tienes .env en backend/:
 *   cd backend && node scripts/limpiar-skus-conversion.mjs
 *
 * Pasos que ejecuta:
 *   1. Muestra cuántos SKUs hay que eliminar (los creados por la migración)
 *   2. Muestra una muestra de 20 para que puedas verificar
 *   3. Pide confirmación antes de borrar
 *   4. Elimina los SKUs basura
 *   5. Verifica que los artículos es_herramienta=true siguen intactos
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env si existe
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('❌ No se encontró DATABASE_URL en el entorno.');
    console.error('   Ejecútalo así:');
    console.error('   DATABASE_URL="postgresql://..." node backend/scripts/limpiar-skus-conversion.mjs');
    process.exit(1);
}

const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
    },
    logging: false
});

const preguntar = (pregunta) => new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pregunta, (respuesta) => { rl.close(); resolve(respuesta.trim().toLowerCase()); });
});

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a Railway PostgreSQL establecida\n');

        // 1. Contar SKUs a eliminar
        const [[{ total }]] = await sequelize.query(
            `SELECT COUNT(*)::int AS total FROM articulos
             WHERE descripcion LIKE 'Convertido de unidad de renta%'`
        );
        console.log(`📊 SKUs creados por la conversión (a eliminar): ${total}`);

        if (total === 0) {
            console.log('✅ No hay SKUs de conversión. La base de datos ya está limpia.');
            await sequelize.close();
            return;
        }

        // 2. Verificar herramientas originales
        const [[{ originales }]] = await sequelize.query(
            `SELECT COUNT(*)::int AS originales FROM articulos WHERE es_herramienta = true`
        );
        console.log(`🔧 Artículos es_herramienta=true (tipos originales, NO se tocan): ${originales}`);

        // 3. Muestra de los que se van a borrar
        const [muestra] = await sequelize.query(
            `SELECT id, codigo_ean13, nombre
             FROM articulos
             WHERE descripcion LIKE 'Convertido de unidad de renta%'
             ORDER BY nombre LIMIT 15`
        );
        console.log('\n📋 Muestra de los primeros 15 SKUs a eliminar:');
        muestra.forEach(r => console.log(`   [${r.id}] ${r.codigo_ean13} — ${r.nombre}`));

        if (total > 15) console.log(`   ... y ${total - 15} más`);

        // 4. Confirmar
        console.log('');
        const resp = await preguntar(`¿Confirmas eliminar estos ${total} SKUs? (escribe "si" para continuar): `);
        if (resp !== 'si') {
            console.log('⛔ Operación cancelada. No se eliminó nada.');
            await sequelize.close();
            return;
        }

        // 5. Eliminar
        const t = await sequelize.transaction();
        try {
            const [, meta] = await sequelize.query(
                `DELETE FROM articulos WHERE descripcion LIKE 'Convertido de unidad de renta%'`,
                { transaction: t }
            );
            await t.commit();
            console.log(`\n✅ Eliminados ${total} SKUs de conversión correctamente.`);
        } catch (err) {
            await t.rollback();
            throw err;
        }

        // 6. Verificación final
        const [[{ restantes }]] = await sequelize.query(
            `SELECT COUNT(*)::int AS restantes FROM articulos
             WHERE descripcion LIKE 'Convertido de unidad de renta%'`
        );
        const [[{ herramientas }]] = await sequelize.query(
            `SELECT COUNT(*)::int AS herramientas FROM articulos WHERE es_herramienta = true`
        );
        console.log(`\n📊 Verificación final:`);
        console.log(`   SKUs de conversión restantes: ${restantes} (debe ser 0)`);
        console.log(`   Artículos es_herramienta=true intactos: ${herramientas}`);

        if (restantes === 0) {
            console.log('\n🎉 Base de datos limpia. El inventario debería mostrar los tipos agrupados correctamente.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
};

run();
