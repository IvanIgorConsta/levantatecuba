const express = require("express");
const router = express.Router();
const News = require("../models/News");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { publishToFacebook, publishNewsToFacebook, buildNewsPublicUrl, deletePost, getPost } = require("../services/facebookPublisher");
const fetch = require("node-fetch");
const { assertHttpsAbsolute, sanitizeForMeta } = require("../utils/og");

/**
 * POST /api/social/facebook/share
 * Publica una noticia en Facebook con manejo estricto de errores
 */
router.post("/facebook/share", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const { postId, message, link, userToken } = req.body;

    // Validaciones de entrada
    if (!postId) {
      return res.status(400).json({ 
        status: "error", 
        code: "MISSING_POST_ID", 
        message: "El ID de la noticia es obligatorio" 
      });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ 
        status: "error", 
        code: "INVALID_MESSAGE", 
        message: "El mensaje es obligatorio y debe ser texto válido" 
      });
    }

    // Buscar la noticia
    const noticia = await News.findById(postId);
    if (!noticia) {
      return res.status(404).json({ 
        status: "error", 
        code: "NOT_FOUND", 
        message: "Noticia no encontrada" 
      });
    }

    // Verificar que esté publicada
    if (noticia.status !== "published") {
      return res.status(409).json({ 
        status: "error", 
        code: "NOT_PUBLISHED", 
        message: "La noticia debe estar publicada para compartir" 
      });
    }

    // Verificar si ya está compartida
    if (noticia.facebook_status === "published" && noticia.facebook_post_id) {
      return res.status(409).json({ 
        status: "error", 
        code: "ALREADY_SHARED", 
        message: "Esta noticia ya fue compartida en Facebook",
        fbPostId: noticia.facebook_post_id,
        permalink: noticia.facebook_permalink_url
      });
    }

    // Actualizar estado a "sharing" con timestamp para control de expiración
    noticia.facebook_status = "sharing";
    noticia.facebook_sharing_since = new Date();
    noticia.facebook_attempt_count = (noticia.facebook_attempt_count || 0) + 1;
    await noticia.save();

    try {
      // Publicar en Facebook como photo post + Story automático
      console.log(`[Social Routes] Publicando noticia ${postId} en Facebook (post + story)`);
      const { fbPostId, permalink, storyId, storyPublished } = await publishNewsToFacebook(noticia, { 
        userToken,
        manualPublish: true // Flag para indicar que es publicación manual (ya pusimos el lock)
      });

      // Actualizar noticia con éxito
      noticia.facebook_status = "published";
      noticia.facebook_post_id = fbPostId;
      noticia.facebook_permalink_url = permalink;
      noticia.facebook_published_at = new Date();
      noticia.facebook_published_by = req.user.id;
      noticia.facebook_last_error = null;

      // Actualizar campo legacy para compatibilidad
      if (!noticia.share) {
        noticia.share = { wa: { status: "none" }, fb: { status: "none" } };
      }
      noticia.share.fb = {
        status: "posted",
        lastAt: new Date(),
        postId: fbPostId,
        permalink: permalink,
        storyId: storyId || null,
        storyPublished: storyPublished || false
      };
      noticia.share.lastSharedAt = new Date();

      await noticia.save();

      console.log(`[Social Routes] ✅ Noticia ${postId} publicada exitosamente${storyPublished ? ' + Story' : ''}`);

      return res.json({
        status: "ok",
        postId: noticia._id,
        fbPostId,
        permalink,
        storyId: storyId || null,
        storyPublished: storyPublished || false
      });

    } catch (publishError) {
      console.error(`[Social Routes] ❌ Error publicando noticia ${postId}:`, publishError);

      // Mapear error con códigos HTTP apropiados
      let errorCode = "UNKNOWN_ERROR";
      let errorMessage = publishError.message || "Error desconocido al publicar";
      let httpStatus = 500;
      let suggestion = null;

      if (publishError.cause) {
        errorCode = publishError.cause.code || errorCode;
        httpStatus = publishError.cause.httpStatus || httpStatus;
        suggestion = publishError.cause.suggestion;
        
        // Detalles adicionales para ciertos errores
        if (publishError.cause.missing) {
          errorMessage += `. Permisos faltantes: ${publishError.cause.missing.join(", ")}`;
        }
        
        if (publishError.cause.action) {
          suggestion = publishError.cause.action;
        }
      }

      // Mapeo específico de códigos
      switch (errorCode) {
        case "CONFIG_ERROR":
          httpStatus = 500;
          suggestion = "Verifica la configuración del servidor (.env)";
          break;
        case "INVALID_TOKEN":
          httpStatus = 401;
          suggestion = "Regenera el token en Meta Business Suite";
          break;
        case "PERMISSIONS_ERROR":
          httpStatus = 403;
          suggestion = suggestion || "Re-autorizar con permisos pages_manage_posts y pages_read_engagement";
          break;
        case "PAGE_TOKEN_ERROR":
        case "ACCESS_ERROR":
          httpStatus = 403;
          suggestion = "Verifica que el usuario administre la página";
          break;
        case "INVALID_PARAMS":
          httpStatus = 400;
          break;
        case "RATE_LIMIT":
          httpStatus = 429;
          suggestion = "Espera unos minutos antes de reintentar";
          break;
        case "WRONG_APP":
          httpStatus = 401;
          suggestion = "El token pertenece a una aplicación diferente";
          break;
        case "NO_TOKEN":
          httpStatus = 401;
          suggestion = "Configura FACEBOOK_PAGE_TOKEN o proporciona userToken";
          break;
      }

      // Actualizar noticia con error
      noticia.facebook_status = "error";
      noticia.facebook_last_error = errorMessage;
      
      // Actualizar campo legacy
      if (!noticia.share) {
        noticia.share = { wa: { status: "none" }, fb: { status: "none" } };
      }
      noticia.share.fb = {
        status: "error",
        lastAt: new Date(),
        error: errorMessage
      };

      await noticia.save();

      const responseBody = {
        status: "error",
        code: errorCode,
        message: errorMessage
      };

      if (suggestion) {
        responseBody.suggestion = suggestion;
      }

      // Información adicional para errores de configuración
      if (errorCode === "CONFIG_ERROR") {
        responseBody.details = "Error de configuración del servidor";
        responseBody.action = "Contacta al administrador del sistema";
      }

      return res.status(httpStatus).json(responseBody);
    }

  } catch (error) {
    console.error("[Social Routes] ❌ Error general:", error);
    return res.status(500).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor"
    });
  }
});

