// server/redactor_ia/services/publishDraftHelper.js
const News = require('../../models/News');
const AiDraft = require('../../models/AiDraft');

/**
 * Función compartida para publicar un borrador de Redactor IA como noticia
 * Usada tanto por el endpoint manual como por el scheduler automático
 * 
 * @param {Object} draft - Documento AiDraft de MongoDB
 * @param {Object} options - Opciones de publicación
 * @param {Date} options.publishDate - Fecha de publicación (default: ahora)
 * @param {string} options.categoryOverride - Categoría personalizada
 * @param {Array} options.tagsOverride - Etiquetas personalizadas
 * @param {string} options.autorNombre - Nombre del autor (default: extrae del draft)
 * @param {string} options.scheduleStatus - 'published' | 'en_cola' (default: 'published')
 * @returns {Promise<Object>} - { news, draft } - Noticia creada y borrador actualizado
 */
async function publishDraftToNews(draft, options = {}) {
  try {
    const {
      publishDate = new Date(),
      categoryOverride,
      tagsOverride,
      autorNombre,
      scheduleStatus = 'published'
    } = options;

    // Verificar que no esté ya publicado (idempotencia)
    if (draft.publishedAs) {
      const existing = await News.findById(draft.publishedAs);
      if (existing) {
        console.log(`  ⚠️ Borrador ${draft._id} ya publicado como noticia ${existing._id}`);
        return { news: existing, draft, alreadyPublished: true };
      }
    }

    // Determinar categoría
    const categoria = categoryOverride || draft.categoria || 'General';

    // 🖼️ CAMPO CRÍTICO: Imagen de portada
    // El modelo News usa el campo "imagen" (string simple)
    // Lógica de selección basada en imageKind:
    // - 'ai': imágenes generadas por IA (DALL-E, Flux, etc.)
    // - 'processed': imágenes capturadas y procesadas desde sitios web
    let imagen = null;

    if (draft.imageKind === 'ai' && draft.generatedImages?.principal) {
      // Portada generada con IA
      imagen = draft.generatedImages.principal;
    } else if (draft.imageKind === 'processed' && draft.coverUrl) {
      // Portada capturada y procesada desde el sitio
      imagen = draft.coverUrl || draft.coverFallbackUrl;
    } else if (draft.generatedImages?.principal) {
      // Fallback: tiene imagen IA sin imageKind definido (compatibilidad)
      imagen = draft.generatedImages.principal;
    } else if (draft.coverUrl) {
      // Fallback: tiene coverUrl sin imageKind definido
      imagen = draft.coverUrl;
    } else if (draft.coverImageUrl) {
      // Fallback adicional: campo legacy
      imagen = draft.coverImageUrl;
    }

    imagen = imagen || ''; // Asegurar string vacío si no hay imagen

    // Determinar autor
    let autor = autorNombre || 'Redactor IA';
    if (draft.generatedBy && typeof draft.generatedBy === 'object') {
      // Si está poblado
      if (draft.generatedBy.aliasPublico?.trim()) {
        autor = draft.generatedBy.aliasPublico.trim();
      } else if (draft.generatedBy.firstName && draft.generatedBy.lastName) {
        autor = `${draft.generatedBy.firstName} ${draft.generatedBy.lastName}`.trim();
      } else if (draft.generatedBy.nickname?.trim()) {
        autor = draft.generatedBy.nickname.trim();
      } else if (draft.generatedBy.name?.trim()) {
        autor = draft.generatedBy.name.trim();
      } else if (draft.generatedBy.email) {
        autor = draft.generatedBy.email.split('@')[0];
      }
    }

    // Crear noticia con los campos correctos del modelo News
    const newsDoc = await News.create({
      titulo: draft.titulo,
      bajada: draft.bajada || '',
      contenido: draft.contenidoHTML || draft.contenidoMarkdown || '',
      categoria,
      etiquetas: Array.isArray(tagsOverride) ? tagsOverride : (draft.etiquetas || []),
      imagen, // ✅ Campo correcto del modelo News
      imageProvider: draft.imageProvider || 'dall-e-3', // ✅ Proveedor real de la imagen
      autor,
      publishedAt: publishDate,
      status: scheduleStatus,
      // Metadatos de IA
      mode: draft.mode || 'factual',
      aiMetadata: {
        categoryConfidence: draft.aiMetadata?.categoryConfidence || null,
        originalityScore: draft.aiMetadata?.originalityScore || null,
        contentOrigin: draft.aiMetadata?.contentOrigin || null,
        model: draft.aiMetadata?.model || '',
        generatedFrom: draft._id.toString(),
      },
    });

    // Actualizar borrador
    draft.publishedAs = newsDoc._id;
    draft.publishedAt = publishDate;
    draft.status = 'published';
    draft.publishStatus = 'publicado';
    await draft.save();

    console.log(`  ✅ Borrador ${draft._id} publicado como noticia ${newsDoc._id}`);
    console.log(`     - Título: "${draft.titulo.substring(0, 50)}..."`);
    console.log(`     - Imagen: ${imagen ? imagen.substring(0, 60) : 'SIN IMAGEN'}`);
    console.log(`     - Autor: ${autor}`);
    console.log(`     - Categoría: ${categoria}`);

    return { news: newsDoc, draft, alreadyPublished: false };
  } catch (error) {
    console.error(`  ❌ Error publicando borrador ${draft._id}:`, error.message);
    throw error;
  }
}

module.exports = { publishDraftToNews };
