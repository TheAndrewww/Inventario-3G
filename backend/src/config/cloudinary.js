import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Usar memoria storage para poder procesar con Nano Banana antes de subir
const storage = multer.memoryStorage();

// Filtro para validar tipo de archivo
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WEBP)'), false);
    }
};

// Configuración de multer con memory storage
export const uploadArticuloImagen = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
    }
});

/**
 * Sube un buffer de imagen a Cloudinary
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {string} folder - Carpeta en Cloudinary
 * @returns {Promise<string>} - URL de la imagen subida
 */
export const uploadBufferToCloudinary = (imageBuffer, folder = 'inventario-3g/articulos') => {
    return new Promise((resolve, reject) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                public_id: `articulo_${uniqueSuffix}`,
                transformation: [{ width: 800, height: 800, crop: 'limit' }],
                format: 'jpg'
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );

        uploadStream.end(imageBuffer);
    });
};

// Función para eliminar imagen de Cloudinary
export const eliminarImagen = async (imagenUrl) => {
    if (!imagenUrl) return;

    try {
        // Extraer el public_id de la URL de Cloudinary
        // URL format: https://res.cloudinary.com/CLOUD_NAME/image/upload/v123456/folder/public_id.ext
        const urlParts = imagenUrl.split('/');
        const fileWithExt = urlParts[urlParts.length - 1];
        const fileName = fileWithExt.split('.')[0];

        // El public_id incluye la carpeta
        const publicId = `inventario-3g/articulos/${fileName}`;

        // Eliminar de Cloudinary
        const result = await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Imagen eliminada de Cloudinary: ${publicId}`, result);

        return result;
    } catch (error) {
        console.error('Error al eliminar imagen de Cloudinary:', error);
        throw error;
    }
};

export { cloudinary };
