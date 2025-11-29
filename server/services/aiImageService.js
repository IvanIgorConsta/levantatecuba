/**
 * Servicio de Generación de Imágenes con IA
 * Maneja la lógica completa de generación, procesamiento y aceptación de imágenes
 */

const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs").promises;
const { moderateText, generate } = require("../ai/openaiAdapter");
const { buildPrompt, buildSafePrompt, toSummary } = require("../ai/promptBuilder");
const News = require("../models/News");

/**
 * Crea directorios de forma recursiva y verifica permisos de escritura
 * @param {string} dirPath - Ruta del directorio
 */
async function ensureDirectory(dirPath) {
  try {
    // Verificar si el directorio existe
    await fs.access(dirPath);
    
    // Verificar permisos de escritura
    await fs.access(dirPath, fs.constants.W_OK);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directorio no existe, intentar crearlo
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`[AI] ✅ Directorio creado: ${dirPath}`);
        
        // Verificar permisos después de crear
        await fs.access(dirPath, fs.constants.W_OK);
        
      } catch (createError) {
        const errorMsg = `No se pudo crear/escribir en ${dirPath}. Verifique permisos del proceso.`;
        console.error(`[AI] ❌ ${errorMsg}`, createError);
        
        const permissionError = new Error(errorMsg);
        permissionError.code = createError.code;
        permissionError.path = dirPath;
        throw permissionError;
      }
    } else if (error.code === 'EACCES') {
      const errorMsg = `Sin permisos de escritura en ${dirPath}. Verifique permisos del proceso.`;
      console.error(`[AI] ❌ ${errorMsg}`);
      
      const permissionError = new Error(errorMsg);
      permissionError.code = 'EACCES';
      permissionError.path = dirPath;
      throw permissionError;
    } else {
      console.error(`[AI] ❌ Error accediendo a directorio ${dirPath}:`, error);
      throw error;
    }
  }
}

/**
 * Valida que un archivo está bajo un directorio específico (seguridad)
 * @param {string} parentDir - Directorio padre
 * @param {string} filePath - Ruta del archivo a validar
 * @returns {boolean} true si el archivo está bajo el directorio
 */
function isUnderDirectory(parentDir, filePath) {
  const normalizedParent = path.resolve(parentDir);
  const normalizedFile = path.resolve(filePath);
  return normalizedFile.startsWith(normalizedParent + path.sep) || normalizedFile === normalizedParent;
}

/**
 * Valida que un tempId tiene formato válido
 * @param {string} tempId - ID temporal a validar
 * @returns {boolean} true si es válido
 */
function isValidTempId(tempId) {
  if (!tempId || typeof tempId !== 'string') return false;
  return /^[a-z0-9-]{8,}$/i.test(tempId);
}

/**
 * Recorta imagen a ratio específico usando sharp
 * @param {Buffer} buffer - Buffer de la imagen
 * @param {string} targetRatio - "16:9" o "1:1"
 * @returns {Promise<Buffer>} Buffer de la imagen recortada
 */
async function cropToRatio(buffer, targetRatio) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  console.log(`[AI] Recortando imagen ${metadata.width}x${metadata.height} a ratio ${targetRatio}`);
  
  if (targetRatio === "16:9") {
    // Para imágenes 1536x1024 generadas por OpenAI, recortar a 16:9 (1536x864)
    if (metadata.width === 1536 && metadata.height === 1024) {
      const targetWidth = 1536;
      const targetHeight = Math.round(targetWidth * 9 / 16); // 864
      const top = Math.floor((metadata.height - targetHeight) / 2); // 80
      
      console.log(`[AI] Recorte específico 1536x1024 → ${targetWidth}x${targetHeight}, top: ${top}`);
      
      return await image
        .extract({ 
          left: 0, 
          top: top, 
          width: targetWidth, 
          height: targetHeight 
        })
        .toBuffer();
    } else {
      // Fallback para otros tamaños: usar resize con ratio 16:9
      const ratio = 16 / 9;
      let targetWidth, targetHeight;
      
      if (metadata.width / metadata.height > ratio) {
        // Imagen muy ancha, recortar por ancho
        targetHeight = metadata.height;
        targetWidth = Math.round(targetHeight * ratio);
      } else {
        // Imagen muy alta, recortar por alto
        targetWidth = metadata.width;
        targetHeight = Math.round(targetWidth / ratio);
      }
      
      console.log(`[AI] Recorte genérico 16:9 → ${targetWidth}x${targetHeight}`);
      
      return await image
        .resize(targetWidth, targetHeight, {
          position: "center",
          fit: "cover"
        })
        .toBuffer();
    }
  } else if (targetRatio === "1:1") {
    // Para 1:1, usar la dimensión menor
    const minDimension = Math.min(metadata.width, metadata.height);
    
    console.log(`[AI] Recorte 1:1 → ${minDimension}x${minDimension}`);
    
    return await image
      .resize(minDimension, minDimension, {
        position: "center",
        fit: "cover"
      })
      .toBuffer();
  } else {
    throw new Error(`Ratio no soportado: ${targetRatio}`);
  }
}

