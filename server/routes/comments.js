const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const News = require("../models/News");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");

// Función auxiliar para resolver el displayName del usuario
async function resolveDisplayNameFromReq(req) {
  try {
    // Obtener el userId del token
    const userId = req.user.sub || req.user.id;
    
    if (!userId) {
      console.error('[COMMENTS] No userId found in token');
      return null;
    }
    
    // Buscar el usuario en la base de datos
    const user = await User.findById(userId).select('name nickname firstName lastName email');
    
    if (!user) {
      console.error('[COMMENTS] User not found in database:', userId);
      return null;
    }
    
    // Determinar el displayName con orden de prioridad
    let displayName = '';
    
    if (user.nickname && user.nickname.trim()) {
      displayName = user.nickname;
    } else if (user.name && user.name.trim()) {
      displayName = user.name;
    } else if (user.firstName && user.firstName.trim()) {
      displayName = user.firstName;
      if (user.lastName && user.lastName.trim()) {
        displayName += ' ' + user.lastName;
      }
    } else if (user.email) {
      // Usar el prefijo del email como último recurso
      displayName = user.email.split('@')[0];
    } else {
      displayName = 'Anónimo';
    }
    
    console.log('[COMMENTS] Resolved displayName:', { userId, displayName, userEmail: user.email });
    return displayName;
  } catch (error) {
    console.error('[COMMENTS] Error resolving displayName:', error);
    return null;
  }
}

// ✅ Obtener comentarios anidados por noticia (con soporte para paginación)
router.get("/:newsId", async (req, res) => {
  try {
    const { parentId, limit = 10, cursor } = req.query;
    const newsId = req.params.newsId;
    
    // Construir query base
    const query = { noticia: newsId };
    
    // Si se especifica parentId, buscar solo hijos de ese comentario
    if (parentId) {
      query.parentId = parentId;
    } else {
      // Si no hay parentId, buscar solo comentarios raíz
      query.$or = [
        { parentId: null },
        { parentId: { $exists: false } },
        { padre: null },
        { padre: { $exists: false } }
      ];
    }
    
    // Agregar cursor para paginación si existe
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }
    
    // Ejecutar query con límite
    const comentarios = await Comment.find(query)
      .populate("userId", "name profileImage role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) + 1); // +1 para saber si hay más
    
    // Determinar si hay más comentarios
    const hasMore = comentarios.length > parseInt(limit);
    const comentariosToSend = hasMore ? comentarios.slice(0, -1) : comentarios;
    
    // Si estamos buscando comentarios por parentId (paginación de respuestas)
    if (parentId) {
      const nextCursor = hasMore ? comentariosToSend[comentariosToSend.length - 1].createdAt.toISOString() : null;
      return res.json({
        comments: comentariosToSend,
        nextCursor,
        hasMore
      });
    }
    
    // Para comentarios raíz, construir árbol completo (sin paginar las respuestas internas)
    const allComments = await Comment.find({ noticia: newsId })
      .populate("userId", "name profileImage role")
      .sort({ createdAt: 1 });
    
    const map = {};
    const raiz = [];

    // Mapear todos los comentarios
    allComments.forEach((c) => {
      const comment = c.toObject();
      // Normalizar campos para compatibilidad
      comment.parentId = comment.parentId || comment.padre;
      comment.contenido = comment.contenido || comment.texto;
      map[c._id] = { ...comment, respuestas: [] };
    });

    // Construir árbol
    allComments.forEach((c) => {
      const parentId = c.parentId || c.padre;
      if (parentId && map[parentId]) {
        map[parentId].respuestas.push(map[c._id]);
      } else if (!parentId) {
        raiz.push(map[c._id]);
      }
    });

    res.json(raiz);
  } catch (err) {
    console.error("❌ Error al obtener comentarios:", err);
    res.status(500).json({ error: "Error al obtener comentarios" });
  }
});

