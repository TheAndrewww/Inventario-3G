/**
 * Script de Migración: Data URLs → Cloudinary
 * 
 * Este script migra las imágenes de anuncios que están guardadas como data URLs
 * en la base de datos a Cloudinary, actualizando los registros con las nuevas URLs.
 * 
 * Uso:
 *   node backend/scripts/migrateAnunciosToCloudinary.js
 * 
 * El script:
 * 1. Lee todos los anuncios donde imagen_url empieza con 'data:'
 * 2. Sube cada imagen a Cloudinary
 * 3. Actualiza el registro en BD con la URL de Cloudinary
 * 4. Muestra progreso y resumen final
 */

import db from '../src/config/database.js';
import { QueryTypes } from 'sequelize';
import { subirImagenAnuncio } from '../src/services/cloudinaryAnuncios.service.js';

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
    progress: (current, total, msg) => console.log(`${colors.bold}[${current}/${total}]${colors.reset} ${msg}`)
};

async function migrateAnunciosToCloudinary() {
    console.log('\n');
    console.log('='.repeat(60));
    console.log(`${colors.bold}🔄 MIGRACIÓN DE IMÁGENES A CLOUDINARY${colors.reset}`);
    console.log('='.repeat(60));
    console.log('\n');

    try {
        // Conectar a la base de datos
        log.info('Conectando a la base de datos...');
        await db.authenticate();
        log.success('Conexión establecida\n');

        // Obtener anuncios con data URLs
        log.info('Buscando anuncios con data URLs...');
        const anunciosDataUrl = await db.query(
            `SELECT id, frase, imagen_url 
       FROM anuncios 
       WHERE imagen_url LIKE 'data:%'
       ORDER BY id ASC`,
            { type: QueryTypes.SELECT }
        );

        if (anunciosDataUrl.length === 0) {
            log.success('No hay anuncios con data URLs para migrar. ¡Todo está en Cloudinary!');
            console.log('\n');
            process.exit(0);
        }

        log.info(`Encontrados ${colors.bold}${anunciosDataUrl.length}${colors.reset} anuncios con data URLs para migrar\n`);

        // Estadísticas
        const stats = {
            total: anunciosDataUrl.length,
            migrados: 0,
            errores: 0,
            saltados: 0
        };

        // Procesar cada anuncio
        for (let i = 0; i < anunciosDataUrl.length; i++) {
            const anuncio = anunciosDataUrl[i];
            const fraseCorta = anuncio.frase.length > 40
                ? anuncio.frase.substring(0, 40) + '...'
                : anuncio.frase;

            log.progress(i + 1, stats.total, `ID ${anuncio.id}: "${fraseCorta}"`);

            try {
                // Verificar que el data URL es válido
                if (!anuncio.imagen_url.startsWith('data:image')) {
                    log.warning(`  → Data URL no válido, saltando...`);
                    stats.saltados++;
                    continue;
                }

                // Subir a Cloudinary
                const cloudinaryUrl = await subirImagenAnuncio(anuncio.imagen_url, {
                    folder: 'anuncios',
                    public_id: `anuncio_migrado_${anuncio.id}_${Date.now()}`
                });

                // Actualizar en base de datos
                await db.query(
                    `UPDATE anuncios 
           SET imagen_url = :cloudinaryUrl, updated_at = NOW() 
           WHERE id = :id`,
                    {
                        replacements: { cloudinaryUrl, id: anuncio.id },
                        type: QueryTypes.UPDATE
                    }
                );

                log.success(`  → Migrado a: ${cloudinaryUrl.substring(0, 60)}...`);
                stats.migrados++;

                // Pequeña pausa para no sobrecargar Cloudinary
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                log.error(`  → Error: ${error.message}`);
                stats.errores++;
            }
        }

        // Resumen final
        console.log('\n');
        console.log('='.repeat(60));
        console.log(`${colors.bold}📊 RESUMEN DE MIGRACIÓN${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`  Total procesados:  ${stats.total}`);
        console.log(`  ${colors.green}Migrados correctamente:${colors.reset}  ${stats.migrados}`);
        console.log(`  ${colors.yellow}Saltados:${colors.reset}  ${stats.saltados}`);
        console.log(`  ${colors.red}Con errores:${colors.reset}  ${stats.errores}`);
        console.log('='.repeat(60));
        console.log('\n');

        // Verificar si quedan data URLs
        const [remaining] = await db.query(
            `SELECT COUNT(*) as count FROM anuncios WHERE imagen_url LIKE 'data:%'`,
            { type: QueryTypes.SELECT }
        );

        if (remaining.count > 0) {
            log.warning(`Aún quedan ${remaining.count} anuncios con data URLs. Ejecuta el script nuevamente.`);
        } else {
            log.success('¡Migración completada! Todas las imágenes están en Cloudinary.');
        }

        console.log('\n');
        process.exit(stats.errores > 0 ? 1 : 0);

    } catch (error) {
        log.error(`Error fatal: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Ejecutar migración
migrateAnunciosToCloudinary();
