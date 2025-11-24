const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");

// Util: arma árbol desde lista plana usando Map con claves string
function buildTreeFlat(items) {
  const byId = new Map();
  items.forEach((c) => byId.set(String(c._id), { ...c, respuestas: [] }));

  const roots = [];
  byId.forEach((node) => {
    const pid = node.parentId ? String(node.parentId) : null;
    if (pid && byId.has(pid)) {
      byId.get(pid).respuestas.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// GET /api/admin/news/:newsId/comments
// Lista TODOS los comentarios (raíz + respuestas) en árbol
router.get(
  "/news/:newsId/comments",
  verifyToken,
  verifyRole(["admin", "editor"]),
  async (req, res) => {
    try {
      const { newsId } = req.params;

      const docs = await Comment.find({ noticia: newsId })
        .select("_id noticia userId usuario contenido parentId createdAt updatedAt deletedAt")
        .sort({ createdAt: 1 })
        .lean();

      return res.json({
        total: docs.length,
        comentarios: buildTreeFlat(docs),
      });
    } catch (err) {
      console.error("Error al obtener comentarios admin:", err);
      res.status(500).json({ error: "Error al obtener comentarios" });
    }
  }
);

// DELETE /api/admin/comments/:id
// Soft delete (preserva árbol)
router.delete(
  "/comments/:id",
  verifyToken,
  verifyRole(["admin", "editor"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const doc = await Comment.findById(id).select("_id");
      if (!doc) return res.status(404).json({ error: "Comentario no encontrado" });

      await Comment.findByIdAndUpdate(
        id,
        {
          contenido: "[Comentario eliminado por moderación]",
          deletedAt: new Date(),
          deletedBy: req.user?.sub || req.user?.id || null,
        },
        { new: true }
      );

      return res.json({ success: true, softDelete: true });
    } catch (err) {
      console.error("Error al eliminar comentario (soft):", err);
      res.status(500).json({ error: "Error al eliminar comentario" });
    }
  }
);

// DELETE /api/admin/comments/:id/hard
// Hard delete en cascada (elimina hijos por parentId)
async function deleteCascade(commentId) {
  const children = await Comment.find({ parentId: commentId }).select("_id").lean();
  for (const ch of children) {
    await deleteCascade(ch._id);
  }
  await Comment.findByIdAndDelete(commentId);
}

router.delete(
  "/comments/:id/hard",
  verifyToken,
  verifyRole(["admin"]),
  async (req, res) => {
    try {
      await deleteCascade(req.params.id);
      return res.json({ success: true, hardDelete: true });
    } catch (err) {
      console.error("Error al eliminar comentario (hard):", err);
      res.status(500).json({ error: "Error al eliminar comentario" });
    }
  }
);

// GET /api/admin/comments/stats
router.get(
  "/comments/stats",
  verifyToken,
  verifyRole(["admin", "editor"]),
  async (_req, res) => {
    try {
      const total = await Comment.countDocuments();
      const deleted = await Comment.countDocuments({ deletedAt: { $exists: true } });
      return res.json({ total, active: total - deleted, deleted });
    } catch (err) {
      console.error("Error al obtener stats:", err);
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  }
);

module.exports = router;
