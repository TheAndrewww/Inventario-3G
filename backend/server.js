import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './src/config/database.js';
import './src/models/index.js'; // Importar modelos y relaciones
import { iniciarCronJobs } from './src/utils/cronJobs.js';

// Cargar variables de entorno
dotenv.config();

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
}

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones si el origen está en la lista,
        // o si no hay origen (ej. Postman)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
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

        // Sincronizar modelos (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            console.log('✅ Modelos sincronizados con la base de datos');
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
