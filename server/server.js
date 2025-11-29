// server/index.js  (o app.js)
const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const connectDB = require("./config/db");
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');

// Variables de entorno con fallbacks
process.env.PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';

// Handlers globales de errores no capturados (evitar caídas del proceso)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  UNHANDLED REJECTION detectado:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  // NO hacer process.exit() - dejar que PM2 maneje el proceso
});

process.on('uncaughtException', (err) => {
  console.error('⚠️  UNCAUGHT EXCEPTION detectado:');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  // NO hacer process.exit() - dejar que PM2 maneje el proceso
});

// 2) Conectar a MongoDB
connectDB();

// 2.1) Inicializar directorio de almacenamiento para Redactor IA
const { ensureDir } = require("./redactor_ia/services/mediaStore");
ensureDir();

// 3) Inicializar scheduler de publicaciones programadas
const { startPublishScheduler } = require("./jobs/publishScheduler");
startPublishScheduler();

// 3.1) Inicializar scheduler de borradores IA programados
const { startDraftPublishScheduler } = require("./jobs/draftPublishScheduler");
startDraftPublishScheduler();

// 3.2) Inicializar scheduler del Redactor IA
const { startScheduler: startAiScheduler, startFacebookScheduler } = require("./redactor_ia/utils/scheduler");
setTimeout(() => {
  startAiScheduler().then(() => {
    console.log('✅ Redactor IA scheduler iniciado');
  }).catch(err => {
    console.error('❌ Error al iniciar Redactor IA scheduler:', err);
  });
  
  // Iniciar scheduler de Facebook
  startFacebookScheduler();
}, 2000); // Esperar 2 segundos para que DB esté lista

const app = express();

// 4) Seguridad: Helmet - Headers HTTP seguros
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // React necesita unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 4.1) Compresión Gzip/Brotli
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6 // Balance entre velocidad y compresión
}));

// 4.2) Inicializar Passport OAuth
const { initializePassport } = require("./config/passport");
initializePassport();

