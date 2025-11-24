const News = require("../models/News");
const { getPost } = require("../services/facebookPublisher");

/**
 * Job para sincronizar automáticamente el estado de publicaciones de Facebook
 * 
 * IMPORTANTE: Este job está DESHABILITADO por defecto.
 * Para habilitarlo, añade en server.js:
 * 
 * // Importar el job
 * const { startFacebookSyncJob } = require("./jobs/syncFacebookPosts");
 * 
 * // Iniciar el job (después de connectDB())
 * if (process.env.ENABLE_FACEBOOK_SYNC === 'true') {
 *   startFacebookSyncJob();
 * }
 * 
 * Y en tu .env:
 * ENABLE_FACEBOOK_SYNC=true
 * FACEBOOK_SYNC_INTERVAL=60  # minutos (opcional, por defecto 60)
 */

/**
 * Sincroniza el estado de todas las publicaciones de Facebook
 */
async function syncAllFacebookPosts() {
  console.log("\n[FB Sync Job] === INICIANDO SINCRONIZACIÓN AUTOMÁTICA ===");
  
  try {
    // Buscar todas las noticias con post_id de Facebook
    const noticias = await News.find({ 
      facebook_post_id: { $ne: null },
      facebook_status: { $in: ["published", "sharing"] } // Solo sincronizar las que deberían estar activas
    }).select('facebook_post_id facebook_status facebook_permalink_url titulo');

    if (noticias.length === 0) {
      console.log("[FB Sync Job] No hay noticias para sincronizar");
      return { updated: 0, errors: 0 };
    }

    console.log(`[FB Sync Job] Sincronizando ${noticias.length} noticias...`);

    let updated = 0;
    let errors = 0;

    // Procesar en lotes para evitar rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < noticias.length; i += BATCH_SIZE) {
      const batch = noticias.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (noticia) => {
        try {
          // Verificar si el post existe en Facebook
          const postInfo = await getPost({ 
            postId: noticia.facebook_post_id 
          });

          let needsUpdate = false;
          let newStatus = noticia.facebook_status;
          let newPermalink = noticia.facebook_permalink_url;

          if (!postInfo.exists) {
            // Post no existe en Facebook
            if (noticia.facebook_status !== "deleted") {
              newStatus = "deleted";
              needsUpdate = true;
              console.log(`[FB Sync Job] Post ${noticia.facebook_post_id} eliminado - actualizando ${noticia._id}`);
            }
          } else {
            // Post existe
            if (noticia.facebook_status !== "published") {
              newStatus = "published";
              needsUpdate = true;
              console.log(`[FB Sync Job] Post ${noticia.facebook_post_id} existe - actualizando ${noticia._id}`);
            }
            
            // Actualizar permalink si cambió
            if (postInfo.permalink_url && postInfo.permalink_url !== noticia.facebook_permalink_url) {
              newPermalink = postInfo.permalink_url;
              needsUpdate = true;
            }
          }

          // Actualizar si hay cambios
          if (needsUpdate) {
            noticia.facebook_status = newStatus;
            noticia.facebook_permalink_url = newPermalink;
            noticia.facebook_last_sync_at = new Date();
            noticia.facebook_last_error = null;

            // Actualizar campo legacy para compatibilidad
            if (!noticia.share) {
              noticia.share = { wa: { status: "none" }, fb: { status: "none" } };
            }
            
            if (newStatus === "published") {
              noticia.share.fb = {
                status: "posted",
                lastAt: new Date(),
                postId: noticia.facebook_post_id,
                permalink: newPermalink
              };
            } else if (newStatus === "deleted") {
              noticia.share.fb = {
                status: "none",
                lastAt: new Date(),
                postId: null,
                permalink: null
              };
            }

            await noticia.save();
            updated++;
          } else {
            // Solo actualizar timestamp de sincronización
            noticia.facebook_last_sync_at = new Date();
            await noticia.save();
          }

        } catch (syncError) {
          console.error(`[FB Sync Job] ❌ Error sincronizando ${noticia._id}:`, syncError.message);
          
          // Actualizar con error
          noticia.facebook_last_error = syncError.message;
          noticia.facebook_last_sync_at = new Date();
          await noticia.save();
          
          errors++;
        }
      }));

      // Pausa entre lotes para evitar rate limits
      if (i + BATCH_SIZE < noticias.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
      }
    }

    console.log(`[FB Sync Job] ✅ Sincronización completada: ${updated} actualizadas, ${errors} errores`);
    console.log("[FB Sync Job] === SINCRONIZACIÓN AUTOMÁTICA COMPLETADA ===\n");

    return { updated, errors, total: noticias.length };

  } catch (error) {
    console.error("[FB Sync Job] ❌ Error general en sincronización automática:", error);
    return { updated: 0, errors: 1, total: 0, error: error.message };
  }
}

/**
 * Inicia el job de sincronización automática
 */
function startFacebookSyncJob() {
  const cron = require("node-cron");
  
  // Obtener intervalo desde variables de entorno (por defecto 60 minutos)
  const intervalMinutes = parseInt(process.env.FACEBOOK_SYNC_INTERVAL) || 60;
  
  // Validar intervalo (mínimo 15 minutos para evitar rate limits)
  const finalInterval = Math.max(intervalMinutes, 15);
  
  console.log(`[FB Sync Job] 🕐 Iniciando job de sincronización cada ${finalInterval} minutos`);
  
  // Crear expresión cron para el intervalo
  const cronExpression = `*/${finalInterval} * * * *`;
  
  // Programar el job
  cron.schedule(cronExpression, async () => {
    try {
      await syncAllFacebookPosts();
    } catch (error) {
      console.error("[FB Sync Job] ❌ Error ejecutando job:", error);
    }
  });
  
  console.log(`[FB Sync Job] ✅ Job de sincronización programado (${cronExpression})`);
  
  // Ejecutar una vez al inicio (después de 30 segundos)
  setTimeout(async () => {
    console.log("[FB Sync Job] 🚀 Ejecutando sincronización inicial...");
    await syncAllFacebookPosts();
  }, 30000);
}

module.exports = {
  syncAllFacebookPosts,
  startFacebookSyncJob
};

