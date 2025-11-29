/**
 * OpenAI API Adapter
 * Maneja moderación de texto y generación de imágenes usando la API de OpenAI
 */

const OpenAI = require("openai");

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID 
});

// Tamaños permitidos por gpt-image-1
const ALLOWED_SIZES = new Set(["1024x1024","1024x1536","1536x1024","auto"]);

/**
 * Selecciona el tamaño apropiado según el aspecto solicitado
 * @param {string} aspect - Ratio de aspecto: "16:9" o "1:1"
 * @returns {string} Tamaño válido para OpenAI
 */
function pickSizeForAspect(aspect) {
  // Solo valores soportados por gpt-image-1
  if (aspect === "16:9") return "1536x1024"; // landscape admitido; luego recortamos a 16:9
  if (aspect === "1:1")  return "1024x1024";
  return "1024x1024";
}

/**
 * Valida que un tamaño esté permitido
 * @param {string} size - Tamaño a validar
 * @returns {string} Tamaño válido
 */
function sanitizeSize(size) {
  return ALLOWED_SIZES.has(size) ? size : "1024x1024";
}

/**
 * Selecciona quality válido o auto
 * @returns {string} Quality válido para OpenAI
 */
function pickQuality() {
  const q = (process.env.AI_IMAGE_QUALITY || "auto").toLowerCase();
  return ["low","medium","high","auto"].includes(q) ? q : "auto";
}

/**
 * Modera texto usando OpenAI moderation
 * @param {string} text - Texto a moderar
 * @returns {Promise<{flagged: boolean, categories?: object}>} Resultado de moderación
 */
async function moderateText(text) {
  try {
    console.log("[AI] Moderando texto...");
    
    const response = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });

    const result = response.results[0];
    
    if (result.flagged) {
      console.log("[AI] ⚠️ Contenido flaggeado por moderación:", result.categories);
      return {
        flagged: true,
        categories: result.categories
      };
    }

    console.log("[AI] ✅ Contenido aprobado por moderación");
    return { flagged: false };

  } catch (error) {
    console.error("[AI] ❌ Error en moderación:", error.message);
    // En caso de error, permitir continuar (fail-safe)
    return { flagged: false };
  }
}

/**
 * Función interna para llamar a la API de OpenAI con un tamaño específico
 * @param {Object} params - Parámetros de la llamada
 * @param {string} params.prompt - Prompt para generar la imagen
 * @param {string} params.size - Tamaño específico (ej: "1536x1024")
 * @param {number} params.n - Número de variantes
 * @param {AbortController} params.controller - Controlador de abort
 * @returns {Promise<{data: Array}>} Respuesta de OpenAI
 */
async function callImages({ prompt, size, n, controller }) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  
  console.log(`[AI] Llamando OpenAI - Modelo: ${model}, Tamaño: ${size}, Prompt: ${prompt.substring(0, 100)}...`);

  // Construir payload normalizado (sin response_format, sin quality: "standard")
  const body = {
    model: model,
    prompt: prompt,
    n: Math.min(n, 4), // DALL-E 3 y gpt-image-1 soportan máximo 4 por llamada
    size: sanitizeSize(size)
  };
  
  // Opción: NO enviar quality (recomendado)
  // Si se quiere incluir quality válido, descomentar la siguiente línea:
  // body.quality = pickQuality();

  return await openai.images.generate(body, {
    signal: controller.signal
  });
}

/**
 * Genera imágenes usando OpenAI DALL-E con fallback automático
 * @param {Object} params - Parámetros de generación
 * @param {string} params.prompt - Prompt para generar la imagen
 * @param {string} params.aspect - Ratio de aspecto: "16:9" o "1:1"
 * @param {number} params.n - Número de variantes a generar
 * @param {number} params.timeoutMs - Timeout en milisegundos
 * @returns {Promise<{buffers: Buffer[], size: string, needsCrop: false|"16:9"|"1:1"}>}
 */
async function generate({ prompt, aspect, n, timeoutMs }) {
  const actualTimeoutMs = timeoutMs || parseInt(process.env.AI_IMAGE_TIMEOUT_MS) || 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), actualTimeoutMs);

  try {
    console.log(`[AI] Generando ${n} imágenes con aspecto ${aspect}...`);
    
    // Determinar tamaño usando solo valores soportados
    const size = pickSizeForAspect(aspect);
    let needsCrop = false;
    
    // Marcar si necesita recorte posterior
    if (aspect === "16:9") {
      needsCrop = "16:9"; // 1536x1024 → 1536x864
    }

    console.log(`[AI] Usando tamaño: ${size} (needsCrop: ${needsCrop})`);

    // Llamar directamente con tamaño válido
    const response = await callImages({ prompt, size, n, controller });
    console.log(`[AI] ✅ Éxito con tamaño: ${size}`);

    clearTimeout(timeoutId);

    console.log(`[AI] ✅ Imágenes generadas: ${response.data.length}`);

    // Convertir datos base64 a buffers
    const buffers = [];
    
    for (const imageData of response.data) {
      try {
        if (!imageData.b64_json) {
          throw new Error("Datos b64_json no encontrados en la respuesta");
        }
        
        const buffer = Buffer.from(imageData.b64_json, "base64");
        buffers.push(buffer);
        
      } catch (processError) {
        console.error(`[AI] ❌ Error procesando imagen base64:`, processError.message);
        // Continuar con las demás imágenes
      }
    }

    if (buffers.length === 0) {
      throw new Error("No se pudieron procesar las imágenes generadas");
    }

    console.log(`[AI] ✅ Procesadas ${buffers.length} imágenes como buffers`);

    return {
      buffers,
      size: size,
      needsCrop
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    // Mapear timeout específicamente
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`AI provider timeout after ${actualTimeoutMs}ms`);
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    
    // Manejo específico del error 403 "Verify Organization"
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.error?.message || error.message || '';
      if (errorMessage.toLowerCase().includes('must be verified') || 
          errorMessage.toLowerCase().includes('organization')) {
        const orgError = new Error("OpenAI requiere verificación de organización para gpt-image-1");
        orgError.status = 403;
        orgError.code = "ORG_NOT_VERIFIED";
        throw orgError;
      }
    }
    
    // Preservar errores de OpenAI para mapeo en rutas
    if (error.response) {
      console.error("[AI] ❌ Error de OpenAI:", error.response.status, error.response.data);
      error.openaiError = true;
    } else {
      console.error("[AI] ❌ Error generando imágenes:", error.message);
    }
    
    throw error;
  }
}

module.exports = {
  moderateText,
  generate
};
