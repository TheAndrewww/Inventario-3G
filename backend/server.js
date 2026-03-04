import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './src/config/database.js';
import './src/models/index.js'; // Importar modelos y relaciones
import { iniciarCronJobs } from './src/utils/cronJobs.js';
import { ejecutarAutoMigracion } from './src/utils/autoMigrate.js';

// Cargar variables de entorno solo en desarrollo
// En producción (Railway, Heroku), las variables están en process.env directamente
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares

// Lista de orígenes permitidos
const allowedOrigins = [
    'http://localhost:5173', // Desarrollo local
    'http://localhost:5174',
    'http://localhost:5175',
    'http://192.168.100.26:5173', // Acceso desde red local (móviles)
    'https://inventario-3-g.vercel.app', // Producción Vercel (explícito)
];

// Agregar URL de producción si existe en env
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
    // Agregar también la versión con https
    if (process.env.FRONTEND_URL.startsWith('http://')) {
        allowedOrigins.push(process.env.FRONTEND_URL.replace('http://', 'https://'));
    }
}

console.log('🔒 CORS - Orígenes permitidos:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones sin origen (ej: Postman, curl)
        if (!origin) {
            return callback(null, true);
        }

        // Permite si está en la lista explícita
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Permite cualquier URL de Vercel (*.vercel.app)
        if (origin.endsWith('.vercel.app')) {
            console.log('✅ CORS - Origen de Vercel permitido:', origin);
            return callback(null, true);
        }

        // Permite cualquier URL de Railway (*.railway.app) - para testing
        if (origin.endsWith('.railway.app')) {
            console.log('✅ CORS - Origen de Railway permitido:', origin);
            return callback(null, true);
        }

        console.log('❌ CORS - Origen rechazado:', origin);
        console.log('❌ CORS - Lista permitida:', allowedOrigins);
        callback(new Error('CORS no permitido para este origen'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos ANTES de otros middlewares (QR, imágenes)
app.use('/uploads', express.static('uploads'));

// Middleware para asegurar UTF-8 en todas las respuestas JSON y desactivar cache
// Solo aplica a rutas que NO sean archivos estáticos
app.use((req, res, next) => {
    // No aplicar estos headers a archivos estáticos
    if (!req.path.startsWith('/uploads')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Importar rutas
import authRoutes from './src/routes/auth.routes.js';
import articulosRoutes from './src/routes/articulos.routes.js';
import movimientosRoutes from './src/routes/movimientos.routes.js';
import categoriasRoutes from './src/routes/categorias.routes.js';
import ubicacionesRoutes from './src/routes/ubicaciones.routes.js';
import pedidosRoutes from './src/routes/pedidos.routes.js';
import proveedoresRoutes from './src/routes/proveedores.routes.js';
import equiposRoutes from './src/routes/equipos.routes.js';
import camionetasRoutes from './src/routes/camionetas.routes.js';
import usuariosRoutes from './src/routes/usuarios.routes.js';
import ordenesCompraRoutes from './src/routes/ordenesCompra.routes.js';
import notificacionesRoutes from './src/routes/notificaciones.routes.js';
import proyectosRoutes from './src/routes/proyectos.routes.js';
import calendarioRoutes from './src/routes/calendario.routes.js';
import herramientasRentaRoutes from './src/routes/herramientasRenta.routes.js';
import anunciosRoutes from './src/routes/anuncios.routes.js';
import miEquipoRoutes from './src/routes/miEquipo.routes.js';
import produccionRoutes from './src/routes/produccion.routes.js';
import campanaControlRoutes from './src/routes/campanaControlRoutes.js';
import conteosCiclicosRoutes from './src/routes/conteosCiclicos.routes.js';
import descontarAlmacenRoutes from './src/routes/descontarAlmacen.routes.js';
import rollosMembrana from './src/routes/rollosMembrana.routes.js';

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'API Inventario 3G',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            articulos: '/api/articulos',
            movimientos: '/api/movimientos',
            categorias: '/api/categorias',
            ubicaciones: '/api/ubicaciones',
            pedidos: '/api/pedidos',
            proveedores: '/api/proveedores',
            equipos: '/api/equipos',
            camionetas: '/api/camionetas',
            usuarios: '/api/usuarios',
            ordenesCompra: '/api/ordenes-compra',
            solicitudesCompra: '/api/solicitudes-compra',
            notificaciones: '/api/notificaciones',
            proyectos: '/api/proyectos',
            calendario: '/api/calendario',
            herramientasRenta: '/api/herramientas-renta',
            anuncios: '/api/anuncios',
            miEquipo: '/api/mi-equipo',
            miEquipo: '/api/mi-equipo',
            produccion: '/api/produccion',
            campanaControl: '/api/campana-control',
            conteosCiclicos: '/api/conteos-ciclicos',
            descontarAlmacen: '/api/descontar-almacen',
            rollosMembrana: '/api/rollos-membrana'
        }
    });
});

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/articulos', articulosRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/ubicaciones', ubicacionesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/camionetas', camionetasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/herramientas-renta', herramientasRentaRoutes);
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/mi-equipo', miEquipoRoutes);
app.use('/api/produccion', produccionRoutes);
app.use('/api/campana-control', campanaControlRoutes);
app.use('/api/conteos-ciclicos', conteosCiclicosRoutes);
app.use('/api/descontar-almacen', descontarAlmacenRoutes);
app.use('/api/rollos-membrana', rollosMembrana);
app.use('/api', ordenesCompraRoutes);
app.use('/api', notificacionesRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Función para iniciar el servidor
const startServer = async () => {
    try {
        // Verificar conexión a base de datos con reintentos
        let retries = 5;
        while (retries > 0) {
            try {
                await sequelize.authenticate();
                console.log('✅ Conexión a base de datos establecida correctamente');
                break;
            } catch (error) {
                retries -= 1;
                console.error(`❌ Error de conexión (intentos restantes: ${retries}):`, error.message);
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5s
            }
        }

        // Sincronizar modelos
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            console.log('✅ Modelos sincronizados con la base de datos');

            // Verificar columna tipo_proyecto en desarrollo también
            try {
                const [tipoProyectoCheck] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'produccion_proyectos' AND column_name = 'tipo_proyecto'"
                );

                if (parseInt(tipoProyectoCheck[0]?.count || 0) === 0) {
                    console.log('🔄 Agregando columna tipo_proyecto...');
                    await sequelize.query("ALTER TABLE produccion_proyectos ADD COLUMN IF NOT EXISTS tipo_proyecto VARCHAR(20)");
                    console.log('✅ Columna tipo_proyecto agregada');
                }
            } catch (e) {
                console.log('⚠️ No se pudo verificar/agregar tipo_proyecto:', e.message);
            }

            // Verificar columna es_extensivo en desarrollo también
            try {
                const [esExtensivoCheck] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'produccion_proyectos' AND column_name = 'es_extensivo'"
                );

                if (parseInt(esExtensivoCheck[0]?.count || 0) === 0) {
                    console.log('🔄 Agregando columna es_extensivo...');
                    await sequelize.query("ALTER TABLE produccion_proyectos ADD COLUMN IF NOT EXISTS es_extensivo BOOLEAN DEFAULT FALSE NOT NULL");
                    console.log('✅ Columna es_extensivo agregada');
                }
            } catch (e) {
                console.log('⚠️ No se pudo verificar/agregar es_extensivo:', e.message);
            }
        } else {
            // En producción, ejecutar setup automático si no hay tablas
            const [results] = await sequelize.query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios'"
            );

            const tablaExiste = parseInt(results[0].count) > 0;

            if (!tablaExiste) {
                console.log('🔄 Primera ejecución detectada. Ejecutando setup automático...');
                await sequelize.sync({ force: false, alter: true });
                console.log('✅ Tablas creadas');
            } else {
                console.log('✅ Base de datos ya inicializada');
            }

            // Migración: conteos_ciclicos schema v2 (agregar fecha, total_asignados)
            try {
                const [fechaCol] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'conteos_ciclicos' AND column_name = 'fecha'"
                );
                const tieneFecha = parseInt(fechaCol[0]?.count || 0) > 0;

                const [tablaExisteCC] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conteos_ciclicos'"
                );
                const existeTabla = parseInt(tablaExisteCC[0]?.count || 0) > 0;

                if (existeTabla && !tieneFecha) {
                    console.log('🔄 Migrando conteos_ciclicos a schema v2...');
                    await sequelize.query('DROP TABLE IF EXISTS conteo_articulos CASCADE');
                    await sequelize.query('DROP TABLE IF EXISTS conteos_ciclicos CASCADE');
                    await sequelize.sync({ force: false });
                    console.log('✅ Tablas conteos_ciclicos y conteo_articulos recreadas con nuevo schema');
                } else if (!existeTabla) {
                    await sequelize.sync({ force: false });
                    console.log('✅ Tablas nuevas creadas (conteos_ciclicos, conteo_articulos)');
                }
            } catch (e) {
                console.log('⚠️ Migración conteos_ciclicos:', e.message);
            }

            // Verificar/crear usuario administrador (solo si no existe)
            const { Usuario } = await import('./src/models/index.js');

            const adminExiste = await Usuario.findOne({ where: { email: 'admin@3g.com' } });

            if (!adminExiste) {
                console.log('🔄 Creando usuario administrador...');
                // NO hashear aquí, el hook beforeSave del modelo lo hará
                await Usuario.create({
                    nombre: 'Administrador',
                    email: 'admin@3g.com',
                    password: 'admin123', // Password en texto plano, el modelo lo hasheará
                    rol: 'administrador',
                    activo: true,
                    telefono: '0000000000',
                    puesto: 'Administrador del Sistema'
                });

                console.log('✅ Usuario administrador creado');
                console.log('📧 Email: admin@3g.com');
                console.log('🔑 Password: admin123');
                console.log('⚠️  IMPORTANTE: Cambiar la contraseña después del primer login');
            } else {
                console.log('✅ Usuario administrador ya existe');
            }

            // Verificar/crear tabla de cola de procesamiento de imágenes
            console.log('🔍 Verificando tabla image_processing_queue...');
            const [queueTableCheck] = await sequelize.query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'image_processing_queue'"
            );

            const queueTableExists = parseInt(queueTableCheck[0].count) > 0;

            if (!queueTableExists) {
                console.log('🔄 Creando tabla image_processing_queue...');

                // Leer y ejecutar el archivo de migración
                const fs = await import('fs');
                const path = await import('path');
                const { fileURLToPath } = await import('url');

                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                const migrationPath = path.join(__dirname, 'migrations', '20250120_create_image_processing_queue.sql');

                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

                // Ejecutar el SQL de migración
                await sequelize.query(migrationSQL);

                console.log('✅ Tabla image_processing_queue creada exitosamente');
            } else {
                console.log('✅ Tabla image_processing_queue ya existe');
            }

            // Verificar/crear tabla de anuncios
            console.log('🔍 Verificando tabla anuncios...');
            const [anunciosTableCheck] = await sequelize.query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'anuncios'"
            );

            const anunciosTableExists = parseInt(anunciosTableCheck[0].count) > 0;

            if (!anunciosTableExists) {
                console.log('🔄 Creando tabla anuncios...');

                // Leer y ejecutar el archivo de migración de anuncios
                const fs = await import('fs');
                const path = await import('path');
                const { fileURLToPath } = await import('url');

                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                const migrationPath = path.join(__dirname, 'migrations', 'create-tabla-anuncios.sql');

                try {
                    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                    await sequelize.query(migrationSQL);
                    console.log('✅ Tabla anuncios creada exitosamente');
                } catch (migrationError) {
                    console.error('⚠️ Error al crear tabla anuncios (puede que ya exista parcialmente):', migrationError.message);
                }
            } else {
                console.log('✅ Tabla anuncios ya existe');
            }

            // Verificar/crear tabla de produccion_proyectos
            console.log('🔍 Verificando tabla produccion_proyectos...');
            const [produccionTableCheck] = await sequelize.query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produccion_proyectos'"
            );

            const produccionTableExists = parseInt(produccionTableCheck[0].count) > 0;

            if (!produccionTableExists) {
                console.log('🔄 Creando tabla produccion_proyectos...');

                const fs = await import('fs');
                const path = await import('path');
                const { fileURLToPath } = await import('url');

                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                const migrationPath = path.join(__dirname, 'migrations', 'create-tabla-produccion-proyectos.sql');

                try {
                    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                    await sequelize.query(migrationSQL);
                    console.log('✅ Tabla produccion_proyectos creada exitosamente');
                } catch (migrationError) {
                    console.error('⚠️ Error al crear tabla produccion_proyectos:', migrationError.message);
                }
            } else {
                console.log('✅ Tabla produccion_proyectos ya existe');

                // Verificar si existe la columna tipo_proyecto
                const [tipoProyectoCheck] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'produccion_proyectos' AND column_name = 'tipo_proyecto'"
                );

                if (parseInt(tipoProyectoCheck[0].count) === 0) {
                    console.log('🔄 Agregando columna tipo_proyecto...');
                    await sequelize.query("ALTER TABLE produccion_proyectos ADD COLUMN tipo_proyecto VARCHAR(20)");
                    console.log('✅ Columna tipo_proyecto agregada');
                }

                // Verificar si existe la columna es_extensivo
                const [esExtensivoCheck] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'produccion_proyectos' AND column_name = 'es_extensivo'"
                );

                if (parseInt(esExtensivoCheck[0].count) === 0) {
                    console.log('🔄 Agregando columna es_extensivo...');
                    await sequelize.query("ALTER TABLE produccion_proyectos ADD COLUMN es_extensivo BOOLEAN DEFAULT FALSE NOT NULL");
                    console.log('✅ Columna es_extensivo agregada');
                }
            }

            // Auto-migración de herramientas de renta
            await ejecutarAutoMigracion();

            // Migración: agregar tipos faltantes al enum de notificaciones
            try {
                console.log('🔍 Verificando enum de notificaciones...');
                const tiposFaltantes = [
                    'solicitud_cancelada',
                    'solicitud_creada',
                    'orden_creada',
                    'orden_enviada',
                    'orden_recibida',
                    'orden_anulada',
                    'pedido_creado',
                    'orden_completada_manual'
                ];
                for (const tipo of tiposFaltantes) {
                    try {
                        await sequelize.query(`ALTER TYPE "enum_notificaciones_tipo" ADD VALUE IF NOT EXISTS '${tipo}'`);
                    } catch (e) {
                        // Ignorar si ya existe
                    }
                }
                console.log('✅ Enum de notificaciones actualizado');
            } catch (enumError) {
                console.log('⚠️ Error al actualizar enum notificaciones:', enumError.message);
            }

            // Migración: agregar estados pendiente_aprobacion y rechazada al enum de ordenes_compra
            try {
                console.log('🔍 Verificando enum de ordenes_compra...');
                const estadosFaltantes = ['pendiente_aprobacion', 'rechazada'];
                for (const estado of estadosFaltantes) {
                    try {
                        await sequelize.query(`ALTER TYPE "enum_ordenes_compra_estado" ADD VALUE IF NOT EXISTS '${estado}'`);
                    } catch (e) {
                        // Ignorar si ya existe
                    }
                }
                // Agregar columnas nuevas si no existen
                await sequelize.query(`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT`);
                await sequelize.query(`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS aprobado_por_id INTEGER REFERENCES usuarios(id)`);
                await sequelize.query(`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE`);
                console.log('✅ Enum y columnas de ordenes_compra actualizados');
            } catch (ordenError) {
                console.log('⚠️ Error al actualizar ordenes_compra:', ordenError.message);
            }

            // Verificar/crear tabla de rollos_membrana
            console.log('🔍 Verificando tabla rollos_membrana...');
            try {
                const [rollosTableCheck] = await sequelize.query(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rollos_membrana'"
                );
                const rollosTableExists = parseInt(rollosTableCheck[0].count) > 0;

                let needsRecreate = false;

                if (rollosTableExists) {
                    // Verificar si el tipo de la columna estado es correcto
                    const [colCheck] = await sequelize.query(
                        "SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'rollos_membrana' AND column_name = 'estado'"
                    );
                    const colType = colCheck[0]?.udt_name || '';

                    // Verificar si tiene columna created_at (snake_case, requerido por underscored:true)
                    const [tsCheck] = await sequelize.query(
                        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rollos_membrana' AND column_name = 'created_at'"
                    );
                    const hasCreatedAt = parseInt(tsCheck[0].count) > 0;

                    if (colType !== 'enum_rollos_membrana_estado') {
                        console.log(`🔄 Columna estado tiene tipo '${colType}', necesita ENUM. Recreando tabla...`);
                        needsRecreate = true;
                    } else if (!hasCreatedAt) {
                        console.log('🔄 Tabla tiene timestamps camelCase, necesita snake_case. Recreando...');
                        needsRecreate = true;
                    } else {
                        console.log('✅ Tabla rollos_membrana ya existe con schema correcto');
                    }
                } else {
                    needsRecreate = true;
                    console.log('🔄 Tabla rollos_membrana no existe, creando...');
                }

                if (needsRecreate) {
                    // Paso 1: Limpiar tabla y tipo existentes
                    await sequelize.query('DROP TABLE IF EXISTS rollos_membrana CASCADE');
                    await sequelize.query('DROP TYPE IF EXISTS "enum_rollos_membrana_estado" CASCADE');

                    // Paso 2: Crear tipo ENUM
                    await sequelize.query("CREATE TYPE \"enum_rollos_membrana_estado\" AS ENUM ('disponible', 'en_uso', 'agotado')");

                    // Paso 3: Crear tabla
                    await sequelize.query(`
                        CREATE TABLE rollos_membrana (
                            id SERIAL PRIMARY KEY,
                            articulo_id INTEGER NOT NULL REFERENCES articulos(id),
                            identificador VARCHAR(100) NOT NULL UNIQUE,
                            metraje_total DECIMAL(10, 2) NOT NULL,
                            metraje_restante DECIMAL(10, 2) NOT NULL,
                            color VARCHAR(100),
                            estado "enum_rollos_membrana_estado" NOT NULL DEFAULT 'disponible',
                            fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
                            observaciones TEXT,
                            activo BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                        )
                    `);

                    // Paso 4: Crear índices
                    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_rollos_membrana_articulo_id ON rollos_membrana(articulo_id)');
                    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_rollos_membrana_estado ON rollos_membrana(estado)');
                    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_rollos_membrana_activo ON rollos_membrana(activo)');

                    console.log('✅ Tabla rollos_membrana creada exitosamente');
                }

                // Migración de datos: crear rollos iniciales para artículos existentes
                const [rollosCount] = await sequelize.query("SELECT COUNT(*) FROM rollos_membrana");
                const totalRollos = parseInt(rollosCount[0].count);

                if (totalRollos === 0) {
                    console.log('🔄 Migrando stock existente de membranas a rollos...');

                    // Obtener artículos del almacén Membranas con stock > 0
                    const [articulosMembrana] = await sequelize.query(`
                        SELECT a.id, a.nombre, a.stock_actual
                        FROM articulos a
                        JOIN ubicaciones u ON a.ubicacion_id = u.id
                        WHERE u.almacen = 'Membranas'
                          AND a.activo = true
                          AND a.stock_actual > 0
                        ORDER BY a.id
                    `);

                    if (articulosMembrana.length > 0) {
                        let contador = 1;
                        for (const art of articulosMembrana) {
                            const identificador = `R-${String(contador).padStart(3, '0')}`;
                            const metraje = parseFloat(art.stock_actual);
                            try {
                                await sequelize.query(`
                                    INSERT INTO rollos_membrana (articulo_id, identificador, metraje_total, metraje_restante, estado, fecha_ingreso, activo, created_at, updated_at)
                                    VALUES ($1, $2, $3, $3, 'disponible', CURRENT_DATE, true, NOW(), NOW())
                                `, {
                                    bind: [art.id, identificador, metraje]
                                });
                                console.log(`  ✅ Rollo "${identificador}" → ${art.nombre} (${metraje}m)`);
                                contador++;
                            } catch (insertErr) {
                                console.error(`  ⚠️ Error creando rollo para ${art.nombre}:`, insertErr.message);
                            }
                        }
                        console.log(`✅ ${contador - 1} rollos iniciales creados desde stock existente`);
                    } else {
                        console.log('ℹ️ No hay artículos de membrana con stock para migrar');
                    }
                }
            } catch (rollosError) {
                console.error('⚠️ Error con tabla rollos_membrana:', rollosError.message);
            }
        }

        // Iniciar servidor
        app.listen(PORT, async () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);

            // Iniciar cron jobs
            iniciarCronJobs();

            // Iniciar worker de procesamiento de imágenes
            const { iniciarWorker } = await import('./src/workers/imageProcessingWorker.js');
            iniciarWorker();
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();

export default app;