/**
 * Genera pares (cover 16:9 y square 1:1) y guarda en carpeta temporal.
 * Soporta newsId o tempId (mutuamente excluyentes).
 * @param {Object} params - Parámetros de generación
 * @param {string|null} params.newsId - ID de noticia (modo persistente)
 * @param {string|null} params.tempId - ID temporal (modo scratch)
 * @param {string} params.title - Título de la noticia
 * @param {string} params.content - Contenido HTML de la noticia
 * @param {string} params.style - Estilo: "realista", "ilustracion", "infografia"
 * @param {number} params.n - Número de variantes a generar
 * @returns {Promise<{pairs: Array<{coverUrl: string, squareUrl: string}>, meta: Object}>}
 */
async function generatePairsTemporales({ newsId, tempId, title, content, style, n }) {
  console.log(`[AI] Iniciando generación para: "${title.substring(0, 50)}..."`);
  
  // Validar parámetros mutuamente excluyentes
  if (!newsId && !tempId) {
    throw new Error("Se requiere newsId o tempId");
  }
  if (newsId && tempId) {
    throw new Error("newsId y tempId son mutuamente excluyentes");
  }
  if (tempId && !isValidTempId(tempId)) {
    throw new Error("tempId inválido");
  }
  
  const workingId = newsId || tempId;
  const summary = toSummary(content);
  
  console.log(`[AI] Modo: ${newsId ? 'persistente' : 'temporal'}, ID: ${workingId}`);
  console.log(`[AI] Resumen generado: ${summary.substring(0, 100)}...`);
  
  // 1. Moderación de contenido
  const moderationText = `${title}\n${summary}`;
  const moderation = await moderateText(moderationText);
  
  let useSafePrompt = false;
  if (moderation.flagged) {
    console.log("[AI] ⚠️ Contenido flaggeado, usando prompt seguro");
    useSafePrompt = true;
  }
  
  // 2. Construir prompts
  let coverPrompt, squarePrompt;
  
  if (useSafePrompt) {
    coverPrompt = buildSafePrompt({ title }) + ", formato 16:9";
    squarePrompt = buildSafePrompt({ title }) + ", formato 1:1";
  } else {
    coverPrompt = buildPrompt({ title, summary, style, role: 'cover' });
    squarePrompt = buildPrompt({ title, summary, style, role: 'secondary' });
  }
  
  console.log(`[AI] Prompt portada: ${coverPrompt.substring(0, 100)}...`);
  console.log(`[AI] Prompt cuadrada: ${squarePrompt.substring(0, 100)}...`);
  
  // 3. Generar imágenes con IA
  const timeoutMs = parseInt(process.env.AI_IMAGE_TIMEOUT_MS) || 120000;
  
  const [coverResults, squareResults] = await Promise.all([
    generate({ prompt: coverPrompt, aspect: "16:9", n, timeoutMs }),
    generate({ prompt: squarePrompt, aspect: "1:1", n, timeoutMs })
  ]);
  
  console.log(`[AI] Generadas ${coverResults.buffers.length} portadas y ${squareResults.buffers.length} cuadradas`);
  
  // 4. Procesar imágenes (recortar si es necesario)
  const processedCovers = [];
  const processedSquares = [];
  
  console.log(`[AI] Procesando imágenes - Covers: ${coverResults.buffers.length}, needsCrop: ${coverResults.needsCrop}`);
  
  for (let i = 0; i < coverResults.buffers.length; i++) {
    try {
      let processedBuffer = coverResults.buffers[i];
      
      if (coverResults.needsCrop === "16:9") {
        console.log(`[AI] Recortando portada ${i + 1} a ratio 16:9`);
        processedBuffer = await cropToRatio(processedBuffer, "16:9");
      }
      
      // Convertir a WebP con sharp
      const webpBuffer = await sharp(processedBuffer)
        .webp({ quality: 85 })
        .toBuffer();
        
      processedCovers.push(webpBuffer);
      console.log(`[AI] ✅ Portada ${i + 1} procesada correctamente`);
      
    } catch (processError) {
      console.error(`[AI] ❌ Error procesando portada ${i + 1}:`, processError.message);
      // Continuar con las demás imágenes en lugar de fallar completamente
    }
  }
  
  console.log(`[AI] Procesando imágenes - Squares: ${squareResults.buffers.length}, needsCrop: ${squareResults.needsCrop}`);
  
  for (let i = 0; i < squareResults.buffers.length; i++) {
    try {
      let processedBuffer = squareResults.buffers[i];
      
      if (squareResults.needsCrop === "1:1") {
        console.log(`[AI] Recortando cuadrada ${i + 1} a ratio 1:1`);
        processedBuffer = await cropToRatio(processedBuffer, "1:1");
      }
      
      // Convertir a WebP con sharp
      const webpBuffer = await sharp(processedBuffer)
        .webp({ quality: 85 })
        .toBuffer();
        
      processedSquares.push(webpBuffer);
      console.log(`[AI] ✅ Cuadrada ${i + 1} procesada correctamente`);
      
    } catch (processError) {
      console.error(`[AI] ❌ Error procesando cuadrada ${i + 1}:`, processError.message);
      // Continuar con las demás imágenes en lugar de fallar completamente
    }
  }
  
  // Verificar que tenemos al menos algunas imágenes procesadas
  if (processedCovers.length === 0) {
    throw new Error("No se pudieron procesar las imágenes de portada");
  }
  if (processedSquares.length === 0) {
    throw new Error("No se pudieron procesar las imágenes cuadradas");
  }
  
  // 5. Guardar archivos temporales
  // Estructura: newsId -> /tmp/ai/{newsId}, tempId -> /tmp/ai/scratch/{tempId}
  const tmpPath = newsId 
    ? path.join(process.cwd(), "uploads", "tmp", "ai", newsId)
    : path.join(process.cwd(), "uploads", "tmp", "ai", "scratch", tempId);
  
  console.log(`[AI] Preparando directorio temporal: ${tmpPath}`);
  
  // Verificar permisos antes de proceder
  await ensureDirectory(tmpPath);
  
  const pairs = [];
  const maxPairs = Math.min(processedCovers.length, processedSquares.length);
  
  console.log(`[AI] Guardando ${maxPairs} pares de imágenes...`);
  
  for (let i = 0; i < maxPairs; i++) {
    try {
      const uuid = uuidv4();
      const coverFilename = `${uuid}-cover.webp`;
      const squareFilename = `${uuid}-square.webp`;
      
      const coverPath = path.join(tmpPath, coverFilename);
      const squarePath = path.join(tmpPath, squareFilename);
      
      // Guardar archivos con manejo de errores individual
      try {
        await fs.writeFile(coverPath, processedCovers[i]);
        console.log(`[AI] ✅ Portada ${i + 1} guardada: ${coverFilename}`);
      } catch (writeError) {
        console.error(`[AI] ❌ Error guardando portada ${i + 1}:`, writeError);
        
        const fileError = new Error(`Error guardando archivo de portada: ${writeError.message}`);
        fileError.code = writeError.code;
        fileError.path = coverPath;
        throw fileError;
      }
      
      try {
        await fs.writeFile(squarePath, processedSquares[i]);
        console.log(`[AI] ✅ Cuadrada ${i + 1} guardada: ${squareFilename}`);
      } catch (writeError) {
        console.error(`[AI] ❌ Error guardando cuadrada ${i + 1}:`, writeError);
        
        // Limpiar archivo de portada si la cuadrada falla
        try {
          await fs.unlink(coverPath);
        } catch (cleanupError) {
          console.error(`[AI] ⚠️ No se pudo limpiar portada huérfana:`, cleanupError.message);
        }
        
        const fileError = new Error(`Error guardando archivo cuadrado: ${writeError.message}`);
        fileError.code = writeError.code;
        fileError.path = squarePath;
        throw fileError;
      }
      
      const basePath = newsId 
        ? `/uploads/tmp/ai/${newsId}`
        : `/uploads/tmp/ai/scratch/${tempId}`;
      
      pairs.push({
        coverUrl: `${basePath}/${coverFilename}`,
        squareUrl: `${basePath}/${squareFilename}`
      });
      
    } catch (pairError) {
      console.error(`[AI] ❌ Error procesando par ${i + 1}:`, pairError.message);
      
      // Si es un error crítico de sistema, propagar
      if (pairError.code === 'EACCES' || pairError.code === 'ENOENT' || pairError.code === 'ENOSPC') {
        throw pairError;
      }
      
      // Para otros errores, continuar con el siguiente par
      continue;
    }
  }
  
  // Verificar que se guardó al menos un par
  if (pairs.length === 0) {
    throw new Error("No se pudo guardar ningún par de imágenes. Verifique permisos de escritura.");
  }
  
  console.log(`[AI] ✅ Guardados ${pairs.length} pares de imágenes en ${tmpPath}`);
  
  // 6. Limpiar archivos temporales antiguos (no bloquear respuesta)
  cleanupOldTmp(path.join(process.cwd(), "uploads", "tmp", "ai"))
    .catch(error => console.error("[AI] Error limpiando archivos temporales:", error.message));
  
  return {
    pairs,
    meta: { n: pairs.length, style, usedSafePrompt: useSafePrompt }
  };
}

