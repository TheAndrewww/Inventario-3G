import { sequelize } from '../src/config/database.js';
import { Articulo } from '../src/models/index.js';

const marcarHerramientas = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Buscar artículos que podrían ser herramientas
    const articulos = await Articulo.findAll();

    console.log(`\n📦 Total de artículos: ${articulos.length}\n`);

    // Palabras clave que indican que es una herramienta
    const palabrasHerramientas = [
      'taladro', 'martillo', 'sierra', 'llave', 'destornillador',
      'pinza', 'alicate', 'nivel', 'cinta métrica', 'metro',
      'escalera', 'andamio', 'carretilla', 'compresor', 'soldadora',
      'esmeril', 'amoladora', 'pistola', 'lijadora', 'cortadora',
      'torno', 'fresadora', 'prensa', 'gato', 'grúa'
    ];

    let herramientasMarcadas = 0;

    for (const articulo of articulos) {
      const nombreLower = articulo.nombre.toLowerCase();
      const descripcionLower = (articulo.descripcion || '').toLowerCase();

      const esHerramienta = palabrasHerramientas.some(palabra =>
        nombreLower.includes(palabra) || descripcionLower.includes(palabra)
      );

      if (esHerramienta && !articulo.es_herramienta) {
        await articulo.update({ es_herramienta: true });
        console.log(`✅ Marcado como herramienta: ${articulo.nombre}`);
        herramientasMarcadas++;
      }
    }

    console.log(`\n🔧 Total de herramientas marcadas: ${herramientasMarcadas}`);
    console.log('\n✅ Proceso completado');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

marcarHerramientas();
