// server/jobs/draftPublishScheduler.js
const cron = require("node-cron");
const AiDraft = require("../models/AiDraft");
const { publishDraftToNews } = require("../redactor_ia/services/publishDraftHelper");

/**
 * Scheduler para publicar borradores IA programados
 * Se ejecuta cada minuto y publica borradores cuya fecha de publicación ha llegado
 */

let schedulerRunning = false;

/**
 * Publica un borrador IA como noticia usando la función helper compartida
 * con el endpoint manual de publicación
 */
async function publishDraft(draft) {
  try {
    console.log(`  📄 Publicando borrador: ${draft._id}`);
    console.log(`     - Título: "${draft.titulo.substring(0, 50)}..."`);
    console.log(`     - coverImageUrl: ${draft.coverImageUrl || 'null'}`);
    console.log(`     - coverUrl: ${draft.coverUrl || 'null'}`);
    console.log(`     - generatedImages.principal: ${draft.generatedImages?.principal || 'null'}`);
    
    // Usar función helper compartida con el flujo manual
    const result = await publishDraftToNews(draft, {
      publishDate: new Date(),
      scheduleStatus: 'published'
    });

    if (result.alreadyPublished) {
      return result.news;
    }

    console.log(`  ✅ Noticia creada: ${result.news._id}`);
    console.log(`     - news.imagen: ${result.news.imagen || 'VACÍO ⚠️'}`);
    console.log(`     - news.autor: ${result.news.autor}`);
    console.log(`     - URL: /noticia/${result.news._id}`);
    
    return result.news;
  } catch (error) {
    console.error(`  ❌ Error publicando borrador ${draft._id}:`, error.message);
    console.error(`     Stack:`, error.stack);
    return null;
  }
}

const publishScheduledDrafts = async () => {
  // Evitar ejecuciones concurrentes
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const now = new Date();
    
    // Buscar borradores programados cuya fecha de publicación ya pasó
    // Retrocompatible: aunque el scheduler debería procesar solo borradores
    // que ya pasaron por las rutas que inicializan publishStatus,
    // mantenemos la consulta robusta por si acaso
    const borradores = await AiDraft.find({
      scheduledAt: { $lte: now },
      publishedAs: null, // No publicados aún
      $or: [
        { publishStatus: 'programado' },
        { publishStatus: { $exists: false } } // Fallback para borradores antiguos
      ]
    }).limit(10); // Publicar máximo 10 por minuto para no saturar

    if (borradores.length > 0) {
      console.log(`📅 Publicando ${borradores.length} borrador(es) IA programado(s)...`);
      
      let publicados = 0;
      for (const borrador of borradores) {
        const news = await publishDraft(borrador);
        if (news) publicados++;
      }

      console.log(`✅ ${publicados}/${borradores.length} borrador(es) IA publicado(s) automáticamente`);
    }
  } catch (error) {
    console.error("❌ Error en el scheduler de borradores IA:", error.message);
  } finally {
    schedulerRunning = false;
  }
};

const startDraftPublishScheduler = () => {
  console.log("🕐 Iniciando scheduler de borradores IA programados (cada minuto)...");
  
  // Ejecutar cada minuto (00 segundos de cada minuto)
  cron.schedule("0 * * * * *", publishScheduledDrafts, {
    timezone: "UTC"
  });
  
  console.log("✅ Scheduler de borradores IA iniciado correctamente");
};

module.exports = {
  startDraftPublishScheduler,
  publishScheduledDrafts // Exportar para testing manual
};
