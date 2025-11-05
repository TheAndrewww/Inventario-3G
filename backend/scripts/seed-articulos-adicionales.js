/**
 * Script para agregar 30 artículos adicionales (20 consumibles + 10 herramientas)
 *
 * USO: node backend/scripts/seed-articulos-adicionales.js
 */

import pkg from 'pg';
const { Client } = pkg;

const consumibles = [
  { nombre: 'PERNO HEXAGONAL 3/8"', descripcion: 'Perno hexagonal acero grado 5', categoria: 1, stock: 600, minimo: 120, costo: 3.20 },
  { nombre: 'TUERCA AUTOFRENANTE 3/8"', descripcion: 'Tuerca con inserto nylon', categoria: 1, stock: 550, minimo: 110, costo: 2.10 },
  { nombre: 'RONDANA DE PRESIÓN 3/8"', descripcion: 'Rondana grower acero', categoria: 1, stock: 700, minimo: 140, costo: 0.65 },
  { nombre: 'CABLE ELÉCTRICO CALIBRE 14', descripcion: 'Cable THW calibre 14 AWG', categoria: 2, stock: 850, minimo: 170, costo: 6.80 },
  { nombre: 'CINTA AISLANTE AZUL', descripcion: 'Cinta aislante azul 3M', categoria: 2, stock: 130, minimo: 25, costo: 15.00 },
  { nombre: 'APAGADOR DOBLE', descripcion: 'Apagador eléctrico doble 15A', categoria: 2, stock: 70, minimo: 15, costo: 38.00 },
  { nombre: 'CONTACTO TRIPLE POLARIZADO', descripcion: 'Contacto eléctrico triple 15A', categoria: 2, stock: 65, minimo: 15, costo: 52.00 },
  { nombre: 'TUBO CONDUIT 3/4"', descripcion: 'Tubo conduit pared delgada 3/4"', categoria: 2, stock: 180, minimo: 35, costo: 58.00 },
  { nombre: 'CONECTOR CONDUIT 3/4"', descripcion: 'Conector recto para conduit', categoria: 2, stock: 140, minimo: 30, costo: 12.50 },
  { nombre: 'PINTURA VINÍLICA BEIGE', descripcion: 'Pintura vinílica cubeta 19L beige', categoria: 3, stock: 22, minimo: 5, costo: 395.00 },
  { nombre: 'BROCHA 4 PULGADAS', descripcion: 'Brocha profesional mango madera', categoria: 3, stock: 30, minimo: 8, costo: 58.00 },
  { nombre: 'RODILLO 12 PULGADAS', descripcion: 'Rodillo texturado con mango', categoria: 3, stock: 35, minimo: 10, costo: 78.00 },
  { nombre: 'THINNER ACRÍLICO', descripcion: 'Thinner acrílico 1L', categoria: 3, stock: 55, minimo: 12, costo: 42.00 },
  { nombre: 'LIJA MADERA GRANO 80', descripcion: 'Lija para madera grano grueso', categoria: 3, stock: 180, minimo: 45, costo: 6.50 },
  { nombre: 'CEMENTO BLANCO 50KG', descripcion: 'Cemento blanco Portland', categoria: 4, stock: 65, minimo: 15, costo: 220.00 },
  { nombre: 'ARENA GRUESA BULTO', descripcion: 'Arena gruesa para mezcla', categoria: 4, stock: 55, minimo: 12, costo: 38.00 },
  { nombre: 'GRAVA 1/2" BULTO', descripcion: 'Grava triturada para concreto fino', categoria: 4, stock: 48, minimo: 12, costo: 48.00 },
  { nombre: 'VARILLA CORRUGADA 1/2"', descripcion: 'Varilla corrugada 6 metros calibre 1/2"', categoria: 4, stock: 120, minimo: 25, costo: 135.00 },
  { nombre: 'ALAMBRE GALVANIZADO ROLLO', descripcion: 'Alambre galvanizado calibre 16', categoria: 4, stock: 20, minimo: 6, costo: 320.00 },
  { nombre: 'SELLADOR SILICÓN TRANSPARENTE', descripcion: 'Sellador silicón uso general', categoria: 5, stock: 45, minimo: 10, costo: 48.00 }
];

const herramientas = [
  { nombre: 'TALADRO INALÁMBRICO 3/8"', descripcion: 'Taladro inalámbrico 18V con batería', categoria: 6, stock: 4, minimo: 1, costo: 2200.00, es_herramienta: true },
  { nombre: 'PULIDORA ANGULAR 7"', descripcion: 'Pulidora angular 2000W uso pesado', categoria: 6, stock: 3, minimo: 1, costo: 1650.00, es_herramienta: true },
  { nombre: 'SIERRA CALADORA', descripcion: 'Sierra caladora 600W con guía láser', categoria: 6, stock: 5, minimo: 2, costo: 980.00, es_herramienta: true },
  { nombre: 'LIJADORA ORBITAL', descripcion: 'Lijadora orbital 300W', categoria: 6, stock: 4, minimo: 2, costo: 750.00, es_herramienta: true },
  { nombre: 'NIVEL TORPEDO MAGNÉTICO', descripcion: 'Nivel torpedo aluminio con imán', categoria: 7, stock: 10, minimo: 3, costo: 280.00, es_herramienta: true },
  { nombre: 'FLEXÓMETRO 5 METROS', descripcion: 'Cinta métrica resistente', categoria: 7, stock: 12, minimo: 4, costo: 95.00, es_herramienta: true },
  { nombre: 'JUEGO DESARMADORES PRECISIÓN', descripcion: 'Set 32 piezas desarmadores precisión', categoria: 7, stock: 8, minimo: 3, costo: 320.00, es_herramienta: true },
  { nombre: 'ESCALERA EXTENSIBLE ALUMINIO', descripcion: 'Escalera extensible 4 metros aluminio', categoria: 7, stock: 3, minimo: 1, costo: 2400.00, es_herramienta: true },
  { nombre: 'CARRETILLA PLATAFORMA', descripcion: 'Carretilla plataforma plegable 150kg', categoria: 7, stock: 5, minimo: 2, costo: 650.00, es_herramienta: true },
  { nombre: 'PINZA AMPERIMÉTRICA DIGITAL', descripcion: 'Pinza amperimétrica 600A AC/DC', categoria: 6, stock: 4, minimo: 2, costo: 850.00, es_herramienta: true }
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

    console.log('📦 Agregando 20 consumibles adicionales...\n');

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
          `200000000${String(3000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
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

    console.log('\n🔧 Agregando 10 herramientas adicionales...\n');

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
          `300000000${String(3000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
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
    console.log(`   • 20 Consumibles adicionales agregados`);
    console.log(`   • 10 Herramientas adicionales agregadas`);
    console.log(`   • Total: 30 artículos nuevos\n`);

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