// 5) CORS con configuración limpia (dominio + IP + dev)
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
const devOriginsEnv = process.env.DEV_ORIGINS || '';
const extraOrigins = devOriginsEnv
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Lista base de orígenes permitidos
const baseOrigins = [
  // Dominio principal (por si algún día cambia PUBLIC_ORIGIN)
  publicOrigin,

  // Dominio LevántateCuba explícito
  'https://levantatecuba.com',
  'http://levantatecuba.com',

  // IP pública del servidor (tu acceso directo)
  'http://72.61.64.1',
  'https://72.61.64.1',

  // Desarrollo local
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

// Crear Set final de orígenes permitidos
const allowList = new Set(
  [...baseOrigins, ...extraOrigins].filter(Boolean)
);

// Trust proxy si estamos en producción (para cookies seguras)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (curl, SSR, Postman, apps móviles, healthchecks)
    if (!origin) {
      return callback(null, true);
    }

    // Verificar si está en la lista de orígenes permitidos
    if (allowList.has(origin)) {
      return callback(null, true);
    }

    // Origen no permitido - log y rechazar
    console.warn(`[CORS] Origen bloqueado: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Permitir credenciales (cookies, JWT con withCredentials)
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight por 24 horas
};

// Aplicar CORS middleware ANTES de cualquier ruta
app.use(cors(corsOptions));

// Manejar preflight OPTIONS para todas las rutas
app.use(function (req, res, next) {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  next();
});

// 6) Parsers y middlewares
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Para leer cookies

// 6.1) Sanitización MongoDB - Protección contra inyección NoSQL
// Middleware personalizado para evitar conflicto con req.query read-only
app.use((req, res, next) => {
  // Sanitizar solo body y params (no query que puede ser read-only)
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  }
  // Para query, solo validar y rechazar si contiene operadores
  if (req.query && typeof req.query === 'object') {
    const hasProhibited = JSON.stringify(req.query).match(/\$|\.(?=\w+)/);
    if (hasProhibited) {
      console.warn(`[Security] ⚠️ Query params prohibidos detectados en ${req.path}`);
      return res.status(400).json({ error: 'Parámetros de consulta no válidos' });
    }
  }
  next();
});

// 7) Inicializar Passport
app.use(passport.initialize());

// 7.1) Registrar estrategia de Google (DESPUÉS de passport.initialize())
require('./auth/googleStrategy');

// 8) Rate limit específico para auth y password (protección básica)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,                  // 100 req por IP/ventana
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

// 8.1) Rate limiting global (protección contra abuso)
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por IP/minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde',
  skip: (req) => {
    // No aplicar rate limit a healthcheck
    return req.path === '/healthz';
  }
});

app.use(globalLimiter);

// 9) Rutas API (elige UNO de los dos requires de /api/password)

// ✅ OPCIÓN A: Usar tu archivo actual (NO cambia nada más)
app.use("/api/password", passwordLimiter, require("./routes/passwordRequests"));

// ✅ OPCIÓN B: Usar el nuevo flujo que te entregué (si lo añadiste como server/routes/password.js)
// app.use("/api/password", passwordLimiter, require("./routes/password"));

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/users", require("./routes/users"));       // perfil, reset, admin
app.use("/api/news", require("./routes/news"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/subscribers", require("./routes/subscribers"));
// ELIMINADO: Metrics - 09/11/2025
// app.use("/api/metrics", require("./routes/metrics"));
// DEPRECATED: Rostros eliminado el 28/01/2025 - Remover stub después del 28/04/2025
app.use("/api/rostros", require("./routes/rostros-deprecated"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/admin", require("./routes/adminComments"));
app.use("/api/tasas", require("./routes/tasas"));
app.use("/api/oauth", require("./routes/oauth")); // Rutas OAuth
app.use("/api/ai", require("./routes/aiImages")); // Rutas IA para imágenes
app.use("/api/social", require("./routes/social")); // Rutas de redes sociales
app.use("/api/donate", require("./routes/donate")); // Rutas de donaciones Stripe (legacy)
app.use("/api/stripe", require("./routes/stripe")); // Rutas de Stripe para producción
app.use("/api/tienda", require("./routes/store")); // Rutas de la tienda interna
app.use("/api/shopify", require("./routes/shopify")); // Rutas de Shopify Storefront API
app.use("/api/redactor-ia", authLimiter, require("./redactor_ia/routes/redactorIA")); // Redactor IA
app.use("/media", require("./routes/mediaRoutes")); // Servir imágenes procesadas
app.use("/og", require("./routes/og"));

// Log temporal para verificar estrategias
console.log('Strategies:', Object.keys(require('passport')._strategies));

// 10) Archivos estáticos con MIME types correctos para AVIF/WebP
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Servir directorio public con setHeaders para AVIF/WebP
app.use(
  express.static(path.join(process.cwd(), "public"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".avif")) {
        res.setHeader("Content-Type", "image/avif");
      } else if (filePath.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
      } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      }
      // Cache largo para recursos estáticos
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  })
);

// 11) Middleware para meta-tags dinámicos (antes de servir la SPA)
const { injectMetaTagsMiddleware } = require("./middleware/metaTags");
app.use(injectMetaTagsMiddleware);

// 12) Servir archivos estáticos del frontend (solo en producción)
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../dist');
  app.use(express.static(frontendPath));
  
  // Fallback para SPA - usar middleware simple en lugar de regex
  app.use(function (req, res, next) {
    // No procesar rutas API
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/og/')) {
      return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
    
    // Para cualquier otra ruta, servir el index.html del SPA
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// 13) Configurar cron para tasas de cambio
const { scrapeElToque } = require("./services/scrapeElToque");
const RateSnapshot = require("./models/RateSnapshot");

// Ejecutar cada hora en el minuto 3
cron.schedule("3 * * * *", async () => {
  try {
    console.log("🕐 Ejecutando cron de tasas de cambio...");
    const scrapedData = await scrapeElToque();
    
    // Validar datos antes de guardar
    if (!scrapedData.tasas || scrapedData.tasas.length < 3) {
      throw new Error('Cron: Datos insuficientes obtenidos');
    }
    
    const validTasas = scrapedData.tasas.filter(tasa => 
      tasa.moneda && tasa.cup && 
      tasa.cup !== "-" && tasa.cup !== "—" && tasa.cup !== "N/A"
    );
    
    if (validTasas.length < 3) {
      throw new Error(`Cron: Solo ${validTasas.length} tasas válidas con CUP (mínimo 3)`);
    }
    
    const newSnapshot = new RateSnapshot(scrapedData);
    await newSnapshot.save();
    console.log(`✅ Cron de tasas completado: ${scrapedData.tasas.length} tasas guardadas`);
  } catch (error) {
    console.error("❌ Error en cron de tasas:", error.message);
  }
});

// 14) Healthcheck
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// 15) Arranque
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server on http://0.0.0.0:${PORT}`);
  console.log(`🔒 CORS permitido para: ${Array.from(allowList).join(', ')}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
});
