import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

async function buscarTapa() {
  const client = new pg.Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Conectado a Railway DB\n');
    
    const result = await client.query(`
      SELECT 
        a.id, 
        a.nombre, 
        a.proveedor_id,
        p.nombre as proveedor_nombre
      FROM articulos a
      LEFT JOIN proveedores p ON a.proveedor_id = p.id
      WHERE a.nombre ILIKE '%TAPA%'
      ORDER BY a.nombre
      LIMIT 20
    `);
    
    console.log('Encontrados', result.rows.length, 'articulos:\n');
    result.rows.forEach(row => {
      console.log('ID:', row.id);
      console.log('Nombre:', row.nombre);
      console.log('proveedor_id:', row.proveedor_id);
      console.log('Proveedor:', row.proveedor_nombre);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

buscarTapa();
