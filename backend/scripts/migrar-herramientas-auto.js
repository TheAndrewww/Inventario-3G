/**
 * Script automático para migrar herramientas basándose en criterios
 *
 * Identifica automáticamente artículos que son herramientas por:
 * - Categoría específica
 * - Palabras clave en el nombre
 * - IDs específicos
 *
 * Uso:
 * - Por categoría: node scripts/migrar-herramientas-auto.js --categoria "Herramientas"
 * - Por palabras clave: node scripts/migrar-herramientas-auto.js --keywords "pistola,compresor,taladro"
 * - Por IDs: node scripts/migrar-herramientas-auto.js --ids "1,2,3,5,8"
 * - Todo: node scripts/migrar-herramientas-auto.js --todos
 */

import { sequelize } from '../src/config/database.js';
import {
    Articulo,
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    Categoria,
    Ubicacion
} from '../src/models/index.js';
import { Op } from 'sequelize';

// Configuración por defecto
const PALABRAS_CLAVE_HERRAMIENTAS = [
    'pistola',
    'compresor',
    'taladro',
    'sierra',
    'amoladora',
    'lijadora',
    'pulidora',
    'martillo',
    'esmeril',
    'cortadora',
    'soldadora',
    'generador',
    'escalera',
    'andamio'
];

/**
 * Parsear argumentos de línea de comandos
 */
const parseArgs = () => {
    const args = process.argv.slice(2);
    const config = {
        modo: null,
        valor: null
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--categoria' && args[i + 1]) {
            config.modo = 'categoria';
            config.valor = args[i + 1];
            break;
        } else if (args[i] === '--keywords' && args[i + 1]) {
            config.modo = 'keywords';
            config.valor = args[i + 1].split(',').map(k => k.trim().toLowerCase());
            break;
        } else if (args[i] === '--ids' && args[i + 1]) {
            config.modo = 'ids';
            config.valor = args[i + 1].split(',').map(id => parseInt(id.trim()));
            break;
        } else if (args[i] === '--todos') {
            config.modo = 'todos';
            break;
        }
    }

    return config;
};

/**
 * Genera prefijo único
 */
const generarPrefijo = (nombre) => {
    const palabrasIgnoradas = ['de', 'la', 'el', 'del', 'los', 'las', 'y', 'para', 'con', 'a'];
    const palabras = nombre
        .split(' ')
        .filter(p => !palabrasIgnoradas.includes(p.toLowerCase()))
        .filter(p => p.length > 0);

    if (palabras.length >= 2) {
        return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1) {
        return palabras[0].substring(0, 2).toUpperCase();
    }
    return 'HR';
};

const obtenerPrefijoUnico = async (prefijoBase, transaction) => {
    let prefijo = prefijoBase;
    let contador = 1;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo },
            transaction
        });

        if (!existe) return prefijo;
        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

/**
 * Migrar artículo
 */
const migrarArticulo = async (articulo, transaction) => {
    const prefijoBase = generarPrefijo(articulo.nombre);
    const prefijo = await obtenerPrefijoUnico(prefijoBase, transaction);
    const cantidadUnidades = Math.max(1, Math.floor(articulo.stock_actual || 0));

    const nuevoTipo = await TipoHerramientaRenta.create({
        nombre: articulo.nombre,
        descripcion: articulo.descripcion || `Migrado desde artículo #${articulo.id}`,
        prefijo_codigo: prefijo,
        categoria_id: articulo.categoria_id,
        ubicacion_id: articulo.ubicacion_id,
        proveedor_id: articulo.proveedor_id,
        precio_unitario: articulo.costo_unitario || 0,
        total_unidades: cantidadUnidades,
        unidades_disponibles: cantidadUnidades,
        unidades_asignadas: 0,
        imagen_url: articulo.imagen_url,
        activo: articulo.activo,
        articulo_origen_id: articulo.id
    }, { transaction });

    for (let i = 1; i <= cantidadUnidades; i++) {
        const codigoUnico = `${prefijo}-${i.toString().padStart(3, '0')}`;
        await UnidadHerramientaRenta.create({
            tipo_herramienta_id: nuevoTipo.id,
            codigo_unico: codigoUnico,
            estado: 'disponible',
            activo: true
        }, { transaction });
    }

    return { nombre: articulo.nombre, prefijo, unidades: cantidadUnidades };
};

