import cron from 'node-cron';
import db from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { leerAnunciosCalendario } from '../services/googleSheets.service.js';
import { generarImagenAnuncio, obtenerImagenTensito } from '../services/geminiAnuncios.service.js';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Job para sincronizar y generar anuncios automáticamente cada hora
 * - Compara textos exactos entre spreadsheet y BD
 * - Desactiva anuncios que ya no coinciden
 * - Genera imágenes para anuncios nuevos
 */
export const iniciarJobAnuncios = () => {
  // Ejecutar cada hora en el minuto 0
  cron.schedule('0 * * * *', async () => {
    console.log('');
    console.log('🤖 ========================================');
    console.log('🤖 JOB AUTOMÁTICO: Sincronización de Anuncios');
    console.log(`🤖 Hora: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    console.log('🤖 ========================================');

    try {
      await sincronizarYGenerarAnuncios();
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
  console.log('   - Horario: Cada hora (minuto 0)');
  console.log('   - Zona horaria: America/Mexico_City');
  console.log('');

  // Permitir ejecución manual
  return sincronizarYGenerarAnuncios;
};

/**
 * Función principal que sincroniza y genera anuncios
 */
async function sincronizarYGenerarAnuncios() {
  const hoy = new Date();
  const mes = MESES[hoy.getMonth()];
  const fechaStr = hoy.toISOString().split('T')[0];

  console.log(`📅 Sincronizando anuncios para: ${fechaStr}`);

  // Paso 1: Leer anuncios del spreadsheet (sección ANUNCIOS)
  console.log('📊 Leyendo anuncios del calendario...');
  let anunciosCalendario = [];

  try {
    const resultado = await leerAnunciosCalendario(mes);
    anunciosCalendario = resultado.data.anuncios || [];
    console.log(`✅ ${anunciosCalendario.length} anuncios encontrados en spreadsheet`);
  } catch (error) {
    console.error('❌ Error al leer calendario:', error.message);
    return;
  }

  if (anunciosCalendario.length === 0) {
    console.log('⚠️ No hay anuncios en el calendario. Desactivando todos los activos de hoy...');
    await db.query(
      `UPDATE anuncios SET activo = false WHERE fecha = :fecha AND activo = true`,
      { replacements: { fecha: fechaStr }, type: QueryTypes.UPDATE }
    );
    return;
  }

  // Paso 2: Obtener anuncios activos de hoy de la BD
  const anunciosBD = await db.query(
    `SELECT id, frase, imagen_url FROM anuncios WHERE fecha = :fecha AND activo = true`,
    { replacements: { fecha: fechaStr }, type: QueryTypes.SELECT }
  );
  console.log(`📦 ${anunciosBD.length} anuncios activos en BD`);

  // Paso 3: Crear set de frases del calendario (texto EXACTO)
  const frasesCalendario = new Set();
  const anunciosNuevos = [];

  anunciosCalendario.forEach(a => {
    const fraseExacta = a.textoAnuncio?.trim();
    if (fraseExacta) {
      frasesCalendario.add(fraseExacta);
    }
  });

  // Paso 4: Crear mapa de frases en BD para comparar
  const frasesBD = new Map();
  anunciosBD.forEach(a => {
    if (a.frase) {
      frasesBD.set(a.frase.trim(), a);
    }
  });

  // Paso 5: Identificar anuncios a desactivar (ya no están en calendario)
  const idsADesactivar = [];
  anunciosBD.forEach(a => {
    const fraseExacta = a.frase?.trim();
    if (!frasesCalendario.has(fraseExacta)) {
      idsADesactivar.push(a.id);
      console.log(`🗑️ Anuncio "${fraseExacta?.substring(0, 30)}..." ya no está en calendario`);
    }
  });

  // Paso 6: Identificar anuncios nuevos (no generados aún)
  anunciosCalendario.forEach(a => {
    const fraseExacta = a.textoAnuncio?.trim();
    if (fraseExacta && !frasesBD.has(fraseExacta)) {
      anunciosNuevos.push(a);
      console.log(`✨ Nuevo anuncio: "${fraseExacta.substring(0, 30)}..."`);
    }
  });

  // Paso 7: Desactivar anuncios obsoletos
  if (idsADesactivar.length > 0) {
    console.log(`🗑️ Desactivando ${idsADesactivar.length} anuncios obsoletos...`);
    await db.query(
      `UPDATE anuncios SET activo = false WHERE id IN (:ids)`,
      { replacements: { ids: idsADesactivar }, type: QueryTypes.UPDATE }
    );
  }

  // Paso 8: Generar imágenes para anuncios nuevos
  if (anunciosNuevos.length > 0) {
    console.log(`🎨 Generando ${anunciosNuevos.length} anuncios nuevos...`);

    // Descargar Tensito una sola vez
    let tensito = null;
    try {
      console.log('🤖 Descargando imagen de Tensito...');
      tensito = await obtenerImagenTensito();
    } catch (error) {
      console.error('❌ Error al obtener Tensito:', error.message);
      return;
    }

    for (let i = 0; i < anunciosNuevos.length; i++) {
      const anuncio = anunciosNuevos[i];
      const textoAnuncio = anuncio.textoAnuncio.trim();

      console.log(`   ${i + 1}/${anunciosNuevos.length}: "${textoAnuncio.substring(0, 40)}..."`);

      try {
        // Generar imagen con IA
        const imagenDataUrl = await generarImagenAnuncio(
          textoAnuncio,
          tensito.base64,
          tensito.mimeType
        );

        // Guardar en BD
        await db.query(`
          INSERT INTO anuncios (
            fecha, frase, imagen_url, proyecto_nombre, equipo, tipo_anuncio, activo
          ) VALUES (:fecha, :frase, :imagenUrl, :proyecto, :equipo, 'calendario', true)
        `, {
          replacements: {
            fecha: fechaStr,
            frase: textoAnuncio,
            imagenUrl: imagenDataUrl,
            proyecto: anuncio.proyecto || null,
            equipo: anuncio.equipo || null
          },
          type: QueryTypes.INSERT
        });

        console.log(`      ✅ Generado y guardado`);
      } catch (error) {
        console.error(`      ❌ Error: ${error.message}`);
      }
    }
  }

  // Resumen
  console.log('');
  console.log('📊 Resumen:');
  console.log(`   - Anuncios en calendario: ${anunciosCalendario.length}`);
  console.log(`   - Desactivados: ${idsADesactivar.length}`);
  console.log(`   - Nuevos generados: ${anunciosNuevos.length}`);
}

/**
 * Función para ejecución manual
 */
export const generarAnunciosManual = sincronizarYGenerarAnuncios;

export default {
  iniciarJobAnuncios,
  generarAnunciosManual
};
