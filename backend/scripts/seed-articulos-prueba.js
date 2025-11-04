/**
 * Script para agregar artículos de prueba (20 consumibles + 10 herramientas)
 *
 * USO: node backend/scripts/seed-articulos-prueba.js
 */

import pkg from 'pg';
const { Client } = pkg;

const consumibles = [
  { nombre: 'TORNILLO HEXAGONAL 1/4"', descripcion: 'Tornillo hexagonal acero inoxidable', categoria: 1, stock: 500, minimo: 100, costo: 2.50 },
  { nombre: 'TUERCA HEXAGONAL 1/4"', descripcion: 'Tuerca hexagonal galvanizada', categoria: 1, stock: 450, minimo: 100, costo: 1.80 },
  { nombre: 'ARANDELA PLANA 1/4"', descripcion: 'Arandela plana acero', categoria: 1, stock: 800, minimo: 150, costo: 0.50 },
  { nombre: 'CABLE ELÉCTRICO CALIBRE 12', descripcion: 'Cable THW calibre 12 AWG', categoria: 2, stock: 1000, minimo: 200, costo: 8.50 },
  { nombre: 'CINTA AISLANTE NEGRA', descripcion: 'Cinta aislante uso eléctrico', categoria: 2, stock: 150, minimo: 30, costo: 12.00 },
  { nombre: 'INTERRUPTOR SENCILLO', descripcion: 'Interruptor eléctrico 15A', categoria: 2, stock: 80, minimo: 20, costo: 25.00 },
  { nombre: 'CONTACTO DOBLE POLARIZADO', descripcion: 'Contacto eléctrico 15A', categoria: 2, stock: 90, minimo: 20, costo: 35.00 },
  { nombre: 'TUBO CONDUIT 1/2"', descripcion: 'Tubo conduit pared delgada', categoria: 2, stock: 200, minimo: 40, costo: 45.00 },
  { nombre: 'CODO CONDUIT 1/2"', descripcion: 'Codo conduit 90 grados', categoria: 2, stock: 120, minimo: 30, costo: 8.50 },
  { nombre: 'PINTURA VINÍLICA BLANCA', descripcion: 'Pintura vinílica cubeta 19L', categoria: 3, stock: 25, minimo: 5, costo: 380.00 },
  { nombre: 'BROCHA 3 PULGADAS', descripcion: 'Brocha profesional cerda sintética', categoria: 3, stock: 35, minimo: 10, costo: 45.00 },
  { nombre: 'RODILLO 9 PULGADAS', descripcion: 'Rodillo para pintura con mango', categoria: 3, stock: 40, minimo: 10, costo: 65.00 },
  { nombre: 'THINNER ESTÁNDAR', descripcion: 'Thinner para limpieza 1L', categoria: 3, stock: 60, minimo: 15, costo: 35.00 },
  { nombre: 'LIJA AGUA GRANO 120', descripcion: 'Lija agua uso automotriz', categoria: 3, stock: 200, minimo: 50, costo: 8.00 },
  { nombre: 'CEMENTO GRIS 50KG', descripcion: 'Cemento Portland gris', categoria: 4, stock: 80, minimo: 20, costo: 180.00 },
  { nombre: 'ARENA FINA BULTO', descripcion: 'Arena fina cernida para mortero', categoria: 4, stock: 60, minimo: 15, costo: 45.00 },
  { nombre: 'GRAVA 3/4" BULTO', descripcion: 'Grava triturada para concreto', categoria: 4, stock: 50, minimo: 15, costo: 55.00 },
  { nombre: 'VARILLA CORRUGADA 3/8"', descripcion: 'Varilla corrugada 6 metros', categoria: 4, stock: 150, minimo: 30, costo: 95.00 },
  { nombre: 'ALAMBRE RECOCIDO ROLLO', descripcion: 'Alambre recocido calibre 18', categoria: 4, stock: 25, minimo: 8, costo: 280.00 },
  { nombre: 'PEGAMENTO PARA PVC', descripcion: 'Pegamento PVC 1/4 galón', categoria: 5, stock: 18, minimo: 5, costo: 85.00 }
];