/**
 * Genera imágenes para una noticia (función legacy - mantiene compatibilidad)
 * @param {Object} params - Parámetros de generación
 * @param {Object|null} params.news - Documento de noticia (puede ser null para preview)
 * @param {string} params.title - Título de la noticia
 * @param {string} params.content - Contenido HTML de la noticia
 * @param {string} params.style - Estilo: "realista", "ilustracion", "infografia"
 * @param {number} params.n - Número de variantes a generar
 * @returns {Promise<{pairs: Array<{coverUrl: string, squareUrl: string}>, meta: Object}>}
 */
async function generateForNews({ news, title, content, style, n }) {
  const newsId = news?._id?.toString() || "preview";
  return generatePairsTemporales({ newsId, tempId: null, title, content, style, n });
}

/**
 * Acepta una imagen candidata y la mueve a su ubicación final
 * @param {Object} params - Parámetros de aceptación
 * @param {string} params.newsId - ID de la noticia
 * @param {string} params.url - URL temporal de la imagen
 * @param {string} params.role - "cover" o "secondary"
 * @returns {Promise<{ok: boolean, finalUrl: string}>}
 */
async function acceptCandidate({ newsId, url, role }) {
  console.log(`[AI] Aceptando candidata: ${role} para noticia ${newsId}`);
  
  // 1. Validar que la URL apunta a archivos temporales
  const urlPattern = new RegExp(`^/uploads/tmp/ai/${newsId}/[^/]+\\.(webp|jpg|jpeg|png)$`);
  if (!urlPattern.test(url)) {
    throw new Error("URL de imagen temporal inválida");
  }
  
  // 2. Construir rutas
  const tempPath = path.join(process.cwd(), url.replace(/^\//, ""));
  const finalDir = path.join(process.cwd(), "uploads", "news", newsId);
  await ensureDirectory(finalDir);
  
  const finalFilename = role === "cover" ? "cover.webp" : "secondary.webp";
  const finalPath = path.join(finalDir, finalFilename);
  const finalUrl = `/uploads/news/${newsId}/${finalFilename}`;
  
  // 3. Verificar que el archivo temporal existe
  try {
    await fs.access(tempPath);
  } catch {
    throw new Error("Archivo temporal no encontrado");
  }
  
  // 4. Mover archivo (copiar + eliminar para seguridad)
  await fs.copyFile(tempPath, finalPath);
  await fs.unlink(tempPath);
  
  console.log(`[AI] Archivo movido de ${tempPath} a ${finalPath}`);
  
  // 5. Actualizar documento News
  const news = await News.findById(newsId);
  if (!news) {
    throw new Error("Noticia no encontrada");
  }
  
  if (role === "cover") {
    news.imagen = finalUrl;
  } else if (role === "secondary") {
    news.imagenOpcional = finalUrl;
  } else {
    throw new Error("Rol inválido, debe ser 'cover' o 'secondary'");
  }
  
  // 6. Generar alt text con IA (opcional, si hay campo)
  try {
    const altText = await generateAltText(news.titulo, news.contenido);
    
    // Intentar guardar alt text si existe el campo (fail-safe)
    if (role === "cover" && news.schema.paths.altCover) {
      news.altCover = altText;
    } else if (role === "secondary" && news.schema.paths.altSecondary) {
      news.altSecondary = altText;
    }
    // Si no hay campos alt, continuar sin error
  } catch (altError) {
    console.log("[AI] ⚠️ No se pudo generar alt text:", altError.message);
    // Continuar sin fallo
  }
  
  await news.save();
  
  console.log(`[AI] ✅ Noticia actualizada: ${role} → ${finalUrl}`);
  
  return {
    ok: true,
    finalUrl
  };
}

/**
 * Genera texto alternativo para una imagen
 * @param {string} title - Título de la noticia
 * @param {string} content - Contenido de la noticia
 * @returns {Promise<string>} Texto alternativo (≤ 140 chars)
 */
async function generateAltText(title, content) {
  try {
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    const summary = toSummary(content).substring(0, 200);
    
    const prompt = `Genera un texto alternativo (alt text) para una imagen editorial sobre: "${title}". 
    Contexto: ${summary}
    
    Requisitos:
    - Máximo 140 caracteres
    - Descriptivo y accesible
    - En español
    - Sin mencionar "imagen" o "foto"
    - Una sola frase
    
    Ejemplo: "Manifestantes en las calles de La Habana durante protesta por crisis energética"`;
    
    // Usar chat completions para generar alt text
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.7
    });
    
    const altText = response.choices[0].message.content.trim()
      .replace(/^["']|["']$/g, "") // Eliminar comillas
      .substring(0, 140);
    
    return altText;
    
  } catch (error) {
    console.error("[AI] Error generando alt text:", error.message);
    throw error;
  }
}

/**
 * Limpia archivos temporales antiguos
 * @param {string} tmpDir - Directorio de temporales
 * @param {number} maxAgeMs - Edad máxima en milisegundos (default: 6 horas)
 */
async function cleanupOldTmp(tmpDir, maxAgeMs = 6 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    const entries = await fs.readdir(tmpDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(tmpDir, entry.name);
        
        try {
          const files = await fs.readdir(dirPath);
          let oldestFile = now;
          
          // Encontrar archivo más antiguo en el directorio
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            oldestFile = Math.min(oldestFile, stats.mtime.getTime());
          }
          
          // Si el directorio es muy antiguo, eliminarlo
          if (now - oldestFile > maxAgeMs) {
            await fs.rmdir(dirPath, { recursive: true });
            console.log(`[AI] 🧹 Limpiado directorio temporal: ${dirPath}`);
          }
          
        } catch (cleanupError) {
          // Continuar con otros directorios
          console.log(`[AI] Error limpiando ${dirPath}:`, cleanupError.message);
        }
      }
    }
  } catch (error) {
    console.error("[AI] Error en limpieza de temporales:", error.message);
  }
}

