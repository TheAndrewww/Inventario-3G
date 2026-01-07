import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ejecutarMigracion() {
  console.log('🚀 Ejecutando migración de tabla de anuncios...');
  console.log('');

  // Configurar conexión a PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    // Leer archivo SQL de migración
    const migrationPath = join(__dirname, '..', 'migrations', 'create-tabla-anuncios.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Archivo de migración cargado');
    console.log('📊 Ejecutando SQL...');
    console.log('');

    // Ejecutar migración
    await pool.query(migrationSQL);

    console.log('✅ Migración ejecutada exitosamente');
    console.log('');
    console.log('📋 Tabla creada: anuncios');
    console.log('📋 Vista creada: anuncios_activos_hoy');
    console.log('📋 Funciones creadas:');
    console.log('   - incrementar_vistas_anuncio()');
    console.log('   - obtener_anuncios_dia_actual()');
    console.log('');

    // Verificar que la tabla existe
    const checkTable = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'anuncios'
    `);

    const tablaExiste = parseInt(checkTable.rows[0].count) > 0;

    if (tablaExiste) {
      console.log('✅ Verificación: Tabla "anuncios" existe en la base de datos');

      // Contar registros
      const countRecords = await pool.query('SELECT COUNT(*) as count FROM anuncios');
      const totalAnuncios = parseInt(countRecords.rows[0].count);

      console.log(`📊 Total de anuncios en la tabla: ${totalAnuncios}`);
    } else {
      console.log('❌ Error: La tabla "anuncios" no fue creada');
    }

  } catch (error) {
    console.error('❌ Error al ejecutar migración:', error);
    console.error('');
    console.error('Detalles del error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('');
  console.log('🎉 Proceso completado');
}

// Ejecutar migración
ejecutarMigracion();