/**
 * GET /api/social/facebook/status/:postId
 * Obtiene el estado de compartido de una noticia
 */
router.get("/facebook/status/:postId", verifyToken, async (req, res) => {
  try {
    const noticia = await News.findById(req.params.postId)
      .select("facebook_status facebook_post_id facebook_permalink_url facebook_last_error facebook_published_at facebook_attempt_count");

    if (!noticia) {
      return res.status(404).json({ 
        status: "error", 
        message: "Noticia no encontrada" 
      });
    }

    res.json({
      status: noticia.facebook_status || "not_shared",
      fbPostId: noticia.facebook_post_id,
      permalink: noticia.facebook_permalink_url,
      lastError: noticia.facebook_last_error,
      publishedAt: noticia.facebook_published_at,
      attemptCount: noticia.facebook_attempt_count || 0
    });

  } catch (error) {
    console.error("[Social Routes] Error obteniendo estado:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Error al obtener estado" 
    });
  }
});

/**
 * GET /api/social/facebook/debug
 * Endpoint de diagnóstico para verificar configuración (solo admin)
 */
router.get("/facebook/debug", verifyToken, verifyRole(["admin"]), async (req, res) => {
  try {
    const { getFacebookConfig } = require("../config/facebook");
    const { debugToken } = require("../services/facebookPublisher");
    
    // Verificar configuración
    let config = null;
    let configStatus = "ok";
    let configErrors = [];
    
    try {
      config = getFacebookConfig();
    } catch (error) {
      configStatus = "error";
      configErrors.push(error.message);
    }
    
    const response = {
      status: configStatus,
      timestamp: new Date().toISOString(),
      config: {
        status: configStatus,
        errors: configErrors
      }
    };
    
    if (config) {
      // Información básica de configuración (sin secretos)
      response.config.appId = `****${config.appId.slice(-4)}`;
      response.config.graphVersion = config.graphVersion;
      response.config.pageId = config.pageId;
      response.config.hasPageToken = !!config.pageToken;
      
      // Verificar token si existe
      if (config.pageToken) {
        try {
          const tokenInfo = await debugToken(config.appId, config.appSecret, config.pageToken);
          
          response.token = {
            valid: tokenInfo.isValid,
            type: tokenInfo.type,
            profileId: tokenInfo.profileId,
            isPageToken: tokenInfo.profileId === config.pageId,
            appMatch: tokenInfo.appId === config.appId
          };
          
          // Si es user token, indicarlo
          if (tokenInfo.isValid && tokenInfo.profileId !== config.pageId) {
            response.permissions = {
              note: "Token es USER_TOKEN, se convertirá automáticamente a PAGE_TOKEN al publicar"
            };
          }
          
        } catch (error) {
          response.token = {
            valid: false,
            error: error.message
          };
        }
      }
    }
    
    // Generar warnings y recomendaciones
    response.warnings = [];
    response.recommendations = [];
    
    if (configStatus === "error") {
      response.warnings.push("Configuración inválida - revisa .env y reinicia");
    }
    
    if (config?.appId === "783988867916816") {
      response.warnings.push("FACEBOOK_APP_ID incorrecto - debe ser 7839888679168616");
    }
    
    if (response.token?.valid === false) {
      response.warnings.push("Token inválido - regenera en Meta Business Suite");
    }
    
    if (response.permissions?.hasRequired === false) {
      response.warnings.push(`Faltan permisos: ${response.permissions.missing.join(", ")}`);
    }
    
    if (response.token?.isPageToken === false) {
      response.recommendations.push("Usando USER_TOKEN - se convertirá automáticamente a PAGE_TOKEN");
    }
    
    response.recommendations.push("En producción, rotar tokens regularmente");
    
    res.json(response);

  } catch (error) {
    console.error("[Social Routes] Error en debug:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Error al verificar configuración",
      error: error.message
    });
  }
});