/**
 * Acepta una imagen temporal. 
 * - Con newsId: mueve a /uploads/news/{newsId}/(cover|secondary).webp y actualiza BD (comportamiento actual).
 * - Con tempId: NO toca BD; devuelve { ok, tempUrl } validando que pertenezca a scratch/{tempId}.
 * @param {Object} params - Parámetros de aceptación
 * @param {string|null} params.newsId - ID de noticia (modo persistente)
 * @param {string|null} params.tempId - ID temporal (modo scratch)
 * @param {string} params.url - URL temporal de la imagen
 * @param {string} params.role - "cover" o "secondary"
 * @returns {Promise<{ok: boolean, finalUrl?: string, tempUrl?: string}>}
 */
async function acceptTemporal({ newsId, tempId, url, role }) {
  // Validar parámetros mutuamente excluyentes
  if (!newsId && !tempId) {
    throw new Error("Se requiere newsId o tempId");
  }
  if (newsId && tempId) {
    throw new Error("newsId y tempId son mutuamente excluyentes");
  }
  if (tempId && !isValidTempId(tempId)) {
    throw new Error("tempId inválido");
  }

  // Modo persistente (newsId) - usar función existente
  if (newsId) {
    return await acceptCandidate({ newsId, url, role });
  }

  // Modo temporal (tempId) - validar y normalizar sin tocar BD
  console.log(`[AI] Aceptando temporal: ${role} para tempId ${tempId}`);
  
  // 1. Validar que la URL apunta a scratch/{tempId}
  const expectedPattern = new RegExp(`^/uploads/tmp/ai/scratch/${tempId}/[^/]+\\.(webp|jpg|jpeg|png)$`);
  if (!expectedPattern.test(url)) {
    throw new Error("URL de imagen temporal inválida para tempId");
  }

  // 2. Verificar que el archivo existe
  const tempPath = path.join(process.cwd(), url.replace(/^\//, ""));
  const scratchDir = path.join(process.cwd(), "uploads", "tmp", "ai", "scratch", tempId);
  
  if (!isUnderDirectory(scratchDir, tempPath)) {
    throw new Error("Ruta de archivo no permitida");
  }

  try {
    await fs.access(tempPath);
  } catch {
    throw new Error("Archivo temporal no encontrado");
  }

  // 3. Normalizar URL y retornar sin persistir
  const normalizedUrl = url.replace(/\/+/g, '/');
  
  console.log(`[AI] ✅ Temporal validado: ${normalizedUrl}`);
  
  return {
    ok: true,
    tempUrl: normalizedUrl
  };
}

/**
 * Adjunta (mueve) las imágenes temporales elegidas a la noticia recién creada.
 * - coverUrl y/o secondaryUrl apuntan a scratch/{tempId}.
 * - Mueve a /uploads/news/{newsId}/cover.webp y /secondary.webp.
 * - Actualiza doc News.imagen / News.imagenOpcional.
 * @param {Object} params - Parámetros de adjunto
 * @param {string} params.newsId - ID de la noticia destino
 * @param {string} params.tempId - ID temporal origen
 * @param {string|null} params.coverUrl - URL de portada temporal (opcional)
 * @param {string|null} params.secondaryUrl - URL de secundaria temporal (opcional)
 * @returns {Promise<{ok: boolean, coverUrl?: string, secondaryUrl?: string}>}
 */
async function attachTemporales({ newsId, tempId, coverUrl, secondaryUrl }) {
  console.log(`[AI] Adjuntando temporales de ${tempId} a noticia ${newsId}`);
  
  // Validar parámetros
  if (!newsId || !tempId) {
    throw new Error("newsId y tempId son requeridos");
  }
  if (!isValidTempId(tempId)) {
    throw new Error("tempId inválido");
  }
  if (!coverUrl && !secondaryUrl) {
    throw new Error("Se requiere al menos coverUrl o secondaryUrl");
  }

  // Verificar que la noticia existe
  const news = await News.findById(newsId);
  if (!news) {
    throw new Error("Noticia no encontrada");
  }

  const result = { ok: true };
  const scratchDir = path.join(process.cwd(), "uploads", "tmp", "ai", "scratch", tempId);
  const finalDir = path.join(process.cwd(), "uploads", "news", newsId);
  await ensureDirectory(finalDir);

  // Procesar portada si se proporciona
  if (coverUrl) {
    // Validar URL de scratch
    const expectedPattern = new RegExp(`^/uploads/tmp/ai/scratch/${tempId}/[^/]+\\.(webp|jpg|jpeg|png)$`);
    if (!expectedPattern.test(coverUrl)) {
      throw new Error("coverUrl inválida para tempId");
    }

    const tempPath = path.join(process.cwd(), coverUrl.replace(/^\//, ""));
    if (!isUnderDirectory(scratchDir, tempPath)) {
      throw new Error("Ruta de portada no permitida");
    }

    // Verificar que existe
    try {
      await fs.access(tempPath);
    } catch {
      throw new Error("Archivo de portada no encontrado");
    }

    // Mover a ubicación final
    const finalPath = path.join(finalDir, "cover.webp");
    const finalUrl = `/uploads/news/${newsId}/cover.webp`;
    
    await fs.copyFile(tempPath, finalPath);
    await fs.unlink(tempPath);
    
    // Actualizar noticia
    news.imagen = finalUrl;
    result.coverUrl = finalUrl;
    
    console.log(`[AI] ✅ Portada movida: ${tempPath} → ${finalPath}`);
  }

  // Procesar secundaria si se proporciona
  if (secondaryUrl) {
    // Validar URL de scratch
    const expectedPattern = new RegExp(`^/uploads/tmp/ai/scratch/${tempId}/[^/]+\\.(webp|jpg|jpeg|png)$`);
    if (!expectedPattern.test(secondaryUrl)) {
      throw new Error("secondaryUrl inválida para tempId");
    }

    const tempPath = path.join(process.cwd(), secondaryUrl.replace(/^\//, ""));
    if (!isUnderDirectory(scratchDir, tempPath)) {
      throw new Error("Ruta de secundaria no permitida");
    }

    // Verificar que existe
    try {
      await fs.access(tempPath);
    } catch {
      throw new Error("Archivo de secundaria no encontrado");
    }

    // Mover a ubicación final
    const finalPath = path.join(finalDir, "secondary.webp");
    const finalUrl = `/uploads/news/${newsId}/secondary.webp`;
    
    await fs.copyFile(tempPath, finalPath);
    await fs.unlink(tempPath);
    
    // Actualizar noticia
    news.imagenOpcional = finalUrl;
    result.secondaryUrl = finalUrl;
    
    console.log(`[AI] ✅ Secundaria movida: ${tempPath} → ${finalPath}`);
  }

  // Generar alt text si es posible
  try {
    const altText = await generateAltText(news.titulo, news.contenido);
    
    // Intentar guardar alt text si existe el campo (fail-safe)
    if (result.coverUrl && news.schema.paths.altCover) {
      news.altCover = altText;
    }
    if (result.secondaryUrl && news.schema.paths.altSecondary) {
      news.altSecondary = altText;
    }
  } catch (altError) {
    console.log("[AI] ⚠️ No se pudo generar alt text:", altError.message);
    // Continuar sin fallo
  }

  // Guardar cambios en la noticia
  await news.save();
  
  console.log(`[AI] ✅ Noticia actualizada con imágenes adjuntadas`);
  
  // Limpiar directorio scratch si está vacío
  try {
    const remainingFiles = await fs.readdir(scratchDir);
    if (remainingFiles.length === 0) {
      await fs.rmdir(scratchDir);
      console.log(`[AI] 🧹 Directorio scratch limpiado: ${scratchDir}`);
    }
  } catch {
    // No es crítico si no se puede limpiar
  }

  return result;
}

/**
 * Genera una sola imagen con tamaño específico (nuevo flujo optimizado)
 * @param {Object} params - Parámetros de generación
 * @param {string|null} params.newsId - ID de noticia (modo persistente)
 * @param {string|null} params.tempId - ID temporal (modo scratch)
 * @param {string} params.title - Título de la noticia
 * @param {string} params.content - Contenido HTML de la noticia
 * @param {string} params.style - Estilo: "realista", "ilustracion", "infografia"
 * @param {number} params.size - Tamaño en píxeles: 512, 768, 1024, 1536
 * @param {string} params.role - Rol de la imagen: "main" o "optional"
 * @param {boolean} params.square - Si true, fuerza imagen cuadrada
 * @param {number} params.n - Número de variantes (default 1)
 * @returns {Promise<{images: Array<{url: string, size: number}>, meta: Object}>}
 */
async function generateSingleImage({ newsId, tempId, title, content, style, size, role, square, n = 1, variation = null }) {
  console.log(`[AI Single] Iniciando generación: ${size}px, rol: ${role}, cuadrada: ${square}, variación: ${variation ? 'sí' : 'no'}`);
  
  // Validar parámetros
  if (!newsId && !tempId) {
    throw new Error("Se requiere newsId o tempId");
  }
  if (newsId && tempId) {
    throw new Error("newsId y tempId son mutuamente excluyentes");
  }
  if (tempId && !isValidTempId(tempId)) {
    throw new Error("tempId inválido");
  }
  
  const workingId = newsId || tempId;
  const summary = toSummary(content);
  
  // 1. Moderación de contenido
  const moderationText = `${title}\n${summary}`;
  const moderation = await moderateText(moderationText);
  
  let prompt;
  if (moderation.flagged) {
    console.log("[AI Single] ⚠️ Contenido flaggeado, usando prompt seguro");
    prompt = buildSafePrompt({ title });
  } else {
    prompt = buildPrompt({ title, summary, style, role });
  }
  
  // Si hay variación solicitada, agregar modificador único al prompt
  if (variation) {
    const variations = [
      ", perspectiva única y creativa",
      ", ángulo no convencional",
      ", interpretación artística alternativa",
      ", enfoque innovador del tema",
      ", composición experimental"
    ];
    const varIndex = (typeof variation === 'number' ? variation : Date.now()) % variations.length;
    prompt += variations[varIndex];
  }
  
  // 2. Determinar aspecto y tamaño OpenAI
  let aspect = square ? "1:1" : (role === "main" ? "16:9" : "1:1");
  let openAISize = "1024x1024"; // Default
  
  // Mapear tamaño solicitado a tamaños OpenAI válidos
  if (size === 512) {
    openAISize = "1024x1024"; // Generamos a 1024 y luego reducimos
  } else if (size === 768) {
    openAISize = "1024x1024"; // Generamos a 1024 y luego reducimos
  } else if (size === 1024) {
    openAISize = square ? "1024x1024" : (aspect === "16:9" ? "1536x1024" : "1024x1024");
  } else if (size === 1536) {
    openAISize = aspect === "16:9" ? "1536x1024" : "1024x1024";
  }
  
  console.log(`[AI Single] Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`[AI Single] OpenAI size: ${openAISize}, target: ${size}px`);
  
  // 3. Generar imagen con IA
  const timeoutMs = parseInt(process.env.AI_IMAGE_TIMEOUT_MS) || 120000;
  const result = await generate({ 
    prompt, 
    aspect, 
    n: Math.min(n, 4), 
    timeoutMs 
  });
  
  console.log(`[AI Single] Generadas ${result.buffers.length} imágenes`);
  
  // 4. Procesar y redimensionar si es necesario
  const processedImages = [];
  
  for (let i = 0; i < result.buffers.length; i++) {
    try {
      let processedBuffer = result.buffers[i];
      
      // Recortar si es necesario (para 16:9)
      if (result.needsCrop) {
        console.log(`[AI Single] Recortando imagen ${i + 1} a ratio ${result.needsCrop}`);
        processedBuffer = await cropToRatio(processedBuffer, result.needsCrop);
      }
      
      // Redimensionar al tamaño solicitado si es diferente
      if (size !== 1024 && size !== 1536) {
        console.log(`[AI Single] Redimensionando imagen ${i + 1} a ${size}px`);
        processedBuffer = await sharp(processedBuffer)
          .resize(size, square ? size : null, {
            fit: square ? "cover" : "inside",
            withoutEnlargement: true
          })
          .toBuffer();
      }
      
      // Convertir a WebP
      const webpBuffer = await sharp(processedBuffer)
        .webp({ quality: 85 })
        .toBuffer();
        
      processedImages.push(webpBuffer);
      console.log(`[AI Single] ✅ Imagen ${i + 1} procesada`);
      
    } catch (processError) {
      console.error(`[AI Single] ❌ Error procesando imagen ${i + 1}:`, processError.message);
    }
  }
  
  if (processedImages.length === 0) {
    throw new Error("No se pudieron procesar las imágenes");
  }
  
  // 5. Guardar archivos temporales
  const tmpPath = newsId 
    ? path.join(process.cwd(), "uploads", "tmp", "ai", newsId)
    : path.join(process.cwd(), "uploads", "tmp", "ai", "scratch", tempId);
  
  console.log(`[AI Single] Preparando directorio temporal: ${tmpPath}`);
  await ensureDirectory(tmpPath);
  
  const images = [];
  
  for (let i = 0; i < processedImages.length; i++) {
    try {
      const uuid = uuidv4();
      const filename = `${uuid}-${role}-${size}.webp`;
      const filePath = path.join(tmpPath, filename);
      
      await fs.writeFile(filePath, processedImages[i]);
      console.log(`[AI Single] ✅ Imagen guardada: ${filename}`);
      
      const basePath = newsId 
        ? `/uploads/tmp/ai/${newsId}`
        : `/uploads/tmp/ai/scratch/${tempId}`;
      
      images.push({
        url: `${basePath}/${filename}`,
        size: size,
        role: role
      });
      
    } catch (saveError) {
      console.error(`[AI Single] ❌ Error guardando imagen ${i + 1}:`, saveError.message);
    }
  }
  
  return {
    images,
    meta: {
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      style,
      size,
      role,
      square,
      count: images.length
    }
  };
}

module.exports = {
  generateForNews,
  generatePairsTemporales,
  acceptCandidate,
  acceptTemporal,
  attachTemporales,
  generateSingleImage
};
