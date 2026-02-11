/**
 * Print Agent - Agente de Impresión Local
 * 
 * Este servicio corre en la Mac Mini y:
 * 1. Escucha la colección 'cola_impresion' en Firebase
 * 2. Cuando detecta un trabajo pendiente, genera el PDF localmente
 * 3. Envía el PDF a la impresora térmica configurada
 * 4. Actualiza el estado del trabajo en Firebase
 */

import admin from 'firebase-admin';
import net from 'net';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { pdf } from 'pdf-to-img';

// Configuración
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRINTER_IP = process.env.PRINTER_IP || '192.168.100.50';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const TEMP_DIR = join(__dirname, 'temp');

// Heartbeat para healthcheck de Docker
setInterval(() => {
  writeFileSync('/tmp/print_heartbeat', Date.now().toString());
}, 30000);
// Escribir heartbeat inicial
writeFileSync('/tmp/print_heartbeat', Date.now().toString());

// Crear directorio temporal si no existe
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

// Inicializar Firebase Admin
const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('❌ ERROR: No se encontró serviceAccountKey.json');
  console.error('   Coloca el archivo de credenciales de Firebase en:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('🔥 Conectado a Firebase');
console.log(`🖨️  Impresora de red: ${PRINTER_IP}:${PRINTER_PORT}`);
console.log('👂 Escuchando trabajos de impresión...\n');

// ===== GENERADOR DE PDF PARA TICKETS =====

function generarPDFOrdenCompra(datos) {
  return new Promise((resolve, reject) => {
    try {
      // Ancho de ticket térmico (80mm = ~227 puntos)
      const anchoTicket = 227;

      // Crear documento PDF
      const doc = new PDFDocument({
        size: [anchoTicket, 600], // Altura se ajustará
        margin: 10
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margen = 10;
      let y = 20;

      // === HEADER ===
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('3G ARQUITECTURA TEXTIL', margen, y, {
        width: anchoTicket - (margen * 2),
        align: 'center'
      });
      y += 20;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('ORDEN DE COMPRA', margen, y, {
        width: anchoTicket - (margen * 2),
        align: 'center'
      });
      y += 18;

      // Línea divisoria
      doc.moveTo(margen, y).lineTo(anchoTicket - margen, y).stroke();
      y += 10;

      // === DATOS DE LA ORDEN ===
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`TICKET: ${datos.ticket_id}`, margen, y);
      y += 14;

      doc.fontSize(8).font('Helvetica');
      const fecha = new Date(datos.fecha).toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Fecha: ${fecha}`, margen, y);
      y += 12;

      doc.text(`Proveedor: ${datos.proveedor}`, margen, y);
      y += 12;

      doc.text(`Creado por: ${datos.creador}`, margen, y);
      y += 15;

      // Línea divisoria
      doc.moveTo(margen, y).lineTo(anchoTicket - margen, y).stroke();
      y += 10;

      // === ARTÍCULOS ===
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('ARTÍCULOS', margen, y);
      y += 12;

      doc.fontSize(7).font('Helvetica');
      for (const art of datos.articulos) {
        // Nombre del artículo
        doc.font('Helvetica-Bold');
        doc.text(art.nombre, margen, y, { width: anchoTicket - (margen * 2) });
        y += doc.heightOfString(art.nombre, { width: anchoTicket - (margen * 2) }) + 2;

        // Cantidad y costo
        doc.font('Helvetica');
        const cantidad = `${art.cantidad} ${art.unidad}`;
        const costo = art.costo_unitario ? `@ $${parseFloat(art.costo_unitario).toFixed(2)}` : '';
        const subtotal = art.subtotal ? `= $${parseFloat(art.subtotal).toFixed(2)}` : '';
        doc.text(`  ${cantidad} ${costo} ${subtotal}`, margen, y);
        y += 10;
      }
      y += 5;

      // Línea divisoria
      doc.moveTo(margen, y).lineTo(anchoTicket - margen, y).stroke();
      y += 10;

      // === TOTAL ===
      doc.fontSize(10).font('Helvetica-Bold');
      const total = parseFloat(datos.total_estimado || 0).toFixed(2);
      doc.text(`TOTAL: $${total}`, margen, y, {
        width: anchoTicket - (margen * 2),
        align: 'right'
      });
      y += 18;

      // === OBSERVACIONES ===
      if (datos.observaciones) {
        doc.fontSize(7).font('Helvetica');
        doc.text(`Obs: ${datos.observaciones}`, margen, y, {
          width: anchoTicket - (margen * 2)
        });
        y += doc.heightOfString(datos.observaciones, { width: anchoTicket - (margen * 2) }) + 5;
      }

      // === FOOTER ===
      y += 10;
      doc.fontSize(6).font('Helvetica');
      doc.text('Sistema de Inventario 3G', margen, y, {
        width: anchoTicket - (margen * 2),
        align: 'center'
      });
      y += 15;

      // Espacio para corte automático
      doc.text(' ', margen, y);
      y += 20;

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ===== DESCARGAR IMAGEN DE URL =====

async function descargarImagen(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error descargando imagen:', error.message);
    return null;
  }
}

// ===== GENERADOR DE PDF PARA PEDIDOS (ESTILO FRONTEND) =====

async function generarPDFPedido(datos) {
  return new Promise(async (resolve, reject) => {
    try {
      // URLs de logos (mismas que el frontend)
      const logoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';

      // Descargar logo
      const logoBuffer = await descargarImagen(logoUrl);

      // Calcular altura dinámica según artículos
      const articulos = datos.articulos || [];
      let alturaEstimada = 150; // Base (header + info)

      // Agrupar por categoría
      const articulosPorCategoria = {};
      articulos.forEach(art => {
        const categoria = art.categoria || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
          articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(art);
      });

      // Calcular altura por artículos
      Object.keys(articulosPorCategoria).forEach(cat => {
        alturaEstimada += 15; // Título de categoría
        articulosPorCategoria[cat].forEach(art => {
          alturaEstimada += 18; // Por artículo
        });
      });
      alturaEstimada += 60; // Footer y firmas

      // Crear documento (80mm de ancho = 227 puntos aprox)
      const anchoTicket = 227;
      const altoTicket = Math.max(350, alturaEstimada);

      const doc = new PDFDocument({
        size: [anchoTicket, altoTicket],
        margin: 10
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margen = 10;
      const anchoUtil = anchoTicket - (margen * 2);
      let y = 8;

      // === LOGO ===
      if (logoBuffer) {
        try {
          const logoWidth = 180;
          const logoHeight = 45; // Aproximado
          const logoX = (anchoTicket - logoWidth) / 2;
          doc.image(logoBuffer, logoX, y, { width: logoWidth });
          y += logoHeight + 8;
        } catch (e) {
          console.error('Error insertando logo:', e.message);
          // Fallback: texto
          doc.fontSize(12).font('Helvetica-Bold');
          doc.text('3G ARQUITECTURA TEXTIL', margen, y, { width: anchoUtil, align: 'center' });
          y += 20;
        }
      } else {
        // Fallback sin logo
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('3G ARQUITECTURA TEXTIL', margen, y, { width: anchoUtil, align: 'center' });
        y += 20;
      }

      // === INFORMACIÓN CENTRADA (ESTILO FRONTEND) ===
      doc.fontSize(7);

      // Supervisor
      doc.font('Helvetica-Bold');
      doc.text('SUPERVISOR', margen, y, { width: anchoUtil, align: 'center' });
      y += 10;
      doc.font('Helvetica');
      doc.text(datos.creador || 'N/A', margen, y, { width: anchoUtil, align: 'center' });
      y += 12;

      // Proyecto
      doc.font('Helvetica-Bold');
      doc.text('PROYECTO', margen, y, { width: anchoUtil, align: 'center' });
      y += 10;
      doc.font('Helvetica');
      const proyecto = datos.proyecto || 'Sin proyecto';
      doc.text(proyecto, margen, y, { width: anchoUtil, align: 'center' });
      y += 12;

      // Fecha
      doc.font('Helvetica-Bold');
      doc.text('FECHA DE SALIDA', margen, y, { width: anchoUtil, align: 'center' });
      y += 10;
      doc.font('Helvetica');
      const fecha = new Date(datos.fecha).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      doc.text(fecha, margen, y, { width: anchoUtil, align: 'center' });
      y += 15;

      // === TÍTULO PRINCIPAL ===
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('ORDEN DE SALIDA', margen, y, { width: anchoUtil, align: 'center' });
      y += 15;

      // Línea divisoria
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(margen, y).lineTo(anchoTicket - margen, y).stroke();
      y += 8;

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      doc.fontSize(7);

      Object.keys(articulosPorCategoria).forEach(categoria => {
        // Nombre de categoría
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text(categoria.toUpperCase(), margen, y);
        y += 12;

        // Lista de artículos
        doc.font('Helvetica').fontSize(7);
        articulosPorCategoria[categoria].forEach(art => {
          const texto = `• ${art.nombre} - ${art.cantidad} ${art.unidad || 'pz'}`;
          doc.font('Helvetica-Bold');
          doc.text(texto, margen, y, { width: anchoUtil });
          y += doc.heightOfString(texto, { width: anchoUtil }) + 4;
        });

        y += 5; // Espacio entre categorías
      });

      // Línea divisoria
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(margen, y).lineTo(anchoTicket - margen, y).stroke();
      y += 10;

      // === TOTAL ===
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`TOTAL: ${datos.total_piezas || articulos.length} piezas`, margen, y, {
        width: anchoUtil,
        align: 'right'
      });
      y += 18;

      // === FIRMAS ===
      y += 5;
      doc.fontSize(6).font('Helvetica');
      doc.text('_____________________', margen, y);
      doc.text('_____________________', anchoTicket / 2 + 5, y);
      y += 10;
      doc.text('Entregó (Almacén)', margen, y);
      doc.text('Recibió', anchoTicket / 2 + 5, y);
      y += 15;

      // === TICKET ID ===
      doc.fontSize(5).font('Helvetica');
      doc.text(`Ticket: ${datos.ticket_id}`, margen, y, { width: anchoUtil, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ===== FUNCIONES DE IMPRESIÓN ESC/POS =====

/**
 * Convierte un buffer de imagen a comandos ESC/POS para impresora térmica
 * @param {Buffer} imageBuffer - Buffer de imagen PNG en blanco y negro
 * @param {number} width - Ancho de la imagen en píxeles
 */
function imageToEscPos(imageBuffer, width, height) {
  const commands = [];

  // ESC @ - Inicializar impresora
  commands.push(Buffer.from([0x1B, 0x40]));

  // Centrar imagen
  commands.push(Buffer.from([0x1B, 0x61, 0x01]));

  // GS v 0 - Imprimir imagen raster
  // Formato: GS v 0 m xL xH yL yH d1...dk
  const bytesPerLine = Math.ceil(width / 8);
  const xL = bytesPerLine & 0xFF;
  const xH = (bytesPerLine >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;

  commands.push(Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
  commands.push(imageBuffer);

  // Alimentar papel y cortar
  commands.push(Buffer.from([0x1B, 0x64, 0x05])); // Feed 5 líneas
  commands.push(Buffer.from([0x1D, 0x56, 0x00])); // Corte total

  return Buffer.concat(commands);
}

/**
 * Convierte PDF a imagen y luego a comandos ESC/POS
 */
async function pdfToEscPos(pdfBuffer) {
  // Guardar PDF temporalmente
  const tempPdfPath = join(TEMP_DIR, `temp_${Date.now()}.pdf`);
  writeFileSync(tempPdfPath, pdfBuffer);

  try {
    // Convertir PDF a imagen
    const document = await pdf(tempPdfPath, { scale: 2.0 });
    let allCommands = [];

    for await (const image of document) {
      // Convertir a escala de grises, redimensionar al ancho de ticket (576 px para 80mm)
      const ticketWidth = 576;

      const processedImage = await sharp(image)
        .resize(ticketWidth, null, { fit: 'inside' })
        .grayscale()
        .threshold(128)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data, info } = processedImage;

      // Convertir a formato de bits (1 bit por píxel)
      const bytesPerLine = Math.ceil(info.width / 8);
      const bitmapData = Buffer.alloc(bytesPerLine * info.height);

      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const pixelIndex = y * info.width + x;
          const pixelValue = data[pixelIndex];

          // Si el píxel es oscuro (< 128), encender el bit
          if (pixelValue < 128) {
            const byteIndex = y * bytesPerLine + Math.floor(x / 8);
            const bitPosition = 7 - (x % 8);
            bitmapData[byteIndex] |= (1 << bitPosition);
          }
        }
      }

      // Generar comandos ESC/POS
      const escPosData = imageToEscPos(bitmapData, info.width, info.height);
      allCommands.push(escPosData);
    }

    return Buffer.concat(allCommands);
  } finally {
    // Limpiar archivo temporal
    try { unlinkSync(tempPdfPath); } catch (e) { }
  }
}

/**
 * Envía comandos ESC/POS a la impresora via socket
 */
function enviarAImpresora(escPosBuffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log(`   📡 Conectado a impresora ${PRINTER_IP}:${PRINTER_PORT}`);
      client.write(escPosBuffer);
      client.end();
    });

    client.on('close', () => {
      console.log('   ✅ Datos enviados a impresora');
      resolve();
    });

    client.on('error', (err) => {
      console.error(`   ❌ Error de conexión: ${err.message}`);
      reject(err);
    });

    client.setTimeout(15000, () => {
      client.destroy();
      reject(new Error('Timeout conectando a impresora'));
    });
  });
}

// ===== PROCESAR TRABAJO =====

async function procesarTrabajo(jobId, job) {
  console.log(`\n📥 Procesando trabajo: ${jobId}`);
  console.log(`   Tipo: ${job.tipo}`);
  console.log(`   Ticket: ${job.ticket_id || 'N/A'}`);

  try {
    let pdfBuffer;

    if (job.tipo === 'orden_compra' && job.datos) {
      // Generar PDF de orden de compra
      console.log('   📄 Generando PDF de Orden de Compra...');
      pdfBuffer = await generarPDFOrdenCompra(job.datos);
    } else if (job.tipo === 'pedido' && job.datos) {
      // Generar PDF de pedido/orden de salida
      console.log('   📄 Generando PDF de Orden de Salida...');
      pdfBuffer = await generarPDFPedido(job.datos);
    } else if (job.tipo === 'texto' && job.contenido) {
      // Generar PDF de texto simple (para pruebas)
      const doc = new PDFDocument({ size: [227, 200], margin: 10 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      await new Promise((resolve) => {
        doc.on('end', resolve);
        doc.fontSize(10).text(job.contenido, { align: 'center' });
        doc.end();
      });
      pdfBuffer = Buffer.concat(chunks);
    } else {
      throw new Error(`Tipo de trabajo no soportado: ${job.tipo}`);
    }

    // Convertir PDF a ESC/POS
    console.log(`   🔄 Convirtiendo a formato de impresora...`);
    const escPosData = await pdfToEscPos(pdfBuffer);

    // Enviar a impresora
    console.log(`   📤 Enviando a impresora...`);
    await enviarAImpresora(escPosData);

    // Actualizar estado en Firebase
    await db.collection('cola_impresion').doc(jobId).update({
      estado: 'completado',
      procesado_at: new Date(),
      resultado: 'OK'
    });

    console.log(`   ✅ Trabajo completado: ${jobId}\n`);

  } catch (error) {
    console.error(`   ❌ Error procesando trabajo: ${error.message}`);

    // Marcar como error en Firebase
    await db.collection('cola_impresion').doc(jobId).update({
      estado: 'error',
      procesado_at: new Date(),
      error: error.message
    });
  }
}

// ===== POLLING DE FIREBASE (más confiable que listeners) =====

const POLL_INTERVAL = 10000; // 10 segundos
let isProcessing = false;

async function verificarTrabajosPendientes() {
  if (isProcessing) return;

  try {
    isProcessing = true;

    const snapshot = await db.collection('cola_impresion')
      .where('estado', '==', 'pendiente')
      .get();

    if (!snapshot.empty) {
      console.log(`📋 Encontrados ${snapshot.size} trabajo(s) pendiente(s)`);

      for (const doc of snapshot.docs) {
        const job = doc.data();
        const jobId = doc.id;
        await procesarTrabajo(jobId, job);
      }
    }
  } catch (error) {
    console.error('❌ Error al verificar trabajos:', error.message);
  } finally {
    isProcessing = false;
  }
}

// Iniciar polling
const pollInterval = setInterval(verificarTrabajosPendientes, POLL_INTERVAL);

// Verificar inmediatamente al inicio
verificarTrabajosPendientes();

console.log(`⏱️  Verificando trabajos cada ${POLL_INTERVAL / 1000} segundos`);

// ===== MANEJO DE CIERRE =====

process.on('SIGINT', () => {
  console.log('\n👋 Cerrando agente de impresión...');
  clearInterval(pollInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando agente de impresión...');
  clearInterval(pollInterval);
  process.exit(0);
});

console.log('✅ Agente de impresión iniciado');
console.log('   Presiona Ctrl+C para detener\n');

