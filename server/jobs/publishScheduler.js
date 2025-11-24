const cron = require("node-cron");
const News = require("../models/News");

/**
 * Scheduler para publicar noticias programadas
 * Se ejecuta cada minuto y publica noticias cuya fecha de publicación ha llegado
 */

let schedulerRunning = false;

const publishScheduledNews = async () => {
  // Evitar ejecuciones concurrentes
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const now = new Date();
    
    // Buscar noticias programadas cuya fecha de publicación ya pasó
    const noticiasParaPublicar = await News.find({
      status: "scheduled",
      publishAt: { $lte: now }
    });

    if (noticiasParaPublicar.length > 0) {
      console.log(`📅 Publicando ${noticiasParaPublicar.length} noticia(s) programada(s)...`);
      
      // Actualizar todas las noticias encontradas
      const resultado = await News.updateMany(
        {
          status: "scheduled",
          publishAt: { $lte: now }
        },
        {
          $set: {
            status: "published",
            publishedAt: now
          },
          $unset: {
            publishAt: ""
          }
        }
      );

      console.log(`✅ ${resultado.modifiedCount} noticia(s) publicada(s) automáticamente`);
      
      // Log individual para debug
      noticiasParaPublicar.forEach(noticia => {
        console.log(`  - "${noticia.titulo.substring(0, 50)}..." (ID: ${noticia._id})`);
      });
    }
  } catch (error) {
    console.error("❌ Error en el scheduler de publicaciones:", error.message);
  } finally {
    schedulerRunning = false;
  }
};

const startPublishScheduler = () => {
  console.log("🕐 Iniciando scheduler de publicaciones programadas (cada minuto)...");
  
  // Ejecutar cada minuto (00 segundos de cada minuto)
  // Usar UTC para consistencia
  cron.schedule("0 * * * * *", publishScheduledNews, {
    timezone: "UTC"
  });
  
  console.log("✅ Scheduler de publicaciones iniciado correctamente");
};

module.exports = {
  startPublishScheduler,
  publishScheduledNews // Exportar para testing manual
};
