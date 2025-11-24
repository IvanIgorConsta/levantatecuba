const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Asegurar que existe la carpeta de uploads/reports
const uploadPath = path.join(__dirname, "../uploads/reports");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generar nombre único y seguro
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `report-${uniqueSuffix}${ext}`;
    cb(null, safeName);
  },
});

// Filtro de archivos mejorado
const fileFilter = (req, file, cb) => {
  // Tipos MIME permitidos
  const allowedMimes = {
    // Imágenes
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    // Videos
    'video/mp4': true,
    'video/webm': true,
    'video/quicktime': true, // .mov
    'video/x-msvideo': true, // .avi (opcional)
  };

  if (allowedMimes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes (JPG, PNG, GIF, WEBP) y videos (MP4, MOV, WEBM).`), false);
  }
};

// Configuración de multer con límites
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB por archivo
    files: 5 // Máximo 5 archivos por denuncia
  },
  fileFilter
});

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: "❌ Uno o más archivos superan el límite de 15MB" 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: "❌ Máximo 5 archivos permitidos por denuncia" 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: "❌ Campo de archivo inesperado" 
      });
    }
    return res.status(400).json({ 
      error: `❌ Error al procesar archivos: ${err.message}` 
    });
  } else if (err) {
    return res.status(400).json({ 
      error: err.message || "❌ Error al procesar archivos" 
    });
  }
  next();
};

// Función helper para obtener el tipo de archivo
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'unknown';
};

// Función helper para limpiar archivos en caso de error
const cleanupFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  
  files.forEach(file => {
    const filePath = path.join(uploadPath, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
};

module.exports = {
  upload,
  handleMulterError,
  getFileType,
  cleanupFiles,
  uploadPath
};

