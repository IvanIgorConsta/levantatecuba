const express = require("express");
const router = express.Router();
const News = require("../models/News");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { buildFacebookCandidatesFilter, isNewsAFacebookCandidate } = require("../redactor_ia/services/facebookAutoPublisher");

// 📦 Multer para imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/news";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por imagen
    files: 3 // Máximo 3 imágenes por noticia
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error("❌ Tipo de archivo rechazado:", file.mimetype);
      cb(new Error("❌ Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, WEBP, AVIF"), false);
    }
  },
});

// ✅ Obtener todas las noticias con paginación, filtro por categoría y fechas
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const categoria = req.query.categoria;
    const desde = req.query.desde ? new Date(req.query.desde) : null;
    const hasta = req.query.hasta ? new Date(req.query.hasta) : null;
    const includeScheduled = req.query.includeScheduled === "1";
    const status = req.query.status;
    const fbStatus = req.query.fbStatus; // Nuevo parámetro para filtro de Facebook
    
    console.log("🔍 [DEBUG Backend] Query params:", {
      status,
      fbStatus,
      includeScheduled,
      page,
      limit,
      categoria
    });

    const query = {};

    if (categoria && categoria !== "Todas") {
      query.categoria = categoria;
    }

    if (desde && hasta) {
      query.createdAt = { $gte: desde, $lte: hasta };
    }

    // Construir statusFilter basado en los parámetros recibidos
    let statusFilter = {};
    let applyFreshnessFilter = false; // Flag para aplicar filtro de frescura después
    
    // Filtro especial para FB pendientes - usar la misma lógica que el scheduler automático
    if (fbStatus === "pending") {
      console.log("🔍 [DEBUG Backend] Aplicando filtro FB pendientes (con filtros de frescura)");
      // Usamos buildFacebookCandidatesFilter() como base, pero luego filtraremos con isNewsAFacebookCandidate()
      // que incluye las reglas de frescura por categoría
      statusFilter = buildFacebookCandidatesFilter();
      applyFreshnessFilter = true; // Activar filtro post-query
    }
    // Si se especifica un status explícito (como "scheduled" o "published")
    else if (status) {
      console.log("🔍 [DEBUG Backend] Using explicit status filter:", status);
      
      // Verificar permisos para status=scheduled
      if (status === "scheduled" && req.headers.authorization) {
        try {
          const jwt = require("jsonwebtoken");
          const token = req.headers.authorization.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const User = require("../models/User");
          const user = await User.findById(decoded.id);
          
          if (user && (user.role === "admin" || user.role === "editor")) {
            statusFilter = { status: "scheduled" };
          } else {
            // Sin permisos para ver programadas, devolver lista vacía
            statusFilter = { _id: { $exists: false } };
          }
        } catch (err) {
          // Token inválido, devolver lista vacía para status=scheduled
          statusFilter = { _id: { $exists: false } };
        }
      } else if (status === "published") {
        statusFilter = {
          $or: [
            { status: "published" },
            { status: { $exists: false } }
          ]
        };
      }
    } else {
      // Comportamiento original: status no especificado
      statusFilter = {
        $or: [
          { status: "published" },
          { status: { $exists: false } }
        ]
      };

      // Si includeScheduled=1 y es admin, incluir también programadas
      if (includeScheduled && req.headers.authorization) {
        try {
          const jwt = require("jsonwebtoken");
          const token = req.headers.authorization.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const User = require("../models/User");
          const user = await User.findById(decoded.id);
          
          if (user && (user.role === "admin" || user.role === "editor")) {
            statusFilter = {
              $or: [
                { status: "published" },
                { status: "scheduled" },
                { status: { $exists: false } }
              ]
            };
          }
        } catch (err) {
          // Token inválido: mantener statusFilter por defecto
        }
      }
    }

    // Unir statusFilter con query existente
    Object.assign(query, statusFilter);
    
    console.log("🔍 [DEBUG Backend] Final query:", JSON.stringify(query, null, 2));

    let total = await News.countDocuments(query);
    let noticias = await News.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Si se solicitó FB pendientes, aplicar filtro de frescura post-query
    if (applyFreshnessFilter) {
      console.log("🔍 [DEBUG Backend] Aplicando filtro de frescura a", noticias.length, "noticias");
      noticias = noticias.filter(noticia => {
        const newsObj = noticia.toObject ? noticia.toObject() : noticia;
        return isNewsAFacebookCandidate(newsObj);
      });
      console.log("🔍 [DEBUG Backend] Después de filtro de frescura:", noticias.length, "noticias");
      
      // Recalcular total para FB pendientes con filtro de frescura
      const allCandidates = await News.find(query).select('_id status publishedToFacebook facebook_status publishedAt categoria isEvergreen').lean();
      total = allCandidates.filter(news => isNewsAFacebookCandidate(news)).length;
      console.log("🔍 [DEBUG Backend] Total real de FB pendientes:", total);
    }

    // Agregar campo isFacebookCandidate a cada noticia
    // Esto permite que el frontend sepa exactamente cuáles son candidatos reales
    // IMPORTANTE: Usa isNewsAFacebookCandidate() que incluye filtros de frescura
    const noticiasWithCandidate = noticias.map(noticia => {
      const newsObj = noticia.toObject ? noticia.toObject() : noticia;
      const isCandidate = isNewsAFacebookCandidate(newsObj);
      return {
        ...newsObj,
        isFacebookCandidate: isCandidate
      };
    });

    // Calcular contadores globales para todas las pestañas (solo si es admin)
    let totalsByStatus = null;
    if (req.headers.authorization) {
      try {
        const jwt = require("jsonwebtoken");
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require("../models/User");
        const user = await User.findById(decoded.id);
        
        if (user && (user.role === "admin" || user.role === "editor")) {
          // Construir query base sin filtro de estado
          const baseQuery = {};
          if (categoria && categoria !== "Todas") {
            baseQuery.categoria = categoria;
          }
          if (desde && hasta) {
            baseQuery.createdAt = { $gte: desde, $lte: hasta };
          }

          // Contar por cada estado
          const [publishedCount, scheduledCount] = await Promise.all([
            News.countDocuments({
              ...baseQuery,
              $or: [
                { status: "published" },
                { status: { $exists: false } }
              ]
            }),
            News.countDocuments({
              ...baseQuery,
              status: "scheduled"
            })
          ]);
          
          // FB pendientes: DEBE incluir filtros de frescura (igual que scheduler)
          // No podemos usar countDocuments porque los filtros de fecha son dinámicos por categoría
          // Debemos obtener todas las noticias published y filtrar con isNewsAFacebookCandidate()
          const allPublishedNews = await News.find({
            ...baseQuery,
            status: "published"
          }).select('_id status publishedToFacebook facebook_status publishedAt categoria isEvergreen').lean();
          
          const fbPendingCount = allPublishedNews.filter(news => isNewsAFacebookCandidate(news)).length;

          totalsByStatus = {
            all: publishedCount + scheduledCount,
            published: publishedCount,
            scheduled: scheduledCount,
            fbPending: fbPendingCount
          };
        }
      } catch (err) {
        // Token inválido: no enviar totalsByStatus
      }
    }

    res.json({ 
      noticias: noticiasWithCandidate, // Enviar con campo isFacebookCandidate
      total,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      ...(totalsByStatus && { totalsByStatus }),
      // Info de debug para verificar coherencia
      ...(fbStatus === "pending" && { 
        debug: {
          beforeFreshnessFilter: await News.countDocuments(query),
          afterFreshnessFilter: total
        }
      })
    });
  } catch (err) {
    console.error("❌ Error en paginación:", err);
    console.error("❌ Stack:", err.stack);
    res.status(500).json({ error: "Error al obtener noticias", details: err.message });
  }
});

