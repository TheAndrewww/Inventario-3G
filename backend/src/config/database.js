import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Cargar .env solo si existe (desarrollo local)
dotenv.config();

// Configuración de Sequelize
export let sequelize;

// Si existe DATABASE_URL, usarla directamente (Railway, Heroku, etc.)
if (process.env.DATABASE_URL) {
    console.log('🔗 Usando DATABASE_URL para conexión');
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,
            underscoredAll: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        }
    });
} else {
    // Usar variables individuales
    const DB_HOST = process.env.DB_HOST || process.env.PGHOST || 'localhost';
    const DB_PORT = process.env.DB_PORT || process.env.PGPORT || 5432;
    const DB_NAME = process.env.DB_NAME || process.env.PGDATABASE || 'inventario3g';
    const DB_USER = process.env.DB_USER || process.env.PGUSER || 'postgres';
    const DB_PASSWORD = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';

    console.log('🔧 Usando variables individuales para conexión:', {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD ? '***' : 'NO PASSWORD'
    });

    sequelize = new Sequelize(
        DB_NAME,
        DB_USER,
        DB_PASSWORD,
        {
            host: DB_HOST,
            port: parseInt(DB_PORT),
            dialect: 'postgres',
            dialectOptions: {
                charset: 'utf8mb4',
            },
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            define: {
                timestamps: true,
                underscored: true,
                underscoredAll: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at',
                charset: 'utf8mb4',
                collate: 'utf8mb4_unicode_ci'
            }
        }
    );
}

// Función para probar la conexión
export const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a PostgreSQL establecida correctamente');
        return true;
    } catch (error) {
        console.error('❌ No se pudo conectar a la base de datos:', error);
        return false;
    }
};

export default sequelize;