const herramientas = [
  { nombre: 'TALADRO ELÉCTRICO 1/2"', descripcion: 'Taladro percutor 750W', categoria: 6, stock: 5, minimo: 2, costo: 1850.00, es_herramienta: true },
  { nombre: 'ESMERIL ANGULAR 4.5"', descripcion: 'Esmeril angular 900W', categoria: 6, stock: 4, minimo: 2, costo: 1200.00, es_herramienta: true },
  { nombre: 'SIERRA CIRCULAR 7.25"', descripcion: 'Sierra circular 1400W', categoria: 6, stock: 3, minimo: 1, costo: 2100.00, es_herramienta: true },
  { nombre: 'ROTOMARTILLO SDS PLUS', descripcion: 'Rotomartillo 800W con maletín', categoria: 6, stock: 3, minimo: 1, costo: 2800.00, es_herramienta: true },
  { nombre: 'NIVEL LÁSER AUTONIVELANTE', descripcion: 'Nivel láser cruz roja', categoria: 7, stock: 4, minimo: 2, costo: 1500.00, es_herramienta: true },
  { nombre: 'FLEXÓMETRO 8 METROS', descripcion: 'Cinta métrica magnética', categoria: 7, stock: 8, minimo: 3, costo: 180.00, es_herramienta: true },
  { nombre: 'JUEGO LLAVES MIXTAS', descripcion: 'Juego 12 piezas 1/4" a 1"', categoria: 7, stock: 5, minimo: 2, costo: 850.00, es_herramienta: true },
  { nombre: 'ESCALERA TIJERA ALUMINIO', descripcion: 'Escalera 6 pasos aluminio', categoria: 7, stock: 6, minimo: 2, costo: 1650.00, es_herramienta: true },
  { nombre: 'CARRETILLA CONSTRUCCIÓN', descripcion: 'Carretilla metálica llanta neumática', categoria: 7, stock: 4, minimo: 2, costo: 980.00, es_herramienta: true },
  { nombre: 'MULTÍMETRO DIGITAL', descripcion: 'Multímetro digital 600V', categoria: 6, stock: 6, minimo: 2, costo: 450.00, es_herramienta: true }
];

const ejecutarSeeding = async () => {
  let client;

  try {
    console.log('🔄 Conectando a la base de datos local...\n');

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'inventario3g',
      user: process.env.DB_USER || 'andrewww',
      password: process.env.DB_PASSWORD || ''
    };

    client = new Client(config);
    await client.connect();
    console.log('✅ Conectado exitosamente\n');

    console.log('📦 Agregando 20 consumibles...\n');

    for (const [index, item] of consumibles.entries()) {
      try {
        const result = await client.query(`
          INSERT INTO articulos (
            codigo_ean13,
            codigo_tipo,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            stock_maximo,
            unidad,
            costo_unitario,
            es_herramienta,
            activo,
            created_at,
            updated_at
          ) VALUES (
            $1, 'EAN13', $2, $3, $4, 1, $5, $6, $7, 'piezas', $8, false, true, NOW(), NOW()
          ) RETURNING id, codigo_ean13
        `, [
          `200000000${String(1000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
          item.nombre,
          item.descripcion,
          item.categoria,
          item.stock,
          item.minimo,
          item.stock * 2,
          item.costo
        ]);

        console.log(`  ✅ ${index + 1}. ${item.nombre} (ID: ${result.rows[0].id})`);
      } catch (error) {
        console.log(`  ❌ Error: ${item.nombre} - ${error.message}`);
      }
    }

    console.log('\n🔧 Agregando 10 herramientas...\n');

    for (const [index, item] of herramientas.entries()) {
      try {
        const result = await client.query(`
          INSERT INTO articulos (
            codigo_ean13,
            codigo_tipo,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            stock_maximo,
            unidad,
            costo_unitario,
            es_herramienta,
            activo,
            created_at,
            updated_at
          ) VALUES (
            $1, 'EAN13', $2, $3, $4, 2, $5, $6, $7, 'piezas', $8, true, true, NOW(), NOW()
          ) RETURNING id, codigo_ean13
        `, [
          `300000000${String(2000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
          item.nombre,
          item.descripcion,
          item.categoria,
          item.stock,
          item.minimo,
          item.stock * 1.5,
          item.costo
        ]);

        console.log(`  ✅ ${index + 1}. ${item.nombre} (ID: ${result.rows[0].id})`);
      } catch (error) {
        console.log(`  ❌ Error: ${item.nombre} - ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ Seeding completado exitosamente');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 Resumen:`);
    console.log(`   • 20 Consumibles agregados`);
    console.log(`   • 10 Herramientas agregadas`);
    console.log(`   • Total: 30 artículos\n`);

  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    console.error('\nDetalles:', error.message);
    throw error;
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Conexión cerrada');
    }
  }
};

// Ejecutar seeding
ejecutarSeeding()
  .then(() => {
    console.log('🎉 Proceso completado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 El seeding falló:', error.message);
    process.exit(1);
  });
