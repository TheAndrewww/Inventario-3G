import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './src/config/database.js';
import './src/models/index.js'; // Importar modelos y relaciones
import { iniciarCronJobs } from './src/utils/cronJobs.js';

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
];

// Agregar URL de producción si existe
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
    // Agregar también la versión con https
    allowedOrigins.push(process.env.FRONTEND_URL.replace('http://', 'https://'));
}

console.log('🔒 CORS - Orígenes permitidos:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        console.log('🔍 CORS - Origen recibido:', origin);

        // Permite peticiones si el origen está en la lista
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        // Permite cualquier URL de Vercel (*.vercel.app)
        else if (origin && origin.includes('.vercel.app')) {
            console.log('✅ CORS - Origen de Vercel permitido:', origin);
            callback(null, true);
        }
        else {
            console.log('❌ CORS - Origen rechazado:', origin);
            console.log('❌ CORS - Lista permitida:', allowedOrigins);
            callback(new Error('CORS no permitido para este origen'));
        }
    },
    credentials: true
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
import usuariosRoutes from './src/routes/usuarios.routes.js';
import ordenesCompraRoutes from './src/routes/ordenesCompra.routes.js';
import notificacionesRoutes from './src/routes/notificaciones.routes.js';

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
            usuarios: '/api/usuarios',
            ordenesCompra: '/api/ordenes-compra',
            solicitudesCompra: '/api/solicitudes-compra',
            notificaciones: '/api/notificaciones'
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
app.use('/api/usuarios', usuariosRoutes);
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
        // Verificar conexión a base de datos
        await sequelize.authenticate();
        console.log('✅ Conexión a base de datos establecida correctamente');

        // Sincronizar modelos
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            console.log('✅ Modelos sincronizados con la base de datos');
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

            // Verificar/crear usuario administrador (siempre)
            const bcrypt = await import('bcryptjs');
            const { Usuario } = await import('./src/models/index.js');

            // FORZAR recreación del admin (eliminar si existe)
            const adminExiste = await Usuario.findOne({ where: { email: 'admin@3g.com' } });

            if (adminExiste) {
                console.log('🔄 Eliminando usuario admin existente para recrearlo...');
                await adminExiste.destroy();
            }

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
        }

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);

            // Iniciar cron jobs
            iniciarCronJobs();
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();

export default app;