/**
 * GET /api/social/facebook/rescrape
 * Re-scrapea una URL para actualizar el caché de Open Graph de Facebook
 */
router.get("/facebook/rescrape", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        status: "error",
        message: "URL es requerida"
      });
    }
    
    // Validar que sea una URL HTTPS absoluta
    if (!assertHttpsAbsolute(url)) {
      return res.status(400).json({
        status: "error",
        message: "La URL debe ser HTTPS absoluta"
      });
    }
    
    console.log(`[Social Routes] Re-scrapeando URL: ${url}`);
    
    // Obtener configuración de Facebook
    const { getFacebookConfig } = require("../config/facebook");
    let config;
    
    try {
      config = getFacebookConfig();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Error de configuración de Facebook",
        code: "CONFIG_ERROR"
      });
    }
    
    // Usar app access token o page token
    const accessToken = `${config.appId}|${config.appSecret}`; // App access token
    
    // Llamar al endpoint de scrape de Facebook
    const scrapeUrl = `https://graph.facebook.com/?id=${encodeURIComponent(url)}&scrape=true&access_token=${accessToken}`;
    
    try {
      const response = await fetch(scrapeUrl, {
        method: "POST",
        timeout: 10000
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.error("[Social Routes] Error de Facebook al re-scrapear:", data.error);
        return res.status(502).json({
          status: "error",
          message: `Facebook error: ${data.error.message}`,
          code: "FB_SCRAPE_ERROR"
        });
      }
      
      // Extraer información del og_object
      const ogObject = data.og_object || {};
      const title = ogObject.title || data.title || "Sin título";
      const description = ogObject.description || "Sin descripción";
      const image = ogObject.image ? ogObject.image[0]?.url : null;
      const updatedTime = data.updated_time;
      
      console.log(`[Social Routes] ✅ Re-scrape exitoso: ${title}`);
      
      return res.json({
        success: true,
        title: sanitizeForMeta(title),
        description: sanitizeForMeta(description),
        image,
        updated_time: updatedTime,
        og_object: {
          id: ogObject.id,
          type: ogObject.type,
          url: ogObject.url
        }
      });
      
    } catch (fetchError) {
      console.error("[Social Routes] Error al llamar API de Facebook:", fetchError);
      return res.status(502).json({
        status: "error",
        message: "Error al conectar con Facebook",
        error: fetchError.message
      });
    }
    
  } catch (error) {
    console.error("[Social Routes] Error en re-scrape:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
      error: error.message
    });
  }
});

/**
 * POST /api/social/facebook/test
 * Endpoint de prueba para validar publicación (solo admin)
 */
