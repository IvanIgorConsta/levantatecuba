/**
 * Convierte una URL en un File object para usar con FormData
 * @param {string} url - URL de la imagen a convertir
 * @param {string} filename - Nombre del archivo (incluye extensión)
 * @returns {Promise<File>} File object listo para subir
 */
export async function fileFromUrl(url, filename) {
  try {
    // Hacer fetch de la imagen con CORS habilitado
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener imagen: ${response.status} ${response.statusText}`);
    }
    
    // Convertir a blob
    const blob = await response.blob();
    
    // Verificar que es una imagen
    if (!blob.type.startsWith('image/')) {
      throw new Error(`El archivo no es una imagen válida. Tipo: ${blob.type}`);
    }
    
    // Crear File object con el tipo MIME correcto
    const file = new File([blob], filename, { 
      type: blob.type || 'image/jpeg',
      lastModified: Date.now()
    });
    
    return file;
  } catch (error) {
    // Mejorar mensajes de error para CORS y red
    if (error.name === 'TypeError' && error.message.includes('cors')) {
      throw new Error('Error de CORS: La imagen debe servirse desde el mismo origen o con headers CORS correctos');
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Error de red: No se pudo conectar al servidor de imágenes');
    }
    
    throw error;
  }
}

/**
 * Genera nombre de archivo único para imágenes de IA
 * @param {string} type - Tipo de imagen ('cover' o 'secondary')
 * @returns {string} Nombre del archivo con timestamp
 */
export function generateAIImageFilename(type = 'cover') {
  const timestamp = Date.now();
  const prefix = type === 'cover' ? 'portada-ai' : 'secundaria-ai';
  return `${prefix}-${timestamp}.jpg`;
}

