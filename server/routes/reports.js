// ✅ Archivo actualizado con soporte para múltiples archivos adjuntos
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { upload, handleMulterError, getFileType, cleanupFiles } = require("../middleware/uploadReports");

const Report = require("../models/Report");

// Funciones auxiliares para comentarios
function findCommentById(commentsArray, id) {
  if (!Array.isArray(commentsArray)) return null;
  for (const comment of commentsArray) {
    if (comment?._id?.toString() === id) return comment;
    if (Array.isArray(comment.respuestas)) {
      const found = findCommentById(comment.respuestas, id);
      if (found) return found;
    }
  }
  return null;
}

function deleteCommentById(commentsArray, id) {
  return commentsArray.filter((comment) => {
    if (!comment?._id) return true;
    if (comment._id.toString() === id) return false;
    if (Array.isArray(comment.respuestas)) {
      comment.respuestas = deleteCommentById(comment.respuestas, id);
    }
    return true;
  });
}

// GET públicas con paginación opcional
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0; // 0 = sin límite
    const skip = limit > 0 ? (page - 1) * limit : 0;
    
    const query = { aprobada: true };
    const total = await Report.countDocuments(query);
    
    let denunciasQuery = Report.find(query).sort({ destacada: -1, createdAt: -1 });
    
    if (limit > 0) {
      denunciasQuery = denunciasQuery.skip(skip).limit(limit);
    }
    
    const denuncias = await denunciasQuery.lean();
    
    res.json({
      denuncias,
      pagination: limit > 0 ? {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      } : null
    });
  } catch (err) {
    console.error('Error en GET /:', err);
    res.status(500).json({ error: "Error al obtener denuncias públicas" });
  }
});

// 🆕 Obtener solo los comentarios de una denuncia
router.get("/:id/comentarios", async (req, res) => {
  try {
    const denuncia = await Report.findById(req.params.id).select("comentarios");
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });
    res.json(denuncia.comentarios);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los comentarios" });
  }
});

// Admin con paginación y filtros mejorados
router.get("/admin", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Nuevos filtros
    const { estado, fechaDesde, fechaHasta, buscar } = req.query;
    
    // Construir query dinámico
    const query = {};
    
    // Filtro por estado
    if (estado === 'pendientes') {
      query.aprobada = false;
    } else if (estado === 'aprobadas') {
      query.aprobada = true;
    } else if (estado === 'destacadas') {
      query.destacada = true;
    }
    
    // Filtro por rango de fechas
    if (fechaDesde || fechaHasta) {
      query.createdAt = {};
      if (fechaDesde) query.createdAt.$gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        query.createdAt.$lte = hasta;
      }
    }
    
    // Búsqueda por texto
    if (buscar) {
      query.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { contenido: { $regex: buscar, $options: 'i' } }
      ];
    }

    const total = await Report.countDocuments(query);
    const denuncias = await Report.find(query)
      .sort({ destacada: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Estadísticas adicionales
    const stats = {
      total,
      pendientes: await Report.countDocuments({ aprobada: false }),
      aprobadas: await Report.countDocuments({ aprobada: true }),
      destacadas: await Report.countDocuments({ destacada: true })
    };

    res.json({ 
      denuncias, 
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      },
      stats 
    });
  } catch (err) {
    console.error('Error en /admin:', err);
    res.status(500).json({ error: "Error al obtener denuncias admin" });
  }
});

// Aprobar
router.patch("/aprobar/:id", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const denuncia = await Report.findByIdAndUpdate(req.params.id, { aprobada: true }, { new: true });
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });
    res.json(denuncia);
  } catch (err) {
    res.status(500).json({ error: "Error al aprobar la denuncia" });
  }
});

// Destacar o desmarcar
router.patch("/destacar/:id", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const denuncia = await Report.findById(req.params.id);
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });

    denuncia.destacada = !denuncia.destacada;
    await denuncia.save();

    res.json({ mensaje: "Estado de destacada actualizado", destacada: denuncia.destacada });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar destacado" });
  }
});

// Eliminar denuncia y sus archivos multimedia asociados
router.delete("/:id", verifyToken, verifyRole(["admin"]), async (req, res) => {
  try {
    const denuncia = await Report.findById(req.params.id);
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });
    
    // Eliminar archivo multimedia legacy si existe
    if (denuncia.media) {
      const filePath = path.join(__dirname, '..', denuncia.media);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Eliminar nuevos attachments si existen
    if (denuncia.attachments && denuncia.attachments.length > 0) {
      denuncia.attachments.forEach(attachment => {
        const filePath = path.join(__dirname, '..', attachment.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    await Report.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "✅ Denuncia eliminada correctamente" });
  } catch (err) {
    console.error('Error al eliminar:', err);
    res.status(500).json({ error: "Error al eliminar denuncia" });
  }
});

// 🆕 Eliminar un adjunto específico de una denuncia
router.delete("/:id/attachments/:attachmentIndex", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const { id, attachmentIndex } = req.params;
    const index = parseInt(attachmentIndex);
    
    const denuncia = await Report.findById(id);
    if (!denuncia) {
      return res.status(404).json({ error: "Denuncia no encontrada" });
    }
    
    if (!denuncia.attachments || index < 0 || index >= denuncia.attachments.length) {
      return res.status(400).json({ error: "Índice de adjunto inválido" });
    }
    
    // Obtener el attachment a eliminar
    const attachment = denuncia.attachments[index];
    
    // Eliminar archivo físico
    const filePath = path.join(__dirname, '..', attachment.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Eliminar del array de attachments
    denuncia.attachments.splice(index, 1);
    
    // Si no quedan attachments y hay un media legacy, limpiar el campo media
    if (denuncia.attachments.length === 0 && denuncia.media) {
      // Verificar si el media corresponde al archivo eliminado
      if (attachment.url === denuncia.media) {
        denuncia.media = "";
      }
    }
    
    await denuncia.save();
    
    res.json({ 
      mensaje: "✅ Adjunto eliminado correctamente",
      attachments: denuncia.attachments 
    });
  } catch (err) {
    console.error('Error al eliminar adjunto:', err);
    res.status(500).json({ error: "Error al eliminar el adjunto" });
  }
});