router.post("/facebook/test", verifyToken, verifyRole(["admin"]), async (req, res) => {
  try {
    const { dryRun = true, userToken } = req.body;
    
    console.log(`[Social Routes] Test de publicación (dryRun: ${dryRun})`);
    
    if (dryRun) {
      // Solo verificar configuración
      const { getFacebookConfig } = require("../config/facebook");
      const { debugToken } = require("../services/facebookPublisher");
      
      const config = getFacebookConfig();
      const token = userToken || config.pageToken;
      
      if (!token) {
        return res.status(400).json({
          status: "error",
          message: "No hay token disponible para la prueba"
        });
      }
      
      // Verificar token
      const tokenInfo = await debugToken(config.appId, config.appSecret, token);
      
      return res.json({
        status: "ok",
        message: "Prueba en modo seco completada",
        checks: {
          configValid: true,
          tokenValid: tokenInfo.isValid,
          tokenType: tokenInfo.profileId === config.pageId ? "PAGE_TOKEN" : "USER_TOKEN"
        }
      });
    } else {
      // Publicación real de prueba
      const testMessage = `Prueba de API - ${new Date().toLocaleString()}`;
      
      const result = await publishToFacebook({ 
        message: testMessage,
        userToken
      });
      
      return res.json({
        status: "ok",
        message: "Prueba exitosa - Post publicado",
        fbPostId: result.fbPostId,
        permalink: result.permalink
      });
    }
    
  } catch (error) {
    console.error("[Social Routes] Error en test:", error);
    
    let httpStatus = 500;
    if (error.cause?.httpStatus) {
      httpStatus = error.cause.httpStatus;
    }
    
    const errorResponse = {
      status: "error",
      message: error.message
    };
    
    if (error.cause) {
      errorResponse.code = error.cause.code;
      errorResponse.details = error.cause;
    }
    
    res.status(httpStatus).json(errorResponse);
  }
});

/**
 * DELETE /api/social/facebook/:newsId
 * Elimina una publicación de Facebook y actualiza el estado de la noticia
 */
router.delete("/facebook/:newsId", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const { newsId } = req.params;
    const { userToken } = req.body;

    // Buscar la noticia
    const noticia = await News.findById(newsId);
    if (!noticia) {
      return res.status(404).json({ 
        status: "error", 
        code: "NOT_FOUND", 
        message: "Noticia no encontrada" 
      });
    }

    // Verificar que tenga un post de Facebook
    if (!noticia.facebook_post_id) {
      return res.status(409).json({ 
        status: "error", 
        code: "NOT_SHARED", 
        message: "Esta noticia no tiene una publicación de Facebook asociada" 
      });
    }

    // Verificar que esté en estado compartido
    if (noticia.facebook_status !== "published") {
      return res.status(409).json({ 
        status: "error", 
        code: "NOT_PUBLISHED", 
        message: "La noticia no está marcada como publicada en Facebook" 
      });
    }

    console.log(`[Social Routes] Eliminando post de Facebook para noticia ${newsId}`);

    try {
      // Eliminar en Facebook
      const deleteResult = await deletePost({ 
        postId: noticia.facebook_post_id, 
        userToken 
      });

      // Actualizar estado de la noticia
      noticia.facebook_status = "deleted";
      noticia.facebook_deleted_at = new Date();
      noticia.facebook_last_sync_at = new Date();
      noticia.facebook_last_error = null;

      // Actualizar campo legacy para compatibilidad
      if (!noticia.share) {
        noticia.share = { wa: { status: "none" }, fb: { status: "none" } };
      }
      noticia.share.fb = {
        status: "none",
        lastAt: new Date(),
        postId: null,
        permalink: null
      };

      await noticia.save();

      console.log(`[Social Routes] ✅ Post eliminado y noticia actualizada: ${newsId}`);

      return res.json({
        ok: true,
        newsId: noticia._id,
        status: "deleted",
        postId: null,
        permalink: null,
        lastSyncAt: noticia.facebook_last_sync_at,
        lastError: null,
        existed: deleteResult.existed
      });

    } catch (deleteError) {
      console.error(`[Social Routes] ❌ Error eliminando post de Facebook:`, deleteError);

      // Mapear error con códigos HTTP apropiados
      let errorCode = "UNKNOWN_ERROR";
      let errorMessage = deleteError.message || "Error desconocido al eliminar";
      let httpStatus = 500;
      let suggestion = null;

      if (deleteError.cause) {
        errorCode = deleteError.cause.code || errorCode;
        httpStatus = deleteError.cause.httpStatus || httpStatus;
        suggestion = deleteError.cause.suggestion;
      }

      // Mapeo específico de códigos
      switch (errorCode) {
        case "CONFIG_ERROR":
          httpStatus = 500;
          suggestion = "Verifica la configuración del servidor (.env)";
          break;
        case "INVALID_TOKEN":
          httpStatus = 401;
          suggestion = "Regenera el token en Meta Business Suite";
          break;
        case "PERMISSIONS_ERROR":
          httpStatus = 403;
          suggestion = "Re-autorizar con permisos pages_manage_posts";
          break;
        case "PAGE_TOKEN_ERROR":
          httpStatus = 403;
          suggestion = "Verifica que el usuario administre la página";
          break;
        case "NO_TOKEN":
          httpStatus = 401;
          suggestion = "Configura FACEBOOK_PAGE_TOKEN o proporciona userToken";
          break;
      }

      // Actualizar noticia con error
      noticia.facebook_last_error = errorMessage;
      noticia.facebook_last_sync_at = new Date();
      await noticia.save();

      const responseBody = {
        status: "error",
        code: errorCode,
        message: errorMessage
      };

      if (suggestion) {
        responseBody.suggestion = suggestion;
      }

      return res.status(httpStatus).json(responseBody);
    }

  } catch (error) {
    console.error("[Social Routes] ❌ Error general en eliminación:", error);
    return res.status(500).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor"
    });
  }
});

