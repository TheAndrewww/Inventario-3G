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
import { exec } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

// Configuración
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRINTER_NAME = process.env.PRINTER_NAME || 'TicketPrinter';
const TEMP_DIR = join(__dirname, 'temp');

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
console.log(`🖨️  Impresora configurada: ${PRINTER_NAME}`);
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

// ===== FUNCIÓN DE IMPRESIÓN =====

function imprimirArchivo(filePath) {
  return new Promise((resolve, reject) => {
    const command = `lp -d "${PRINTER_NAME}" -o fit-to-page "${filePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error al imprimir: ${error.message}`);
        reject(error);
        return;
      }
      console.log(`✅ Impreso correctamente: ${stdout || 'OK'}`);
      resolve(stdout);
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
      // Generar PDF desde los datos
      console.log('   📄 Generando PDF...');
      pdfBuffer = await generarPDFOrdenCompra(job.datos);
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

    // Guardar PDF temporal
    const tempFile = join(TEMP_DIR, `print_${jobId}.pdf`);
    writeFileSync(tempFile, pdfBuffer);
    console.log(`   💾 PDF guardado: ${tempFile}`);

    // Imprimir
    await imprimirArchivo(tempFile);

    // Eliminar archivo temporal
    unlinkSync(tempFile);

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

// ===== LISTENER DE FIREBASE =====

const unsubscribe = db.collection('cola_impresion')
  .where('estado', '==', 'pendiente')
  .onSnapshot(
    snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const job = change.doc.data();
          const jobId = change.doc.id;
          procesarTrabajo(jobId, job);
        }
      });
    },
    error => {
      console.error('❌ Error en listener de Firebase:', error);
    }
  );

// ===== MANEJO DE CIERRE =====

process.on('SIGINT', () => {
  console.log('\n👋 Cerrando agente de impresión...');
  unsubscribe();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando agente de impresión...');
  unsubscribe();
  process.exit(0);
});

console.log('✅ Agente de impresión iniciado');
console.log('   Presiona Ctrl+C para detener\n');
