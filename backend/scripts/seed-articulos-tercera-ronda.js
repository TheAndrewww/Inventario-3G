/**
 * Script para agregar 30 artículos más (20 consumibles + 10 herramientas) - Tercera ronda
 *
 * USO: node backend/scripts/seed-articulos-tercera-ronda.js
 */

import pkg from 'pg';
const { Client } = pkg;

const consumibles = [
  { nombre: 'TORNILLO CABEZA PLANA 1/4"', descripcion: 'Tornillo cabeza plana acero zincado', categoria: 1, stock: 650, minimo: 130, costo: 2.80 },
  { nombre: 'TUERCA MARIPOSA 1/4"', descripcion: 'Tuerca mariposa acero', categoria: 1, stock: 400, minimo: 80, costo: 3.50 },
  { nombre: 'ARANDELA ESTRELLA 5/16"', descripcion: 'Arandela estrella de seguridad', categoria: 1, stock: 750, minimo: 150, costo: 0.75 },
  { nombre: 'CABLE ELÉCTRICO CALIBRE 10', descripcion: 'Cable THW calibre 10 AWG uso pesado', categoria: 2, stock: 900, minimo: 180, costo: 12.50 },
  { nombre: 'CINTA AISLANTE ROJA', descripcion: 'Cinta aislante roja alta temperatura', categoria: 2, stock: 140, minimo: 28, costo: 14.50 },
  { nombre: 'DIMMER ATENUADOR', descripcion: 'Dimmer electrónico 600W', categoria: 2, stock: 45, minimo: 10, costo: 125.00 },
  { nombre: 'CONTACTO USB DOBLE', descripcion: 'Contacto con 2 puertos USB integrados', categoria: 2, stock: 35, minimo: 8, costo: 180.00 },
  { nombre: 'TUBO FLEXIBLE CORRUGADO 1/2"', descripcion: 'Tubo corrugado plástico flexible', categoria: 2, stock: 250, minimo: 50, costo: 18.00 },
  { nombre: 'ABRAZADERA METÁLICA 1/2"', descripcion: 'Abrazadera metálica para tubo', categoria: 2, stock: 300, minimo: 60, costo: 4.50 },
  { nombre: 'PINTURA ESMALTE NEGRO', descripcion: 'Esmalte brillante uso exterior 1L', categoria: 3, stock: 28, minimo: 6, costo: 185.00 },
  { nombre: 'BROCHA ANGULAR 2 PULGADAS', descripcion: 'Brocha angular para esquinas', categoria: 3, stock: 42, minimo: 10, costo: 38.00 },
  { nombre: 'RODILLO ESPUMA 6 PULGADAS', descripcion: 'Rodillo mini espuma alta densidad', categoria: 3, stock: 50, minimo: 12, costo: 35.00 },
  { nombre: 'REMOVEDOR PINTURA', descripcion: 'Removedor químico pintura 1L', categoria: 3, stock: 38, minimo: 10, costo: 95.00 },
  { nombre: 'LIJA HIERRO GRANO 220', descripcion: 'Lija uso metal grano fino', categoria: 3, stock: 220, minimo: 55, costo: 9.50 },
  { nombre: 'MORTERO PREMEZCLADO 40KG', descripcion: 'Mortero premezclado para pegar block', categoria: 4, stock: 75, minimo: 18, costo: 95.00 },
  { nombre: 'ARENA SÍLICA BULTO', descripcion: 'Arena sílica lavada para filtros', categoria: 4, stock: 40, minimo: 10, costo: 85.00 },
  { nombre: 'GRAVA DECORATIVA BLANCA', descripcion: 'Grava mármol blanco decorativo', categoria: 4, stock: 32, minimo: 8, costo: 120.00 },
  { nombre: 'MALLA ELECTROSOLDADA 6X6', descripcion: 'Malla electrosoldada refuerzo', categoria: 4, stock: 45, minimo: 10, costo: 280.00 },
  { nombre: 'ALAMBRE DE AMARRE NEGRO', descripcion: 'Alambre amarre construcción kg', categoria: 4, stock: 85, minimo: 20, costo: 28.00 },
  { nombre: 'IMPERMEABILIZANTE ACRÍLICO', descripcion: 'Impermeabilizante acrílico 19L', categoria: 5, stock: 15, minimo: 4, costo: 650.00 }
];

const herramientas = [
  { nombre: 'TALADRO PERCUTOR 3/4"', descripcion: 'Taladro percutor industrial 1200W', categoria: 6, stock: 3, minimo: 1, costo: 3200.00, es_herramienta: true },
  { nombre: 'ESMERIL DE BANCO 8"', descripcion: 'Esmeril de banco doble rueda 750W', categoria: 6, stock: 2, minimo: 1, costo: 1850.00, es_herramienta: true },
  { nombre: 'SIERRA SABLE', descripcion: 'Sierra sable 1100W velocidad variable', categoria: 6, stock: 4, minimo: 2, costo: 1450.00, es_herramienta: true },
  { nombre: 'PISTOLA CALOR 2000W', descripcion: 'Pistola calor industrial regulable', categoria: 6, stock: 5, minimo: 2, costo: 680.00, es_herramienta: true },
  { nombre: 'NIVEL DIGITAL LÁSER 40M', descripcion: 'Nivel digital con alcance 40m', categoria: 7, stock: 3, minimo: 1, costo: 2800.00, es_herramienta: true },
  { nombre: 'CINTA MÉTRICA LÁSER 50M', descripcion: 'Medidor láser distancia 50m', categoria: 7, stock: 6, minimo: 2, costo: 950.00, es_herramienta: true },
  { nombre: 'JUEGO DADOS 1/2" 45 PIEZAS', descripcion: 'Juego completo dados métricas', categoria: 7, stock: 4, minimo: 2, costo: 1250.00, es_herramienta: true },
  { nombre: 'ANDAMIO TUBULAR 2M', descripcion: 'Andamio tubular acero 2 cuerpos', categoria: 7, stock: 2, minimo: 1, costo: 4500.00, es_herramienta: true },
  { nombre: 'COMPRESOR AIRE 50L', descripcion: 'Compresor aire 2HP tanque 50L', categoria: 7, stock: 2, minimo: 1, costo: 5800.00, es_herramienta: true },
  { nombre: 'PISTOLA IMPACTO NEUMÁTICA', descripcion: 'Pistola impacto 1/2" 650Nm', categoria: 6, stock: 5, minimo: 2, costo: 1150.00, es_herramienta: true }
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

    console.log('📦 Agregando 20 consumibles (tercera ronda)...\n');

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
          `200000000${String(4000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
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

    console.log('\n🔧 Agregando 10 herramientas (tercera ronda)...\n');

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
          `300000000${String(4000 + index).padStart(4, '0')}${Math.floor(Math.random() * 10)}`,
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
    console.log(`   • Total: 30 artículos nuevos (tercera ronda)\n`);

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