/**
 * POST /api/social/facebook/sync
 * Re-sincroniza el estado de publicaciones de Facebook
 */
router.post("/facebook/sync", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const { ids, userToken } = req.body;
    
    console.log(`[Social Routes] Iniciando sincronización de Facebook`);

    // Determinar qué noticias sincronizar
    let query = { facebook_post_id: { $ne: null } };
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Sincronizar IDs específicos
      query._id = { $in: ids };
      console.log(`[Social Routes] Sincronizando ${ids.length} noticias específicas`);
    } else {
      // Sincronizar todas las que tengan postId
      console.log(`[Social Routes] Sincronizando todas las noticias con postId`);
    }

    const noticias = await News.find(query).select(
      'facebook_post_id facebook_status facebook_permalink_url facebook_last_sync_at facebook_last_error titulo'
    );

    if (noticias.length === 0) {
      return res.json({
        ok: true,
        message: "No hay noticias para sincronizar",
        updated: [],
        errors: []
      });
    }

    console.log(`[Social Routes] Encontradas ${noticias.length} noticias para sincronizar`);

    const updated = [];
    const errors = [];

    // Procesar cada noticia
    for (const noticia of noticias) {
      try {
        console.log(`[Social Routes] Sincronizando noticia ${noticia._id} (post: ${noticia.facebook_post_id})`);

        // Verificar si el post existe en Facebook
        const postInfo = await getPost({ 
          postId: noticia.facebook_post_id, 
          userToken 
        });

        let newStatus = noticia.facebook_status;
        let newPermalink = noticia.facebook_permalink_url;
        let errorMessage = null;

        if (!postInfo.exists) {
          // Post no existe en Facebook
          newStatus = "deleted";
          console.log(`[Social Routes] Post ${noticia.facebook_post_id} no existe - marcando como deleted`);
        } else {
          // Post existe
          newStatus = "published";
          if (postInfo.permalink_url && postInfo.permalink_url !== noticia.facebook_permalink_url) {
            newPermalink = postInfo.permalink_url;
            console.log(`[Social Routes] Permalink actualizado para ${noticia._id}`);
          }
          console.log(`[Social Routes] Post ${noticia.facebook_post_id} existe - marcando como published`);
        }

        // Actualizar noticia si hay cambios
        if (newStatus !== noticia.facebook_status || newPermalink !== noticia.facebook_permalink_url) {
          noticia.facebook_status = newStatus;
          noticia.facebook_permalink_url = newPermalink;
          noticia.facebook_last_sync_at = new Date();
          noticia.facebook_last_error = errorMessage;

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

          updated.push({
            newsId: noticia._id,
            title: noticia.titulo,
            oldStatus: noticia.facebook_status,
            newStatus: newStatus,
            postId: noticia.facebook_post_id,
            permalink: newPermalink,
            lastSyncAt: noticia.facebook_last_sync_at
          });
        } else {
          // Solo actualizar timestamp de sincronización
          noticia.facebook_last_sync_at = new Date();
          await noticia.save();
        }

      } catch (syncError) {
        console.error(`[Social Routes] ❌ Error sincronizando noticia ${noticia._id}:`, syncError);
        
        // Actualizar con error
        noticia.facebook_last_error = syncError.message;
        noticia.facebook_last_sync_at = new Date();
        await noticia.save();

        errors.push({
          newsId: noticia._id,
          title: noticia.titulo,
          error: syncError.message,
          code: syncError.cause?.code || "SYNC_ERROR"
        });
      }
    }

    console.log(`[Social Routes] ✅ Sincronización completada: ${updated.length} actualizadas, ${errors.length} errores`);

    return res.json({
      ok: true,
      message: `Sincronización completada: ${updated.length} actualizadas, ${errors.length} errores`,
      updated,
      errors,
      totalProcessed: noticias.length
    });

  } catch (error) {
    console.error("[Social Routes] ❌ Error general en sincronización:", error);
    return res.status(500).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
      error: error.message
    });
  }
});

module.exports = router;