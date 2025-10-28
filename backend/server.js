import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './src/config/database.js';
import './src/models/index.js'; // Importar modelos y relaciones

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (QR, imágenes)
app.use('/uploads', express.static('uploads'));

// Importar rutas
import authRoutes from './src/routes/auth.routes.js';
import articulosRoutes from './src/routes/articulos.routes.js';
import movimientosRoutes from './src/routes/movimientos.routes.js';

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'API Inventario 3G',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            articulos: '/api/articulos',
            movimientos: '/api/movimientos'
        }
    });
});

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/articulos', articulosRoutes);
app.use('/api/movimientos', movimientosRoutes);

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
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();

export default app;
