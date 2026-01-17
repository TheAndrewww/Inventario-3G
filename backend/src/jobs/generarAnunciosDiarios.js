import cron from 'node-cron';
import db from '../config/database.js';
import { leerCalendarioMes } from '../services/googleSheets.service.js';
import { generarImagenAnuncio, generarFrasesDesdeProyectos } from '../services/geminiAnuncios.service.js';
import { subirImagenAnuncio } from '../services/cloudinaryAnuncios.service.js';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Job para generar anuncios automáticamente todos los días a las 12:00 AM (medianoche)
 */
export const iniciarJobAnuncios = () => {
  // Ejecutar todos los días a las 12:00 AM medianoche (hora de México)
  cron.schedule('0 0 * * *', async () => {
    console.log('');
    console.log('🤖 ========================================');
    console.log('🤖 JOB AUTOMÁTICO: Generación de Anuncios');
    console.log(`🤖 Hora: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    console.log('🤖 ========================================');

    try {
      await generarAnunciosDelDia();
      console.log('✅ Job completado exitosamente');
    } catch (error) {
      console.error('❌ Error en job de anuncios:', error);
    }

    console.log('🤖 ========================================');
    console.log('');
  }, {
    timezone: 'America/Mexico_City'
  });

  console.log('⏰ Job de anuncios programado:');
  console.log('   - Horario: 12:00 AM (medianoche) diario');
  console.log('   - Zona horaria: America/Mexico_City');
  console.log('');

  // También permitir ejecución manual
  return generarAnunciosDelDia;
};

/**
 * Función principal que genera los anuncios del día
 */
async function generarAnunciosDelDia() {
  const hoy = new Date();
  const mes = MESES[hoy.getMonth()];
  const dia = hoy.getDate();
  const fechaStr = hoy.toISOString().split('T')[0];

  console.log(`📅 Generando anuncios para: ${dia} de ${mes} (${fechaStr})`);

  // Paso 1: Verificar si ya existen anuncios para hoy
  const [anunciosExistentes] = await db.query(
    'SELECT COUNT(*) as count FROM anuncios WHERE fecha = :fecha',
    { replacements: { fecha: fechaStr } }
  );

  if (parseInt(anunciosExistentes[0].count) > 0) {
    console.log(`⚠️ Ya existen ${anunciosExistentes[0].count} anuncios para hoy`);
    console.log('   Saltando generación automática');
    return;
  }

  // Paso 2: Obtener proyectos del día desde Google Sheets
  console.log('📊 Consultando calendario de proyectos...');

  let proyectos = [];
  try {
    const calendarioData = await leerCalendarioMes(mes);
    proyectos = calendarioData.data.proyectos.filter(p => p.dia === dia);
    console.log(`✅ Proyectos encontrados: ${proyectos.length}`);
  } catch (error) {
    console.error('⚠️ Error al leer calendario:', error.message);
    console.log('   Generando anuncio genérico...');
  }

  // Paso 3: Si no hay proyectos, crear anuncio genérico
  if (proyectos.length === 0) {
    console.log('📢 Generando anuncio genérico (sin proyectos específicos)');

    const fraseGenerica = '3G VELARIAS - INNOVACIÓN EN TENSOESTRUCTURAS';
    const imagenPlaceholder = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png';

    await db.query(`
      INSERT INTO anuncios (
        fecha,
        frase,
        imagen_url,
        tipo_anuncio,
        activo
      ) VALUES (:fecha, :frase, :imagen, 'generico', true)
    `, { replacements: { fecha: fechaStr, frase: fraseGenerica, imagen: imagenPlaceholder } });

    console.log('✅ Anuncio genérico creado');
    return;
  }

  // Paso 4: Generar anuncios para cada proyecto
  console.log(`🎨 Generando ${proyectos.length} anuncios...`);

  const frases = generarFrasesDesdeProyectos(proyectos);
  const anunciosCreados = [];

  for (let i = 0; i < proyectos.length; i++) {
    const proyecto = proyectos[i];
    const frase = frases[i];

    console.log(`   ${i + 1}/${proyectos.length}: ${proyecto.nombre}`);

    try {
      // Generar descripción con IA (opcional)
      // const descripcionIA = await generarImagenAnuncio(frase);

      // Por ahora, usar imagen placeholder
      // TODO: Integrar generación real de imágenes con IA
      const imagenUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png';

      // Guardar en base de datos
      const [result] = await db.query(`
        INSERT INTO anuncios (
          fecha,
          frase,
          imagen_url,
          proyecto_nombre,
          equipo,
          tipo_anuncio,
          activo
        ) VALUES (:fecha, :frase, :imagen, :proyecto, :equipo, 'proyecto', true)
        RETURNING id, frase
      `, {
        replacements: {
          fecha: fechaStr,
          frase: frase,
          imagen: imagenUrl,
          proyecto: proyecto.nombre,
          equipo: proyecto.equipoHora
        }
      });

      anunciosCreados.push(result[0]);
      console.log(`      ✅ Anuncio ID ${result[0].id} creado`);

    } catch (error) {
      console.error(`      ❌ Error al crear anuncio: ${error.message}`);
    }
  }

  console.log('');
  console.log(`🎉 Resumen:`);
  console.log(`   - Proyectos procesados: ${proyectos.length}`);
  console.log(`   - Anuncios creados: ${anunciosCreados.length}`);
  console.log(`   - Fecha: ${fechaStr}`);

  return anunciosCreados;
}

/**
 * Función para generar anuncios manualmente (útil para testing)
 */
export const generarAnunciosManual = generarAnunciosDelDia;

export default {
  iniciarJobAnuncios,
  generarAnunciosManual
};