// Crear denuncia con múltiples archivos (🔒 Logueado)
router.post(
  "/",
  verifyToken,
  upload.array("files", 5), // Acepta hasta 5 archivos con el campo "files"
  handleMulterError,
  [
    body("nombre").optional().trim().escape().isLength({ max: 100 }).withMessage("Nombre demasiado largo"),
    body("contenido").trim().escape().isLength({ min: 3 }).withMessage("Contenido obligatorio"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Si hay errores de validación, limpiar archivos subidos
      if (req.files) cleanupFiles(req.files);
      return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
    }

    try {
      const { nombre, contenido } = req.body;
      const nombreFinal = req.user?.name || nombre || "Anónimo";
      
      // Preparar attachments con metadatos
      const attachments = [];
      let firstMediaUrl = ""; // Para mantener compatibilidad con campo 'media'
      
      if (req.files && req.files.length > 0) {
        req.files.forEach((file, index) => {
          const fileUrl = `/uploads/reports/${file.filename}`;
          
          // El primer archivo también se guarda en 'media' para compatibilidad
          if (index === 0) {
            firstMediaUrl = fileUrl;
          }
          
          attachments.push({
            url: fileUrl,
            type: getFileType(file.mimetype),
            mimeType: file.mimetype,
            size: file.size,
            originalName: file.originalname,
            uploadDate: new Date()
          });
        });
      }
      
      // Crear denuncia con attachments
      const nueva = new Report({ 
        nombre: nombreFinal, 
        contenido,
        media: firstMediaUrl, // Compatibilidad con campo legacy
        attachments,
        aprobada: false 
      });
      
      await nueva.save();
      res.status(201).json(nueva);
      
    } catch (err) {
      console.error('Error al crear denuncia:', err);
      // En caso de error, limpiar archivos subidos
      if (req.files) cleanupFiles(req.files);
      res.status(500).json({ error: "Error al guardar la denuncia" });
    }
  }
);

// Comentar (🔒 Logueado, admin o editor)
router.post(
  "/:id/comentarios",
  verifyToken,
  [body("mensaje").trim().escape().isLength({ min: 1 }).withMessage("Comentario vacío")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Datos inválidos", details: errors.array() });

    try {
      const { mensaje } = req.body;
      const { name = "Anónimo" } = req.user;
      const denuncia = await Report.findById(req.params.id);
      if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });

      const nuevoComentario = {
        _id: new mongoose.Types.ObjectId(),
        usuario: name,
        mensaje,
        fecha: new Date(),
        respuestas: [],
      };

      denuncia.comentarios.push(nuevoComentario);
      denuncia.markModified("comentarios");
      await denuncia.save();

      res.status(201).json({ mensaje: "Comentario agregado", comentario: nuevoComentario });
    } catch (err) {
      res.status(500).json({ error: "Error al agregar comentario" });
    }
  }
);

// Responder comentario (🔒 Logueado, admin o editor)
router.post(
  "/:reportId/comentarios/:comentarioId/responder",
  verifyToken,
  [body("mensaje").trim().escape().isLength({ min: 1 }).withMessage("Respuesta vacía")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Datos inválidos", details: errors.array() });

    try {
      const { mensaje } = req.body;
      const { name = "Anónimo" } = req.user;
      const { reportId, comentarioId } = req.params;

      const denuncia = await Report.findById(reportId);
      if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });

      const comentario = findCommentById(denuncia.comentarios, comentarioId);
      if (!comentario) return res.status(404).json({ error: "Comentario no encontrado" });

      comentario.respuestas.push({
        _id: new mongoose.Types.ObjectId(),
        usuario: name,
        mensaje,
        fecha: new Date(),
        respuestas: [],
      });

      denuncia.markModified("comentarios");
      await denuncia.save();
      res.status(201).json({ mensaje: "Respuesta agregada correctamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al responder comentario" });
    }
  }
);

// Eliminar comentarios (admin)
router.delete("/:reportId/comentarios/:comentarioId", verifyToken, verifyRole(["admin"]), async (req, res) => {
  try {
    const { reportId, comentarioId } = req.params;
    const denuncia = await Report.findById(reportId);
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });

    denuncia.comentarios = deleteCommentById(denuncia.comentarios, comentarioId);
    denuncia.markModified("comentarios");
    await denuncia.save();
    res.status(200).json({ mensaje: "Comentario o respuesta eliminada correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});

// Likes con IP
router.post("/:id/like", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.get("User-Agent") || "unknown";
  const deviceKey = `${ip}_${userAgent}`;

  try {
    const denuncia = await Report.findById(req.params.id);
    if (!denuncia) return res.status(404).json({ error: "Denuncia no encontrada" });

    const index = denuncia.likesIPs.indexOf(deviceKey);
    if (index === -1) {
      denuncia.likes += 1;
      denuncia.likesIPs.push(deviceKey);
    } else {
      denuncia.likes = Math.max(0, denuncia.likes - 1);
      denuncia.likesIPs.splice(index, 1);
    }

    await denuncia.save();
    res.status(200).json({ likes: denuncia.likes });
  } catch (err) {
    res.status(500).json({ error: "Error actualizando likes" });
  }
});

module.exports = router;