// ✅ Servir robots.txt para SEO y motores de búsqueda (ANTES de /:id para evitar conflictos)
router.get("/robots.txt", (req, res) => {
  const robotsTxt = `User-agent: *
Disallow:

# Sitemap
Sitemap: https://levantatecuba.com/api/news/sitemap.xml

# Crawl-delay para bots pesados
User-agent: Googlebot
Crawl-delay: 1

User-agent: Bingbot
Crawl-delay: 1`;

  res.header("Content-Type", "text/plain");
  res.send(robotsTxt);
});

// ✅ Generar sitemap.xml dinámico para SEO (ANTES de /:id para evitar conflictos)
router.get("/sitemap.xml", async (req, res) => {
  try {
    // Obtener solo noticias publicadas para el sitemap
    const noticias = await News.find({
      $or: [
        { status: "published" },
        { status: { $exists: false } } // Compatibilidad con noticias antiguas
      ]
    }).sort({ updatedAt: -1 });
    
    // Generar URLs de las noticias
    const urls = noticias.map((n) => {
      return `
        <url>
          <loc>https://levantatecuba.com/noticias/${n.slug || n._id}</loc>
          <lastmod>${new Date(n.updatedAt || n.createdAt).toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>`;
    }).join("");

    // Crear el sitemap completo
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://levantatecuba.com/</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>
        <url>
          <loc>https://levantatecuba.com/noticias</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.9</priority>
        </url>
        <url>
          <loc>https://levantatecuba.com/denuncias</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
        ${urls}
      </urlset>`;

    // Enviar como XML
    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (err) {
    console.error("❌ Error al generar sitemap:", err);
    res.status(500).send("Error al generar sitemap");
  }
});

// ✅ Obtener noticia individual (acepta slug o ID)
router.get("/:slugOrId", async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const noticia = await News.findBySlugOrId(slugOrId);
    if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
    
    // Si la noticia está programada, solo admins pueden verla
    if (noticia.status === "scheduled") {
      const isAdmin = req.headers.authorization;
      
      if (!isAdmin) {
        return res.status(404).json({ error: "Noticia no encontrada" });
      }
      
      try {
        const jwt = require("jsonwebtoken");
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require("../models/User");
        const user = await User.findById(decoded.id);
        
        if (!user || (user.role !== "admin" && user.role !== "editor")) {
          return res.status(404).json({ error: "Noticia no encontrada" });
        }
      } catch (err) {
        return res.status(404).json({ error: "Noticia no encontrada" });
      }
    }
    
    // Agregar campo isFacebookCandidate (para consistencia con el listado)
    const newsObj = noticia.toObject ? noticia.toObject() : noticia;
    const noticeWithCandidate = {
      ...newsObj,
      isFacebookCandidate: isNewsAFacebookCandidate(newsObj)
    };
    
    res.json(noticeWithCandidate);
  } catch {
    res.status(500).json({ error: "Error al obtener noticia" });
  }
});

// ✅ Noticias relacionadas
router.get("/:id/relacionadas", async (req, res) => {
  try {
    const noticia = await News.findById(req.params.id);
    if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });

    const relacionadas = await News.find({
      _id: { $ne: noticia._id },
      categoria: noticia.categoria,
      $or: [
        { status: "published" },
        { status: { $exists: false } } // Compatibilidad con noticias antiguas
      ]
    })
    .select('titulo cover coverHash coverKind imagen imagenes hash kind createdAt categoria')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json(relacionadas);
  } catch {
    res.status(500).json({ error: "Error al obtener relacionadas" });
  }
});

// ✅ Crear noticia con imagen principal y opcional
router.post(
  "/",
  verifyToken,
  verifyRole(["admin", "editor"]),
  upload.fields([
    { name: "imagen", maxCount: 1 },
    { name: "imagenOpcional", maxCount: 1 },
  ]),
  [
    body("titulo").trim().notEmpty().withMessage("Título es obligatorio"),
    body("contenido").trim().notEmpty().withMessage("Contenido es obligatorio"),
    body("categoria").optional().isIn(["General", "Política", "Economía", "Internacional", "Socio político", "Tecnología", "Tendencia", "Deporte"]).withMessage("Categoría no válida"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
    }
    try {
      const { titulo, contenido, categoria, destacada, status, publishAt, autor: autorFromForm } = req.body;

      // Usar autor del formulario si viene, sino calcular desde JWT
      let autor = autorFromForm?.trim() || "";
      if (!autor) {
        const user = await User.findById(req.user.id);
        if (user) autor = user.nickname || `${user.firstName || ""} ${user.lastName || ""}`.trim();
      }
      if (!autor) autor = "Anónimo";

      const imagen = req.files?.imagen?.[0]?.filename
        ? `/uploads/news/${req.files.imagen[0].filename}`
        : "";
      const imagenOpcional = req.files?.imagenOpcional?.[0]?.filename
        ? `/uploads/news/${req.files.imagenOpcional[0].filename}`
        : "";

      // Lógica de publicación programada
      let noticiaStatus = "published";
      let noticiaPublishAt = null;
      let noticiaPublishedAt = new Date();

      if (status === "scheduled" && publishAt) {
        const publishDate = new Date(publishAt);
        const now = new Date();
        
        // Si la fecha es válida y está en el futuro, programar
        if (publishDate instanceof Date && !isNaN(publishDate) && publishDate > now) {
          noticiaStatus = "scheduled";
          noticiaPublishAt = publishDate;
          noticiaPublishedAt = null;
        }
        // Si la fecha es inválida o pasada, publicar ahora (no romper UX)
      }

      const noticia = new News({
        titulo,
        contenido,
        autor,
        categoria: categoria || "General",
        destacada: destacada === "true" || destacada === true,
        imagen,
        imagenOpcional,
        status: noticiaStatus,
        publishAt: noticiaPublishAt,
        publishedAt: noticiaPublishedAt,
      });

      const guardada = await noticia.save();
      res.status(201).json(guardada);
    } catch (err) {
      console.error("❌ Error al guardar noticia:", err);
      res.status(500).json({ error: "Error al guardar noticia" });
    }
  }
);


// ✅ Actualizar noticia (imagen principal solo se reemplaza, opcional se puede borrar)
router.put(
  "/:id",
  verifyToken,
  verifyRole(["admin", "editor"]),
  upload.fields([
    { name: "imagen", maxCount: 1 },
    { name: "imagenOpcional", maxCount: 1 },
  ]),
  [
    body("titulo").trim().notEmpty().withMessage("Título es obligatorio"),
    body("contenido").trim().notEmpty().withMessage("Contenido es obligatorio"),
    body("categoria").optional().isIn(["General", "Política", "Economía", "Internacional", "Socio político", "Tecnología", "Tendencia", "Deporte"]).withMessage("Categoría no válida"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Datos inválidos", details: errors.array() });

    try {
      const noticia = await News.findById(req.params.id);
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });

      const { titulo, contenido, categoria, destacada, status, publishAt, autor: autorFromForm } = req.body;
      const eliminarImagenOpcional = typeof req.body.imagenOpcional === "string" && req.body.imagenOpcional.trim() === "";

      // Actualizar autor si viene del formulario
      if (autorFromForm?.trim()) {
        noticia.autor = autorFromForm.trim();
      }

      // Imagen principal solo se reemplaza
      if (req.files?.imagen?.[0]) {
        noticia.imagen = `/uploads/news/${req.files.imagen[0].filename}`;
      }

      // Imagen opcional: eliminar o reemplazar
      if (eliminarImagenOpcional && noticia.imagenOpcional) {
        const ruta = path.join(__dirname, "..", noticia.imagenOpcional);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        noticia.imagenOpcional = undefined;
      } else if (req.files?.imagenOpcional?.[0]) {
        noticia.imagenOpcional = `/uploads/news/${req.files.imagenOpcional[0].filename}`;
      } else if (req.body.imagenOpcional) {
        noticia.imagenOpcional = req.body.imagenOpcional;
      }

      // Lógica de publicación programada
      if (status === "scheduled" && publishAt) {
        const publishDate = new Date(publishAt);
        const now = new Date();
        
        // Si la fecha es válida y está en el futuro, programar
        if (publishDate instanceof Date && !isNaN(publishDate) && publishDate > now) {
          noticia.status = "scheduled";
          noticia.publishAt = publishDate;
          noticia.publishedAt = null;
        } else {
          // Si la fecha es inválida o pasada, publicar ahora
          noticia.status = "published";
          noticia.publishAt = null;
          noticia.publishedAt = new Date();
        }
      } else {
        // Si no se especifica programación, publicar ahora
        noticia.status = "published";
        noticia.publishAt = null;
        noticia.publishedAt = noticia.publishedAt || new Date();
      }

      noticia.titulo = titulo;
      noticia.contenido = contenido;
      noticia.categoria = categoria || noticia.categoria;
      noticia.destacada = destacada === "true" || destacada === true;

      await noticia.save();
      res.json(noticia);
    } catch (err) {
      console.error("❌ Error al actualizar noticia:", err);
      res.status(500).json({ error: "Error al actualizar noticia" });
    }
  }
);

// Los endpoints de compartir se movieron a /api/social/facebook/share
// Las rutas antiguas se eliminaron para evitar confusión

// ✅ Eliminar noticia
router.delete("/:id", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const eliminada = await News.findByIdAndDelete(req.params.id);
    if (!eliminada) return res.status(404).json({ error: "Noticia no encontrada" });
    res.json({ mensaje: "✅ Noticia eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

module.exports = router;