/**
 * Ejecutar
 */
const ejecutar = async () => {
    try {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║      MIGRACIÓN AUTOMÁTICA DE HERRAMIENTAS DE RENTA          ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        const config = parseArgs();

        if (!config.modo) {
            console.log('❌ ERROR: Debes especificar un modo de migración\n');
            console.log('Opciones:');
            console.log('  --categoria "Nombre"      Migrar por categoría');
            console.log('  --keywords "a,b,c"        Migrar por palabras clave');
            console.log('  --ids "1,2,3"             Migrar IDs específicos');
            console.log('  --todos                   Migrar todos los artículos\n');
            console.log('Ejemplo:');
            console.log('  node scripts/migrar-herramientas-auto.js --keywords "pistola,compresor"\n');
            process.exit(1);
        }

        await sequelize.authenticate();
        console.log('✅ Conectado a la base de datos\n');

        let whereClause = {
            activo: true,
            es_herramienta: false
        };

        // Construir filtro según el modo
        if (config.modo === 'categoria') {
            const categoria = await Categoria.findOne({
                where: { nombre: { [Op.iLike]: `%${config.valor}%` } }
            });

            if (!categoria) {
                console.log(`❌ No se encontró la categoría: ${config.valor}\n`);
                process.exit(1);
            }

            whereClause.categoria_id = categoria.id;
            console.log(`📂 Modo: Categoría "${categoria.nombre}"\n`);

        } else if (config.modo === 'keywords') {
            const keywords = config.valor || PALABRAS_CLAVE_HERRAMIENTAS;
            whereClause.nombre = {
                [Op.or]: keywords.map(k => ({
                    [Op.iLike]: `%${k}%`
                }))
            };
            console.log(`🔍 Modo: Palabras clave [${keywords.join(', ')}]\n`);

        } else if (config.modo === 'ids') {
            whereClause.id = { [Op.in]: config.valor };
            console.log(`🎯 Modo: IDs específicos [${config.valor.join(', ')}]\n`);

        } else if (config.modo === 'todos') {
            console.log('🌐 Modo: Todos los artículos activos\n');
        }

        // Buscar artículos
        const articulos = await Articulo.findAll({
            where: whereClause,
            include: [
                { model: Categoria, as: 'categoria', attributes: ['nombre'] },
                { model: Ubicacion, as: 'ubicacion', attributes: ['codigo'] }
            ],
            order: [['nombre', 'ASC']]
        });

        if (articulos.length === 0) {
            console.log('⚠️  No se encontraron artículos para migrar\n');
            process.exit(0);
        }

        console.log(`📦 Artículos encontrados: ${articulos.length}\n`);
        articulos.forEach((art, i) => {
            console.log(`${i + 1}. ${art.nombre} (Stock: ${art.stock_actual || 0})`);
        });

        console.log('\n🔄 Iniciando migración...\n');

        const transaction = await sequelize.transaction();

        try {
            const resultados = [];

            // Marcar como herramientas
            for (const articulo of articulos) {
                await articulo.update({ es_herramienta: true }, { transaction });
            }

            // Migrar
            for (const articulo of articulos) {
                const resultado = await migrarArticulo(articulo, transaction);
                resultados.push(resultado);
                console.log(`  ✅ ${resultado.nombre} → ${resultado.prefijo} (${resultado.unidades} unidades)`);
            }

            await transaction.commit();

            console.log('\n╔══════════════════════════════════════════════════════════════╗');
            console.log('║           MIGRACIÓN COMPLETADA EXITOSAMENTE                  ║');
            console.log('╚══════════════════════════════════════════════════════════════╝\n');

            const totalUnidades = resultados.reduce((sum, r) => sum + r.unidades, 0);
            console.log(`📊 Artículos migrados: ${resultados.length}`);
            console.log(`📊 Unidades creadas: ${totalUnidades}\n`);

        } catch (error) {
            await transaction.rollback();
            console.error('\n❌ ERROR:', error.message);
            throw error;
        }

    } catch (error) {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
};

ejecutar();
