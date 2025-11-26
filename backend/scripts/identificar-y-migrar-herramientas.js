/**
 * Script para identificar y migrar artículos de herramientas existentes
 *
 * Proceso:
 * 1. Muestra todos los artículos activos
 * 2. Permite seleccionar cuáles son herramientas de renta
 * 3. Los marca con es_herramienta = true
 * 4. Ejecuta la migración al nuevo sistema
 *
 * Uso: node scripts/identificar-y-migrar-herramientas.js
 */

import { sequelize } from '../src/config/database.js';
import {
    Articulo,
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    Categoria,
    Ubicacion,
    Proveedor
} from '../src/models/index.js';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const pregunta = (texto) => {
    return new Promise((resolve) => {
        rl.question(texto, resolve);
    });
};

/**
 * Genera un prefijo único basado en el nombre
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

/**
 * Obtiene un prefijo único
 */
const obtenerPrefijoUnico = async (prefijoBase, transaction) => {
    let prefijo = prefijoBase;
    let contador = 1;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo },
            transaction
        });

        if (!existe) {
            return prefijo;
        }

        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

/**
 * Migra un artículo al nuevo sistema
 */
const migrarArticulo = async (articulo, transaction) => {
    console.log(`\n  📦 Migrando: ${articulo.nombre}`);

    const prefijoBase = generarPrefijo(articulo.nombre);
    const prefijo = await obtenerPrefijoUnico(prefijoBase, transaction);

    const cantidadUnidades = Math.max(1, Math.floor(articulo.stock_actual || 0));

    // Crear tipo de herramienta
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

    // Crear unidades
    const unidadesCreadas = [];
    for (let i = 1; i <= cantidadUnidades; i++) {
        const codigoUnico = `${prefijo}-${i.toString().padStart(3, '0')}`;

        await UnidadHerramientaRenta.create({
            tipo_herramienta_id: nuevoTipo.id,
            codigo_unico: codigoUnico,
            estado: 'disponible',
            activo: true
        }, { transaction });

        unidadesCreadas.push(codigoUnico);
    }

    console.log(`     ✅ Tipo creado con prefijo: ${prefijo}`);
    console.log(`     ✅ ${cantidadUnidades} unidades: ${unidadesCreadas.slice(0, 3).join(', ')}${cantidadUnidades > 3 ? '...' : ''}`);

    return {
        articulo_nombre: articulo.nombre,
        prefijo: prefijo,
        unidades_creadas: cantidadUnidades
    };
};

/**
 * Función principal
 */
const ejecutar = async () => {
    try {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  IDENTIFICAR Y MIGRAR ARTÍCULOS DE HERRAMIENTAS DE RENTA    ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        // Verificar conexión
        await sequelize.authenticate();
        console.log('✅ Conectado a la base de datos\n');

        // Buscar artículos activos que NO estén ya migrados
        const articulos = await Articulo.findAll({
            where: {
                activo: true,
                es_herramienta: false // Solo artículos que aún no son herramientas
            },
            include: [
                { model: Categoria, as: 'categoria', attributes: ['nombre'] },
                { model: Ubicacion, as: 'ubicacion', attributes: ['codigo'] }
            ],
            order: [['nombre', 'ASC']]
        });

        if (articulos.length === 0) {
            console.log('⚠️  No hay artículos para migrar.');
            console.log('   Todos los artículos ya están marcados como herramientas o no hay artículos activos.\n');
            rl.close();
            return;
        }

        console.log(`📦 Artículos activos encontrados: ${articulos.length}\n`);
        console.log('══════════════════════════════════════════════════════════════\n');

        // Mostrar artículos
        articulos.forEach((art, index) => {
            console.log(`${index + 1}. ${art.nombre}`);
            console.log(`   Categoría: ${art.categoria?.nombre || 'Sin categoría'}`);
            console.log(`   Stock: ${art.stock_actual || 0} ${art.unidad || ''}`);
            console.log('');
        });

        console.log('══════════════════════════════════════════════════════════════\n');

        // Preguntar IDs a migrar
        const respuesta = await pregunta(
            'Ingresa los NÚMEROS de los artículos que son herramientas de renta\n' +
            '(separados por comas, ej: 1,3,5) o "todos" para todos:\n> '
        );

        let articulosAMigrar = [];

        if (respuesta.trim().toLowerCase() === 'todos') {
            articulosAMigrar = articulos;
        } else {
            const indices = respuesta.split(',').map(n => parseInt(n.trim()) - 1);
            articulosAMigrar = indices
                .filter(i => i >= 0 && i < articulos.length)
                .map(i => articulos[i]);
        }

        if (articulosAMigrar.length === 0) {
            console.log('\n⚠️  No se seleccionaron artículos válidos.\n');
            rl.close();
            return;
        }

        console.log(`\n✅ Se migrarán ${articulosAMigrar.length} artículos:\n`);
        articulosAMigrar.forEach((art, index) => {
            console.log(`${index + 1}. ${art.nombre} (Stock: ${art.stock_actual || 0})`);
        });

        const confirmar = await pregunta('\n¿Confirmas la migración? (si/no): ');

        if (confirmar.toLowerCase() !== 'si') {
            console.log('\n❌ Migración cancelada\n');
            rl.close();
            return;
        }

        console.log('\n🔄 Iniciando migración...\n');

        const transaction = await sequelize.transaction();

        try {
            const resultados = [];

            // 1. Marcar artículos como herramientas
            for (const articulo of articulosAMigrar) {
                await articulo.update({
                    es_herramienta: true
                }, { transaction });
            }

            console.log(`✅ ${articulosAMigrar.length} artículos marcados como herramientas\n`);

            // 2. Migrar cada artículo
            for (const articulo of articulosAMigrar) {
                const resultado = await migrarArticulo(articulo, transaction);
                resultados.push(resultado);
            }

            // 3. Commit
            await transaction.commit();

            // 4. Resumen
            console.log('\n╔══════════════════════════════════════════════════════════════╗');
            console.log('║           MIGRACIÓN COMPLETADA EXITOSAMENTE                  ║');
            console.log('╚══════════════════════════════════════════════════════════════╝\n');

            console.log('📊 RESUMEN:\n');
            console.log(`   Artículos migrados: ${resultados.length}`);

            const totalUnidades = resultados.reduce((sum, r) => sum + r.unidades_creadas, 0);
            console.log(`   Unidades creadas: ${totalUnidades}\n`);

            console.log('📋 TIPOS CREADOS:\n');
            resultados.forEach((r, i) => {
                console.log(`${i + 1}. ${r.articulo_nombre}`);
                console.log(`   Prefijo: ${r.prefijo} | Unidades: ${r.unidades_creadas}\n`);
            });

        } catch (error) {
            await transaction.rollback();
            console.error('\n❌ ERROR EN LA MIGRACIÓN:', error.message);
            console.error('🔄 Se ha revertido la transacción.\n');
            throw error;
        }

    } catch (error) {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    } finally {
        rl.close();
        await sequelize.close();
    }
};

ejecutar();