// ✅ Crear comentario o respuesta
router.post("/:newsId", verifyToken, async (req, res) => {
  try {
    const newsId = req.params.newsId;
    const noticia = await News.findById(newsId);
    if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });

    // Obtener contenido del comentario (soporta ambos nombres de campo)
    const contenido = req.body.contenido || req.body.texto;
    const parentId = req.body.parentId || req.body.padre;
    
    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ error: "Contenido del comentario requerido" });
    }

    // Obtener userId del token
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      console.error('[COMMENTS] No userId in token');
      return res.status(401).json({ error: "Usuario no autenticado correctamente" });
    }

    // Resolver el displayName del usuario
    const displayName = await resolveDisplayNameFromReq(req);
    
    if (!displayName) {
      console.error('[COMMENTS] Could not resolve displayName');
      return res.status(401).json({ 
        error: "No se pudo resolver el usuario desde el token. Verifica verifyToken y el modelo User." 
      });
    }

    // Log de depuración
    console.log('[COMMENTS]', { 
      userId, 
      displayName, 
      route: req.originalUrl,
      newsId,
      parentId: parentId || 'none',
      contentLength: contenido.length
    });

    // Crear el comentario con todos los campos necesarios
    const nuevoComentario = new Comment({
      noticia: newsId,
      contenido: contenido.trim(),
      texto: contenido.trim(), // Mantener compatibilidad
      usuario: displayName,     // String con el nombre visible
      userId: userId,          // ObjectId del usuario
      parentId: parentId || null,
      padre: parentId || null  // Mantener compatibilidad
    });

    const guardado = await nuevoComentario.save();

    // Si es una respuesta, actualizar el comentario padre
    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, {
        $push: { respuestas: guardado._id },
      });
    }

    // Poblar datos del usuario para la respuesta
    const comentarioCompleto = await Comment.findById(guardado._id)
      .populate("userId", "name profileImage role");
    
    res.status(201).json(comentarioCompleto);
  } catch (err) {
    console.error("❌ Error al comentar:", err);
    res.status(500).json({ 
      error: "Error al comentar",
      message: err.message 
    });
  }
});

// ✅ Eliminar comentario (principal o respuesta anidada)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const comentario = await Comment.findById(commentId);
    if (!comentario) return res.status(404).json({ error: "Comentario no encontrado" });
    
    // Verificar permisos: solo admin o el autor del comentario
    const userId = req.user.sub || req.user.id;
    const isOwner = comentario.userId && comentario.userId.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'editor';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "No tienes permisos para eliminar este comentario" });
    }

    // Función recursiva para eliminar un comentario y todas sus respuestas
    const eliminarRecursivo = async (id) => {
      const com = await Comment.findById(id);
      if (!com) return;
      
      // Eliminar todas las respuestas de este comentario recursivamente
      if (com.respuestas && com.respuestas.length > 0) {
        for (const respuestaId of com.respuestas) {
          await eliminarRecursivo(respuestaId);
        }
      }
      
      // Eliminar el comentario actual
      await Comment.findByIdAndDelete(id);
    };

    if (comentario.padre === null) {
      // ✅ Es un comentario principal - conservar respuestas como comentarios principales
      await Comment.updateMany({ padre: commentId }, { $set: { padre: null } });
      await Comment.findByIdAndDelete(commentId);
      res.json({ mensaje: "✅ Comentario principal eliminado (respuestas conservadas como principales)" });
    } else {
      // ✅ Es una respuesta anidada - eliminar completamente (incluye sub-respuestas)
      
      // Remover referencia del array 'respuestas' del comentario padre
      await Comment.findByIdAndUpdate(comentario.padre, {
        $pull: { respuestas: commentId }
      });
      
      // Eliminar el comentario y todas sus sub-respuestas recursivamente
      await eliminarRecursivo(commentId);
      
      res.json({ mensaje: "✅ Respuesta eliminada correctamente (incluye sub-respuestas)" });
    }
  } catch (err) {
    console.error("❌ Error al eliminar comentario:", err);
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});

module.exports = router;
