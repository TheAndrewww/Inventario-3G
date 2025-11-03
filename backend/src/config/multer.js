import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de uploads
const uploadsDir = path.join(__dirname, '../../uploads/articulos');

// Crear directorio si no existe
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generar nombre único: articulo_ID_timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `articulo_${uniqueSuffix}${ext}`);
    }
});

// Filtro para validar tipo de archivo
const fileFilter = (req, file, cb) => {
    // Tipos de archivo permitidos
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WEBP)'), false);
    }
};

// Configuración de multer
export const uploadArticuloImagen = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
    }
});

// Función para eliminar imagen
export const eliminarImagen = (imagenUrl) => {
    if (!imagenUrl) return;

    try {
        // Extraer el nombre del archivo de la URL
        const filename = path.basename(imagenUrl);
        const filepath = path.join(uploadsDir, filename);

        // Eliminar archivo si existe
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`✅ Imagen eliminada: ${filename}`);
        }
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
    }
};
