/**
 * Obtiene la URL completa de una imagen de artículo
 * Soporta tanto URLs de Cloudinary (completas) como URLs locales (relativas)
 * @param {string} imagenUrl - URL de la imagen (puede ser relativa o completa)
 * @returns {string|null} - URL completa de la imagen o null si no existe
 */
export const getImageUrl = (imagenUrl) => {
    if (!imagenUrl) return null;

    // Si la URL ya es completa (Cloudinary), retornarla tal cual
    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
        return imagenUrl;
    }

    // Si es una URL relativa (sistema antiguo), concatenar con base URL
    const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:5001';
    return `${baseUrl}${imagenUrl}`;
};

/**
 * Verifica si una imagen es de Cloudinary
 * @param {string} imagenUrl - URL de la imagen
 * @returns {boolean} - true si es de Cloudinary
 */
export const isCloudinaryImage = (imagenUrl) => {
    if (!imagenUrl) return false;
    return imagenUrl.includes('cloudinary.com');
};
