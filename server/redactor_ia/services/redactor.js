// server/redactor_ia/services/redactor.js
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const AiDraft = require('../../models/AiDraft');
const AiTopic = require('../../models/AiTopic');
const AiConfig = require('../../models/AiConfig');
const { marked } = require('marked');
const { classifyCategory } = require('./categoryClassifier');
const { saveBase64Png } = require('./mediaStore');
const { generateWithProvider } = require('./imageProvider');
const { logCost, calculateLLMCost, calculateImageCost } = require('./statsService');
const { buildSystemPrompt, buildEnhancedInput, validateContentQuality, validateStructure, strictValidateAndAutocorrect } = require('./promptBuilder');
const { deriveCategory } = require('../utils/categoryDeriver');
const { ImageThemeEngine } = require('./imageThemeEngine');
const { buildPrompt } = require('./promptTemplates');
const { resolveEditorialImage, downloadEditorialImage } = require('./imageReferenceResolver');
const { detectPrimaryPerson } = require('../utils/personDetector');
const { selectContext, detectCountry } = require('../utils/contextBuilder');
const { buildImageInstructionFormat } = require('./imageInstructionBuilder');
const { convertIIFtoPrompt, convertIIFtoLegacyFormat } = require('./iifConverter');
const { sanitizeImagePrompt } = require('../utils/sanitizeImagePrompt');
const crypto = require('crypto');

// Constantes de validación
const MIN_CONTENT_LENGTH_FACTUAL = 3000; // Mínimo absoluto para FACTUAL
const MIN_CONTENT_LENGTH_OPINION = 600;  // Mínimo para OPINIÓN

// Control de concurrencia: Map por tenant para evitar generaciones simultáneas
const generatingByTenant = new Map();

// Inicializar cliente Anthropic (Claude)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

/**
 * Detecta si el modelo es de OpenAI (soporta JSON mode)
 * @param {string} model - Nombre del modelo
 * @returns {boolean}
 */
function isOpenAIModel(model) {
  if (!model || typeof model !== 'string') return false;
  const m = model.toLowerCase();
  // Ajustar según los nombres que uses en tu config
  return m.startsWith('gpt-4') || m.startsWith('gpt-3') || m.startsWith('gpt-4o') || m.startsWith('gpt-');
}

// Alias retrocompatible
function isGPT(model) {
  return isOpenAIModel(model);
}

/**
 * Llama al LLM correcto según el modelo
 * @returns {Object} { text: string, usage: { prompt_tokens, completion_tokens, total_tokens } }
 */
async function callLLM({ model, system, user, temperature = 0.3, timeoutMs = 30000 }) {
  if (isOpenAIModel(model)) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    
    // Usar API estándar de chat completions con JSON mode para OpenAI
    const res = await openai.chat.completions.create(
      {
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' }, // ← JSON mode activado
        max_tokens: 4096,
      },
      { timeout: timeoutMs }
    );

    const txt = res.choices?.[0]?.message?.content ?? '';

    const usage = {
      prompt_tokens: res.usage?.prompt_tokens || 0,
      completion_tokens: res.usage?.completion_tokens || 0,
      total_tokens: res.usage?.total_tokens || 0
    };

    console.log(`[Redactor:LLM] OpenAI JSON mode activado para ${model}`);

    return { 
      text: String(txt || '').trim(),
      usage,
      isJsonMode: true // Flag para indicar que JSON mode está activo
    };
  }

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const txt = msg?.content?.[0]?.text ?? '';
  const usage = {
    prompt_tokens: msg.usage?.input_tokens || 0,
    completion_tokens: msg.usage?.output_tokens || 0,
    total_tokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0)
  };

  return { 
    text: String(txt || '').trim(),
    usage
  };
}

async function retryLLMCall(fn, timeoutMs = 30000, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
      );
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const shouldRetry = error.status === 429 || (error.status >= 500 && error.status < 600);
      if (!shouldRetry) throw error;
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.log(`[Redactor] Reintento ${attempt}/${maxRetries} en ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Parsea JSON con múltiples estrategias de reparación
 * @param {string} text - Texto que contiene JSON
 * @param {boolean} verbose - Si debe loguear la respuesta completa en caso de error
 * @returns {Object} JSON parseado
 */
/**
 * Parsea JSON con estrategias diferentes según el proveedor
 * @param {string} text - Texto del LLM
 * @param {boolean} verbose - Si debe loguear la respuesta completa en caso de error
 * @param {boolean} isJsonMode - Si el LLM usó JSON mode (OpenAI)
 * @returns {Object} JSON parseado
 */
function parseCleanJSON(text, verbose = true, isJsonMode = false) {
  // Para OpenAI con JSON mode: parseo directo (debería ser JSON válido garantizado)
  if (isJsonMode) {
    try {
      const parsed = JSON.parse(text);
      console.log('[Redactor:JSONParse] ✅ JSON mode (OpenAI): parseo directo exitoso');
      return parsed;
    } catch (error) {
      console.error('[Redactor:JSONParse] ❌ JSON inválido incluso con JSON mode activado');
      console.error(`[Redactor:JSONParse] Modelo parece ser OpenAI pero devolvió JSON inválido`);
      console.error(`[Redactor:JSONParse] Error: ${error.message}`);
      console.error(`[Redactor:JSONParse] Respuesta (primeros 500 chars): ${text.substring(0, 500)}`);
      throw new Error(`JSON inválido de OpenAI incluso con JSON mode: ${error.message}`);
    }
  }
  
  // Para Claude y otros: usar estrategias de reparación
  // Estrategia 1: Parse directo
  try {
    return JSON.parse(text);
  } catch (firstError) {
    console.warn(`[Redactor:JSONParse] Parse directo falló: ${firstError.message}`);
    
    // Estrategia 2: Extraer el JSON del texto (eliminar texto antes/después)
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (secondError) {
      console.warn(`[Redactor:JSONParse] Extracción de JSON falló: ${secondError.message}`);
    }
    
    // Estrategia 3: Reparaciones comunes
    try {
      let repaired = text;
      
      // Eliminar trailing commas antes de } o ]
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
      
      // Escapar comillas dobles dentro de strings (heurística simple)
      // Buscar patrones como "text": "value with "quotes" inside"
      repaired = repaired.replace(/"([^"]*)"(\s*:\s*)"([^"]*)"/g, (match, key, colon, value) => {
        const escapedValue = value.replace(/"/g, '\\"');
        return `"${key}"${colon}"${escapedValue}"`;
      });
      
      // Intentar parsear el JSON reparado
      const jsonMatch = repaired.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[Redactor:JSONParse] ✅ JSON reparado exitosamente con estrategia 3');
        return parsed;
      }
    } catch (thirdError) {
      console.warn(`[Redactor:JSONParse] Reparación automática falló: ${thirdError.message}`);
    }
    
    // Si llegamos aquí, todas las estrategias fallaron
    // Loguear la respuesta completa para debugging
    if (verbose) {
      console.error('[Redactor:JSONParse] ❌ TODAS LAS ESTRATEGIAS FALLARON');
      console.error('[Redactor:JSONParse] Respuesta completa del LLM:');
      console.error('--- INICIO RESPUESTA ---');
      console.error(text);
      console.error('--- FIN RESPUESTA ---');
      console.error(`[Redactor:JSONParse] Longitud: ${text.length} caracteres`);
      console.error(`[Redactor:JSONParse] Error original: ${firstError.message}`);
    }
    
    throw new Error(`No se pudo parsear JSON del LLM. Error: ${firstError.message}. Revisa los logs para ver la respuesta completa.`);
  }
}

/**
 * Genera borradores a partir de temas seleccionados
 * @param {string} formatStyle - 'standard' o 'lectura_viva'
 */
async function generateDrafts(topicIds, user, mode = 'factual', formatStyle = 'standard') {
  // Obtener tenantId para el candado de concurrencia
  const config = await AiConfig.getSingleton();
  const tenantKey = config.defaultTenant || 'levantatecuba';
  
  // Verificar si ya hay una generación en curso para este tenant
  if (generatingByTenant.get(tenantKey)) {
    const error = new Error('Ya hay una generación en curso. Por favor espera a que termine.');
    error.code = 'GENERATION_IN_PROGRESS';
    error.statusCode = 429;
    throw error;
  }
  
  // Marcar como generando
  generatingByTenant.set(tenantKey, true);
  console.log(`[Redactor] 🔒 Candado de generación activado para tenant: ${tenantKey}`);
  
  try {
    console.log(`[Redactor] Generando ${topicIds.length} borradores en modo ${mode} (formato: ${formatStyle})...`);
    const drafts = [];

    for (const topicId of topicIds) {
      try {
        const topic = await AiTopic.findOne({ idTema: topicId });
        if (!topic) {
          console.warn(`[Redactor] Tema ${topicId} no encontrado`);
          continue;
        }

        // Selección del topic
        topic.status = 'selected';
        topic.selectedBy = user?._id || null;
        topic.selectedAt = new Date();
        await topic.save();

        // Generar borrador
        const draft = await generateSingleDraft(topic, user || null, mode, config, formatStyle);
        drafts.push(draft);

        // Marcar como archived para eliminarlo de la cola
        topic.status = 'archived';
        topic.archivedAt = new Date();
        await topic.save();
      } catch (error) {
        console.error(`[Redactor] Error generando borrador para ${topicId}:`, error);
      }
    }

    console.log(`[Redactor] ${drafts.length} borradores generados exitosamente`);
    return drafts;
  } finally {
    // SIEMPRE liberar el candado, pase lo que pase
    generatingByTenant.set(tenantKey, false);
    console.log(`[Redactor] 🔓 Candado de generación liberado para tenant: ${tenantKey}`);
  }
}

/**
 * Normaliza el payload del LLM asegurando campos críticos
 * Ahora deriva categoría automáticamente si falta
 */
function normalizeDraftPayload(topic, response, mode = 'factual') {
  // 1. Asegurar titulo (crítico)
  const titulo = response.titulo?.trim() || topic.tituloSugerido?.trim();
  
  if (!titulo) {
    throw new Error(
      `[Redactor] No se pudo obtener titulo del LLM ni del topic. ` +
      `LLM titulo: "${response.titulo}", Topic tituloSugerido: "${topic.tituloSugerido}"`
    );
  }

  // 2. Normalizar bajada
  const bajada = typeof response.bajada === 'string' ? response.bajada.trim() : '';

  // 3. Normalizar categoria (con derivación automática si falta)
  let categoria = response.categoria?.trim() || topic.categoriaSugerida?.trim() || '';
  
  // Derivar automáticamente si no hay categoría
  if (!categoria) {
    console.log('[Redactor] Categoría ausente, derivando automáticamente...');
    categoria = deriveCategory({
      title: titulo,
      summary: bajada,
      tags: Array.isArray(response.etiquetas) ? response.etiquetas : [],
      source: topic.fuentesTop?.[0] || null
    });
  }

  // 4. Normalizar etiquetas (filtrar vacías)
  const etiquetas = Array.isArray(response.etiquetas)
    ? response.etiquetas.filter((t) => typeof t === 'string' && t.trim())
    : [];

  // 5. Normalizar contenido
  const contenidoMarkdown = typeof response.contenidoMarkdown === 'string' 
    ? response.contenidoMarkdown.trim() 
    : '';

  // 6. Normalizar verifications
  const verifications = Array.isArray(response.verifications) ? response.verifications : [];

  // 7. Normalizar prompts de imagen
  const promptsImagen = response.promptsImagen || {};
  const principal = promptsImagen.principal?.trim() || 
    `Editorial news cover sobre: ${topic.tituloSugerido || titulo}`;
  const opcional = promptsImagen.opcional?.trim() || '';

  return {
    titulo,
    bajada,
    categoria,
    etiquetas,
    contenidoMarkdown,
    verifications,
    promptsImagen: { principal, opcional },
  };
}

/** @feature: Formato "Lectura Viva" para artículos largos — Oct 2025 **/
/**
 * Genera un borrador individual
 * @param {string} formatStyle - 'standard' o 'lectura_viva'
 */
async function generateSingleDraft(topic, user, mode, config, formatStyle = 'standard') {
  const startTime = Date.now();
  const DEBUG_GENERATION = config.debugGeneration || process.env.DEBUG_GENERATION === 'true';

  const inputs = buildClaudeInput(topic, mode, config, formatStyle);
  
  // 🔍 MONITOR: Log del input que se enviará al LLM
  if (DEBUG_GENERATION) {
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 [MONITOR] INICIO GENERACIÓN FACTUAL');
    console.log('═'.repeat(80));
    console.log(`📝 Topic ID: ${topic.idTema}`);
    console.log(`📰 Título sugerido: ${topic.tituloSugerido}`);
    console.log(`📋 Modo: ${mode} | Formato: ${formatStyle}`);
    console.log(`🔗 Fuentes: ${(topic.fuentesTop || []).length}`);
    console.log('─'.repeat(80));
    console.log('📤 INPUT ENVIADO AL LLM:');
    console.log(JSON.stringify(inputs, null, 2));
    console.log('─'.repeat(80));
  }

  let rawResponse, response, norm;
  const modelUsed = config.aiModel || 'claude-3-5-sonnet-20240620';
  let attemptCount = 0;
  const maxAttempts = mode === 'factual' ? 2 : 1; // Permitir reintentos solo en FACTUAL
  let llmCost = 0; // Variable de costo para el monitor final
  
  try {
    // Usar sistema de prompts mejorado
    const systemPrompt = buildSystemPrompt(mode, formatStyle);
    
    console.log(`[Redactor] Generando borrador en modo ${mode.toUpperCase()}...`);
    if (inputs.entitiesDetected?.people?.length > 0) {
      console.log(`[Redactor] Entidades detectadas: ${inputs.entitiesDetected.people.join(', ')}`);
    }
    
    const llmResult = await retryLLMCall(
      async () =>
        await callLLM({
          model: modelUsed,
          system: systemPrompt,
          user: JSON.stringify(inputs, null, 2),
          temperature: mode === 'factual' ? 0.2 : 0.7,
        }),
      30000
    );
    rawResponse = llmResult.text;
    const usage = llmResult.usage;
    const isJsonMode = llmResult.isJsonMode || false;
    
    // 🔍 MONITOR: Respuesta raw del LLM
    if (DEBUG_GENERATION) {
      console.log('\n📥 RESPUESTA RAW DEL LLM:');
      console.log('─'.repeat(80));
      console.log(`🤖 Modelo: ${modelUsed}`);
      console.log(`📊 Tokens: ${usage.prompt_tokens} input + ${usage.completion_tokens} output = ${usage.total_tokens} total`);
      console.log(`⏱️ JSON Mode: ${isJsonMode ? 'SÍ (OpenAI)' : 'NO (Claude)'}`);
      console.log('\n📄 CONTENIDO COMPLETO:');
      console.log(rawResponse);
      console.log('─'.repeat(80));
    } else {
      console.log(`[Redactor] Respuesta LLM recibida (primeros 500 chars): ${rawResponse.substring(0, 500)}`);
    }
    
    response = parseCleanJSON(rawResponse, true, isJsonMode);
    
    // 🔍 MONITOR: JSON parseado
    if (DEBUG_GENERATION) {
      console.log('\n✅ JSON PARSEADO EXITOSAMENTE:');
      console.log('─'.repeat(80));
      console.log(`📌 Título: ${response.titulo || '(vacío)'}`);
      console.log(`📝 Bajada: ${(response.bajada || '').substring(0, 100)}...`);
      console.log(`🏷️ Categoría: ${response.categoria || '(vacío)'}`);
      console.log(`🏷️ Etiquetas: ${(response.etiquetas || []).join(', ')}`);
      console.log(`📄 Contenido: ${response.contenidoMarkdown?.length || 0} caracteres`);
      console.log(`✓ Verificaciones: ${(response.verifications || []).length}`);
      console.log('─'.repeat(80));
      
      // Mostrar estructura del contenido
      if (response.contenidoMarkdown) {
        const sections = response.contenidoMarkdown.match(/^##\s+.+$/gm) || [];
        console.log('📑 SECCIONES DETECTADAS EN CONTENIDO:');
        sections.forEach((s, i) => console.log(`   ${i+1}. ${s}`));
        console.log('─'.repeat(80));
      }
    } else {
      console.log(`[Redactor] Campos en response: titulo=${!!response.titulo}, bajada=${!!response.bajada}, categoria=${!!response.categoria}, contenido=${response.contenidoMarkdown?.length || 0} chars`);
    }
    
    // PASO 1: Normalizar payload PRIMERO (deriva categoría automáticamente)
    norm = normalizeDraftPayload(topic, response, mode);
    
    // PASO 2: Validar longitud y reintentar si es necesario (solo FACTUAL)
    if (mode === 'factual' && attemptCount === 0) {
      const contentLength = norm.contenidoMarkdown.length;
      
      if (contentLength < MIN_CONTENT_LENGTH_FACTUAL) {
        console.warn(`[Redactor] Contenido muy corto (${contentLength} chars). Reintentando con instrucción de ampliación...`);
        attemptCount++;
        
        // Reintentar con prompt de ampliación
        const expandPrompt = `${JSON.stringify(inputs, null, 2)}

IMPORTANTE: El contenido anterior fue demasiado corto (${contentLength} caracteres).
Amplía el artículo a mínimo 3000 caracteres manteniendo:
- Estructura completa (6 secciones)
- Contexto histórico/social verificable
- Datos y cifras de las fuentes
- NO inventar información
- Ampliar desarrollo y sección "Por qué es importante"`;
        
        const expandedResult = await retryLLMCall(
          async () =>
            await callLLM({
              model: modelUsed,
              system: systemPrompt,
              user: expandPrompt,
              temperature: 0.2,
            }),
          30000
        );
        
        rawResponse = expandedResult.text;
        const expandedIsJsonMode = expandedResult.isJsonMode || false;
        // Sumar tokens de la segunda llamada
        usage.prompt_tokens += expandedResult.usage.prompt_tokens;
        usage.completion_tokens += expandedResult.usage.completion_tokens;
        usage.total_tokens += expandedResult.usage.total_tokens;
        
        response = parseCleanJSON(rawResponse, true, expandedIsJsonMode);
        norm = normalizeDraftPayload(topic, response, mode);
        
        console.log(`[Redactor] Contenido expandido: ${norm.contenidoMarkdown.length} chars`);
      }
    }
    
    // PASO 3: Validar calidad DESPUÉS de normalizar y expandir
    // Reconstruir response con valores normalizados para la validación
    const normalizedResponse = {
      titulo: norm.titulo,
      bajada: norm.bajada,
      categoria: norm.categoria,
      etiquetas: norm.etiquetas,
      contenidoMarkdown: norm.contenidoMarkdown
    };
    
    const validation = validateContentQuality(normalizedResponse, mode);
    
    // 🔍 MONITOR: Resultados de validación de calidad
    if (DEBUG_GENERATION) {
      console.log('\n🔎 VALIDACIÓN DE CALIDAD:');
      console.log('─'.repeat(80));
      console.log(`✅ Válido: ${validation.valid ? 'SÍ' : 'NO'}`);
      if (validation.errors.length > 0) {
        console.log('❌ ERRORES:');
        validation.errors.forEach(e => console.log(`   • ${e}`));
      }
      if (validation.warnings.length > 0) {
        console.log('⚠️ ADVERTENCIAS:');
        validation.warnings.forEach(w => console.log(`   • ${w}`));
      }
      console.log('─'.repeat(80));
    }
    
    if (!validation.valid) {
      console.error('[Redactor] Errores de validación:', validation.errors);
      throw new Error(`Contenido no válido: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.warn('[Redactor] Advertencias de calidad:', validation.warnings);
    }
    
    // PASO 4: Validar estructura de secciones obligatorias (solo FACTUAL)
    if (mode === 'factual') {
      const structureValidation = strictValidateAndAutocorrect(norm.contenidoMarkdown, {
        model: modelUsed,
        allowAutocorrect: true
      });
      
      if (structureValidation.shouldReject) {
        console.error('[Redactor] ❌ Estructura inválida:', structureValidation.rejectReason);
        throw new Error(`Estructura de artículo inválida: ${structureValidation.rejectReason}`);
      }
      
      // Si se autocorrigió, usar el contenido corregido
      if (structureValidation.corrected && structureValidation.correctedContent) {
        console.log('[Redactor] ✅ Estructura autocorregida, secciones añadidas:', structureValidation.missingSections);
        norm.contenidoMarkdown = structureValidation.correctedContent;
      }
      
      if (structureValidation.issues.length > 0) {
        console.warn('[Redactor] ⚠️ Advertencias de estructura:', structureValidation.issues);
      }
      
      // 🔍 MONITOR: Validación de estructura
      if (DEBUG_GENERATION) {
        console.log('\n📐 VALIDACIÓN DE ESTRUCTURA FACTUAL:');
        console.log('─'.repeat(80));
        console.log(`✅ Estructura válida: ${structureValidation.valid ? 'SÍ' : 'NO'}`);
        console.log(`🔧 Autocorregido: ${structureValidation.corrected ? 'SÍ' : 'NO'}`);
        if (structureValidation.missingSections.length > 0) {
          console.log(`❌ Secciones faltantes: ${structureValidation.missingSections.join(', ')}`);
        }
        if (structureValidation.issues.length > 0) {
          console.log('⚠️ Issues:');
          structureValidation.issues.forEach(i => console.log(`   • ${i}`));
        }
        console.log('─'.repeat(80));
      } else {
        console.log(`[Redactor] Validación estructura FACTUAL: ${structureValidation.valid ? '✅ OK' : '⚠️ Autocorregido'}`);
      }
    }
    
    // Calcular y registrar costo del LLM con tokens reales
    llmCost = calculateLLMCost({ 
      model: modelUsed, 
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens
    });
    await logCost({
      type: 'llm',
      costUSD: llmCost,
      topicId: topic.idTema,
      metadata: {
        model: modelUsed,
        provider: modelUsed.startsWith('gpt-') ? 'openai' : 'anthropic',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        duration: Date.now() - startTime,
        success: true
      },
      tenantId: topic.tenantId || config.defaultTenant || 'levantatecuba'
    });
    
    console.log(`[Redactor] Costo LLM: $${llmCost.toFixed(4)} (${usage.total_tokens} tokens: ${usage.prompt_tokens} input + ${usage.completion_tokens} output)`);
  } catch (error) {
    console.error('[Redactor] Error en generación:', error.message);
    
    // Registrar error (sin costo)
    await logCost({
      type: 'llm',
      costUSD: 0,
      topicId: topic.idTema,
      metadata: {
        model: modelUsed,
        provider: modelUsed.startsWith('gpt-') ? 'openai' : 'anthropic',
        tokensUsed: 0,
        duration: Date.now() - startTime,
        success: false
      },
      tenantId: topic.tenantId || config.defaultTenant || 'levantatecuba'
    });
    
    throw new Error(`Error generando borrador: ${error.message}`);
  }

  // Generar y persistir imágenes
  let generatedImages = {};
  let coverImageUrl = '';
  let coverUrl = '';
  let coverFallbackUrl = '';
  let coverHash = '';
  let imagePersisted = false;
  let likenessMetadata = null;
  let imageKind = null;
  let imageMeta = null;
  let imageProviderFinal = '';
  
  // ID temporal para directorio de imágenes (se usa antes de tener el ID real del draft)
  const tempDraftId = topic.idTema || `temp-${Date.now()}`;

  // Captura automática de imágenes del sitio (prioridad sobre generación IA)
  if (config.autoCaptureImageFromSourceOnCreate) {
    console.log('[Redactor] 📸 Modo auto-captura activado: extrayendo imagen del sitio original...');
    
    // Obtener URL de la noticia original desde las fuentes del topic
    const fuentes = (topic.fuentesTop || []).filter(f => f.url);
    
    if (fuentes.length > 0 && fuentes[0].url) {
      try {
        const sourceUrl = fuentes[0].url;
        console.log(`[Redactor] Intentando capturar imagen desde: ${sourceUrl}`);
        
        // Usar el mismo flujo que el endpoint manual de captura
        const result = await generateWithProvider({
          provider: 'internal',
          mode: 'extract',
          draftId: topic.idTema || `temp-${Date.now()}`, // ID temporal
          draft: {
            titulo: norm.titulo,
            bajada: norm.bajada,
            categoria: norm.categoria,
            fuentes: fuentes.map(f => ({
              medio: f.medio,
              titulo: f.titulo,
              url: f.url,
              imageUrl: f.imageUrl || f.urlToImage || null
            }))
          },
          topic: topic
        });
        
        // Verificar que la captura fue exitosa y no cayó en fallback
        if (result.ok && result.kind === 'processed') {
          coverUrl = result.coverUrl || result.url;
          coverFallbackUrl = result.coverFallbackUrl || '';
          coverHash = result.coverHash || '';
          coverImageUrl = coverUrl;
          imagePersisted = true;
          imageKind = 'processed';
          imageProviderFinal = 'internal';
          generatedImages.principal = coverUrl;
          
          console.log(`[Redactor] ✅ Imagen capturada exitosamente desde sitio: ${coverUrl}`);
        } else {
          console.warn(`[Redactor] ⚠️  Captura automática falló (kind=${result.kind}), sin imagen para el borrador`);
        }
      } catch (error) {
        console.error('[Redactor] ❌ Error en captura automática de imagen:', error.message);
        // Continuar sin imagen, no bloquear la creación del borrador
      }
    } else {
      console.warn('[Redactor] ⚠️  No hay URL de fuente disponible para captura automática');
    }
  } else if (config.autoGenerateImages) {
    // Crear draft temporal con contexto completo para builder contextual
    const tempDraft = {
      titulo: norm.titulo,
      bajada: norm.bajada,
      categoria: norm.categoria,
      etiquetas: norm.etiquetas,
      contenidoMarkdown: norm.contenidoMarkdown, // ✅ Incluir contenido completo para contexto
      promptsImagen: norm.promptsImagen // ✅ Incluir prompts generados por LLM
    };
    
    // tempDraftId ya está definido arriba
    const images = await generateImages(norm.promptsImagen, config, topic, tempDraft, tempDraftId);
    
    // Capturar metadata de likeness si existe
    if (images?.likenessMetadata) {
      likenessMetadata = images.likenessMetadata;
      console.log(`[Redactor] Metadata de likeness capturada: person="${likenessMetadata.person}", likeness=${likenessMetadata.likeness}`);
    }
    
    // Capturar imageKind e imageMeta
    if (images?.imageKind || images?.kind) {
      imageKind = images.imageKind || images.kind;
    }
    if (images?.imageMeta) {
      imageMeta = images.imageMeta;
    }
    
    // Si se generó una URL interna (proveedor internal)
    if (images?.principal_url) {
      coverImageUrl = images.principal_url;
      imagePersisted = true;
      generatedImages.principal = images.principal_url;
      coverUrl = images.coverUrl || '';
      coverFallbackUrl = images.coverFallbackUrl || '';
      coverHash = images.coverHash || '';
      imageProviderFinal = images.provider || config.imageProvider;
      console.log(`[Redactor] Imagen interna persistida: ${coverImageUrl}`);
    }
    // Si se generó una imagen en base64 (proveedores externos), persistirla
    else if (images?.principal_b64) {
      try {
        const nameHash = crypto.createHash('sha1').update(`${topic.idTema}-${Date.now()}`).digest('hex');
        const filename = `draft_${nameHash}.png`;
        const { publicUrl } = await saveBase64Png(images.principal_b64, filename);
        
        coverImageUrl = publicUrl;
        imagePersisted = true;
        generatedImages.principal = publicUrl; // Para compatibilidad con UI
        coverUrl = publicUrl;
        coverFallbackUrl = publicUrl;
        coverHash = crypto.createHash('sha1').update(publicUrl).digest('hex');
        imageProviderFinal = images.provider || config.imageProvider;
        
        console.log(`[Redactor] Imagen externa persistida: ${publicUrl}`);
      } catch (error) {
        console.error('[Redactor] Error persistiendo imagen:', error.message);
      }
    }
  }

  // Calcular originalityScore y contentOrigin
  const hasMultipleSources = norm.verifications?.length >= 3;
  const hasSubstantialContent = norm.contenidoMarkdown.length > 500;
  const hasStructuredTags = norm.etiquetas.length >= 3;
  
  let originalityScore = 0.5; // Default
  let contentOrigin = 'source_derived';
  
  if (hasMultipleSources && hasSubstantialContent && hasStructuredTags) {
    originalityScore = 0.7;
    contentOrigin = 'ai_synthesized';
  } else if (hasMultipleSources && hasSubstantialContent) {
    originalityScore = 0.6;
    contentOrigin = 'ai_synthesized';
  } else if (hasMultipleSources || hasSubstantialContent) {
    originalityScore = 0.5;
    contentOrigin = 'source_derived';
  } else {
    originalityScore = 0.4;
    contentOrigin = 'source_derived';
  }

  // Clasificación ensemble de categoría (reglas + LLM + similitud)
  let finalCategoria = norm.categoria;
  let categoryConfidence = 0.5;
  let categoryLowConfidence = false;
  let categoryDetail = '';
  
  try {
    const classifier = await classifyCategory({
      title: norm.titulo,
      summary: norm.bajada,
      markdown: norm.contenidoMarkdown,
      tags: norm.etiquetas,
      topicHint: topic.categoriaSugerida,
      callLLM,
      config
    });
    
    // Sobrescribir si el LLM devolvió "General" y el ensemble sugiere otra con alta confianza
    if (norm.categoria === 'General' && classifier.category !== 'General' && classifier.confidence >= 0.55) {
      finalCategoria = classifier.category;
    } else if (!norm.categoria || norm.categoria === '') {
      // Si no hay categoría del LLM, usar la del ensemble
      finalCategoria = classifier.category;
    } else {
      // Usar la del ensemble si tiene alta confianza
      if (classifier.confidence >= 0.70) {
        finalCategoria = classifier.category;
      }
    }
    
    categoryConfidence = classifier.confidence;
    categoryLowConfidence = classifier.lowConfidence;
    categoryDetail = classifier.detail || '';
    
    console.log(`[Redactor] Categoría ensemble: ${finalCategoria} (confianza: ${categoryConfidence})`);
  } catch (error) {
    console.error('[Redactor] Error en clasificación ensemble:', error.message);
    // Fallback: usar la categoría del LLM original
    finalCategoria = norm.categoria || topic.categoriaSugerida || 'General';
  }

  // Convertir markdown a HTML
  const contenidoHTML = marked(norm.contenidoMarkdown || '');

  // Usuario seguro (puede ser null si se dispara automáticamente)
  const safeUserId = user?._id || null;
  const generationType = user ? 'manual' : 'auto';

  const draft = new AiDraft({
    topic: topic._id,
    topicId: topic.idTema,
    titulo: norm.titulo,
    bajada: norm.bajada,
    categoria: finalCategoria,
    etiquetas: norm.etiquetas,
    contenidoMarkdown: norm.contenidoMarkdown,
    contenidoHTML,
    fuentes: (topic.fuentesTop || []).map((f) => ({
      medio: f.medio,
      titulo: f.titulo,
      url: f.url,
      fecha: f.fecha,
      imageUrl: f.imageUrl || f.urlToImage || null,
    })),
    verifications: norm.verifications,
    promptsImagen: norm.promptsImagen,
    generatedImages,
    coverImageUrl,
    coverUrl,
    coverFallbackUrl,
    coverHash,
    generatedImagesPersisted: {
      principal: imagePersisted,
    },
    imageKind: imageKind || undefined, // Solo asignar si existe
    imageMeta: imageMeta || undefined, // Solo asignar si existe
    
    // Normalizar mode a lowercase (crítico para filtros)
    mode: (mode || 'factual').toLowerCase(),
    status: 'draft',
    reviewStatus: 'pending', // Explícito para coherencia con filtros
    publishStatus: 'pendiente', // Inicializar campo de programación automática
    
    tenantId: topic.tenantId || config.defaultTenant || 'levantatecuba', // Requerido por schema

    // Ahora permitido null en el modelo
    generatedBy: safeUserId,
    generationType,

    aiMetadata: {
      model: config.aiModel || 'claude-3-5-sonnet-20240620',
      tokensUsed: 0,
      generationTime: Date.now() - startTime,
      confidence: calculateConfidence(response),
      imageGenerationEnabled: config.autoGenerateImages,
      autoCaptureImageFromSourceOnCreate: config.autoCaptureImageFromSourceOnCreate,
      capturedFromSource: config.autoCaptureImageFromSourceOnCreate && imageKind === 'processed',
      imageProvider: imageProviderFinal || config.imageProvider,
      rawResponse: rawResponse?.substring(0, 5000) || '',
      originalityScore,
      contentOrigin,
      categoryConfidence,
      categoryLowConfidence,
      categoryDetail,
      formatStyle, // 'standard' o 'lectura_viva'
      // Metadata de likeness para trazabilidad editorial
      likenessMetadata: likenessMetadata ? {
        likeness: likenessMetadata.likeness,
        person: likenessMetadata.person,
        reference: likenessMetadata.reference,
        reason: likenessMetadata.reason
      } : null
    },
  });

  await draft.save();

  // Mover imagen del directorio temporal (topicId) al directorio final (draftId)
  if (imagePersisted && coverImageUrl && coverImageUrl.includes(tempDraftId)) {
    try {
      const oldDir = path.join(process.cwd(), 'public', 'media', 'news', tempDraftId);
      const newDir = path.join(process.cwd(), 'public', 'media', 'news', draft._id.toString());
      
      // Verificar si el directorio temporal existe
      const oldDirExists = await fs.access(oldDir).then(() => true).catch(() => false);
      
      if (oldDirExists) {
        // Crear nuevo directorio y copiar archivos
        await fs.mkdir(newDir, { recursive: true });
        const files = await fs.readdir(oldDir);
        
        for (const file of files) {
          await fs.copyFile(path.join(oldDir, file), path.join(newDir, file));
        }
        
        // Actualizar rutas en el borrador
        const newCoverUrl = coverImageUrl.replace(tempDraftId, draft._id.toString());
        draft.coverImageUrl = newCoverUrl;
        draft.coverUrl = draft.coverUrl ? draft.coverUrl.replace(tempDraftId, draft._id.toString()) : newCoverUrl;
        draft.coverFallbackUrl = draft.coverFallbackUrl ? draft.coverFallbackUrl.replace(tempDraftId, draft._id.toString()) : '';
        if (draft.generatedImages?.principal) {
          draft.generatedImages.principal = draft.generatedImages.principal.replace(tempDraftId, draft._id.toString());
        }
        
        await draft.save();
        
        // Eliminar directorio temporal
        await fs.rm(oldDir, { recursive: true, force: true });
        
        console.log(`[Redactor] ✅ Imagen movida de ${tempDraftId} a ${draft._id}`);
      }
    } catch (moveError) {
      console.warn(`[Redactor] ⚠️ No se pudo mover imagen: ${moveError.message}`);
      // No fallar la generación por esto
    }
  }

  // 🔍 MONITOR: Resumen final de generación
  if (DEBUG_GENERATION) {
    const duration = Date.now() - startTime;
    console.log('\n' + '═'.repeat(80));
    console.log('✅ [MONITOR] GENERACIÓN COMPLETADA');
    console.log('═'.repeat(80));
    console.log(`📝 Draft ID: ${draft._id}`);
    console.log(`📰 Título final: ${draft.titulo}`);
    console.log(`🏷️ Categoría: ${draft.categoria} (confianza: ${categoryConfidence})`);
    console.log(`📄 Contenido: ${norm.contenidoMarkdown.length} caracteres`);
    console.log(`🖼️ Imagen: ${imagePersisted ? coverUrl : 'No generada'}`);
    console.log(`⏱️ Duración total: ${duration}ms`);
    console.log(`💰 Costo estimado: $${llmCost?.toFixed(4) || '0.0000'}`);
    console.log('═'.repeat(80) + '\n');
  } else {
    console.log(`[Redactor] Borrador creado: ${draft._id} (${draft.titulo}) mode=${draft.mode} reviewStatus=${draft.reviewStatus}`);
  }
  
  return draft;
}

function buildClaudeInput(topic, mode, config, formatStyle = 'standard') {
  // Usar builder mejorado con extracción de entidades
  return buildEnhancedInput(topic, mode, config, formatStyle);
}

// Funciones legacy removidas - ahora se usan las de promptBuilder.js
// - buildOpinionPrompt() → no se usa
// - getSystemPrompt() → reemplazado por buildSystemPrompt() de promptBuilder.js
// - generateImagePrompts() → LEGACY (no usado, prompt se construye en generateImages)

/**
 * @deprecated - Esta función ya NO se usa. El prompt se construye directamente en generateImages()
 * con lógica limpia basada en título/tags (no en cuerpo completo).
 * Se mantiene por compatibilidad pero no se llama desde ningún lugar.
 */
async function generateImagePrompts(topic, draftContent) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
  
  // Extraer fragmento del contenido para contexto
  const palabrasClave = (draftContent.contenidoMarkdown || '').slice(0, 2000);
  
  // NUEVA LÓGICA: Detectar si contenido menciona desastres CON ALTA CONFIANZA (≥2 términos)
  const disasterTerms = [
    /huracán/i, /ciclón/i, /tormenta tropical/i,
    /terremoto/i, /sismo/i,
    /incendio forestal/i, /incendio/i,
    /inundaci[oó]n/i, /inundado/i,
    /ambulancia/i, /rescate/i, /emergencia/i,
    /desastre natural/i, /desastre/i,
    /v[ií]ctima mortal/i, /fallecidos/i,
    /heridos graves/i
  ];
  
  const matchCount = disasterTerms.filter(term => term.test(draftContent.contenidoMarkdown || '')).length;
  const mencionaDesastres = matchCount >= 2; // Requerir ≥2 términos
  
  console.log(`[Redactor:ImagePrompts] disasterTermsMatched=${matchCount} isDisaster=${mencionaDesastres}`);
  
  // Construir negativos SIEMPRE si NO hay mención fuerte de desastres
  const negatives = mencionaDesastres
    ? []
    : ['no disaster', 'no hurricane', 'no flood', 'no fire', 'no ambulance', 'no rescue', 'no emergency vehicles', 'no war', 'no chaos', 'no blood', 'no violence'];
  
  const promptCompletion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres editor gráfico de prensa. SOLO generas descripciones foto-periodísticas neutrales y contextualizadas. ' +
          'Prohíbe: desastres, incendios, huracanes, ambulancias, escenas de guerra, si el artículo NO los menciona EXPLÍCITAMENTE con alta frecuencia. ' +
          'Prohíbe: celebridades inventadas, sangre, armas, multitudes caóticas. ' +
          'Estilo: editorial, realista, sin texto, sin logos, 16:9. Responde SOLO en JSON: {"principal":"...","opcional":"..."}.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          titulo: draftContent.titulo,
          bajada: draftContent.bajada,
          categoria: draftContent.categoria || topic?.categoriaSugerida || 'General',
          entidadesTop: (draftContent.etiquetas || []).slice(0, 6),
          palabrasClave: palabrasClave,
          negatives: negatives
        }),
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  // Proteger JSON.parse por si acaso esta función deprecated se llama
  const content = promptCompletion.choices[0].message.content;
  return parseCleanJSON(content, true);
}

// Tema neutral por defecto (sin sesgo a desastre)
const DEFAULT_THEME = 'general';

// Packs visuales minimalistas y limpios (sin negativos agresivos)
const VISUAL_PACKS = {
  general: {
    positive: 'neutral editorial background, subtle depth, photojournalism style',
    negative: ''
  },
  justice: {
    positive: 'press briefing room or neutral backdrop, legal motif, formal setting',
    negative: ''
  },
  economy: {
    positive: 'newsroom or neutral office abstract, generic market motif, editorial',
    negative: ''
  },
  politics: {
    positive: 'government setting or press conference, neutral backdrop, official atmosphere',
    negative: ''
  },
  disaster: {
    positive: 'outdoor aftermath if applicable, emergency response allowed, weather impact visible',
    negative: ''
  }
};

/**
 * Detecta la intención visual del título para contexto de imagen
 * @param {string} titleRaw - Título sin procesar
 * @returns {string} Tipo de intención
 */
function detectVisualIntentFromTitle(titleRaw = '') {
  const t = String(titleRaw).toLowerCase();
  if (/(exilio|diáspora|diaspora|exiliados|comunidad cubana|miami|hialeah|little havana|cubans in exile)/.test(t)) return 'diaspora';
  if (/(rueda de prensa|conferencia|declaración|declaracion|comunicado|discurso|portavoz|vocero)/.test(t)) return 'press';
  if (/(ayuda humanitaria|donación|donacion|paquete de ayuda|asistencia|cooperación|cooperacion)/.test(t)) return 'aid';
  if (/(acuerdo|tratado|visita oficial|cumbre|embajada|relaciones bilaterales|sanciones|levantamiento de sanciones)/.test(t)) return 'diplomatic';
  if (/(economía|economia|finanzas|financiero|acuerdo económico|acuerdo economico)/.test(t)) return 'economy';
  return 'generic';
}

/**
 * Palabras clave de países
 */
const COUNTRY_WORDS = [
  'eeuu', 'estados unidos', 'usa', 'us',
  'cuba', 'cubano', 'cubanos',
  'venezuela', 'colombia', 'méxico', 'mexico',
  'rusia', 'ucrania', 'unión europea', 'union europea', 'ue',
  'onu', 'oea', 'españa', 'espana'
];

/**
 * Detecta menciones de países en el título
 * @param {string} titleRaw - Título sin procesar
 * @returns {Array<string>} Lista de países mencionados
 */
function mentionsCountries(titleRaw = '') {
  const t = String(titleRaw).toLowerCase();
  return COUNTRY_WORDS.filter(k => t.includes(k));
}

/**
 * Detecta si el título sugiere elementos de prensa (conferencia, comunicado, etc.)
 * @param {string} titleRaw - Título sin procesar
 * @returns {boolean} true si permite cámaras/micrófonos/podio
 */
function allowPressProps(titleRaw = '') {
  const t = String(titleRaw).toLowerCase();
  return /(rueda de prensa|conferencia|declaración|declaracion|comunicado|discurso|portavoz|vocero)/.test(t);
}

/**
 * Detecta si se permiten banderas según contexto e intención
 * @param {string} titleRaw - Título sin procesar
 * @param {string} intent - Intención visual (aid, press, economy, etc.)
 * @returns {boolean} true si permite banderas
 */
function allowFlags(titleRaw = '', intent = 'generic') {
  const t = String(titleRaw).toLowerCase();
  const hasCountries = mentionsCountries(t).length > 0;
  
  // Siempre permitir en contexto de prensa
  if (intent === 'press') return true;
  
  // Permitir en aid/economy/diplomatic si menciona países
  if (intent === 'aid' || intent === 'economy' || intent === 'diplomatic') {
    return hasCountries; // exigir mención de países
  }
  
  // Para diaspora: solo si menciona países Y acto oficial
  if (intent === 'diaspora') {
    const hasOfficialContext = /(acto oficial|ceremonia|homenaje|conmemoración|declaración)/.test(t);
    return hasCountries && hasOfficialContext;
  }
  
  // Caso especial: títulos que incluyan ambos "cuba" y ("eeuu" | "estados unidos")
  if (t.includes('cuba') && (t.includes('eeuu') || t.includes('estados unidos'))) return true;
  
  return false;
}

/**
 * Arquetipos visuales para noticias de diáspora/exilio
 */
const EXILIO_VARIANTS = [
  { 
    id: 'comunidad',
    desc: 'Reunión comunitaria en centro vecinal: sillas plegables dispuestas en círculo, personas conversando, manos gesticulando. Espacio interior simple y limpio, sin carteles legibles.',
    lighting: 'luz suave interior',
    angle: 'medium shot',
    composition: 'rule of thirds'
  },
  { 
    id: 'vigilia',
    desc: 'Vigilia nocturna: manos sosteniendo velas encendidas, llamas titilantes, ambiente respetuoso. Fondo urbano difuminado con luces bokeh. Enfoque en gestos, no en rostros.',
    lighting: 'golden hour tardío',
    angle: 'close-up de manos',
    composition: 'centro simétrico'
  },
  { 
    id: 'solidaridad',
    desc: 'Mesa de solidaridad: cajas de donativos apiladas, voluntarios clasificando artículos, brazaletes o cintas azules. Ambiente organizado y activo, sin logos ni marcas.',
    lighting: 'luz natural suave',
    angle: 'wide shot',
    composition: 'rule of thirds'
  },
  { 
    id: 'radio',
    desc: 'Estudio de radio/podcast: micrófonos genéricos en brazo articulado, espuma acústica en paredes, auriculares sobre mesa. Ambiente profesional neutro, sin logos ni identificadores.',
    lighting: 'iluminación LED suave',
    angle: 'over-the-shoulder',
    composition: 'centro simétrico'
  },
  { 
    id: 'calle',
    desc: 'Calle de la diáspora: arquitectura tropical genérica con palmeras, fachadas color pastel, balcones con hierro forjado. Estilo Miami sin rótulos comerciales legibles. Acera amplia, cielo despejado.',
    lighting: 'golden hour',
    angle: 'wide shot',
    composition: 'punto de fuga central'
  },
  { 
    id: 'mapa',
    desc: 'Mapa simbólico estilizado: ilustración minimalista sin texto mostrando Cuba y Florida, dos pins conectados por línea punteada. Estilo infográfico limpio, colores neutros azul y beige.',
    lighting: 'iluminación plana',
    angle: 'cenital',
    composition: 'centro simétrico'
  },
  { 
    id: 'aeropuerto',
    desc: 'Sala de aeropuerto: área de llegadas/partidas con maletas, abrazos emotivos de espaldas a cámara, ventanales con aviones difuminados. Sin pantallas de vuelos legibles. Ambiente cálido y humano.',
    lighting: 'luz natural de ventanales',
    angle: 'medium shot',
    composition: 'rule of thirds'
  },
  { 
    id: 'hogar',
    desc: 'Escena de hogar y memoria: mesa con álbum de fotos abierto (sin rostros identificables), taza de café humeante, elemento decorativo con colores de Cuba muy discreto. Luz cálida, ambiente íntimo.',
    lighting: 'luz dorada de lámpara',
    angle: 'close-up de mesa',
    composition: 'centro con bokeh'
  },
  { 
    id: 'marcha',
    desc: 'Marcha pacífica: grupo caminando en misma dirección con pancartas sin texto legible, enfoque en gestos y postura corporal. Vista desde atrás o lateral, rostros no identificables.',
    lighting: 'nublado suave',
    angle: 'wide shot desde atrás',
    composition: 'punto de fuga'
  },
  { 
    id: 'mural',
    desc: 'Arte urbano: muro con mural abstracto inspirado en colores cubanos (azul, blanco, rojo) sin texto ni símbolos obvios. Personas conversando frente al mural, de espaldas o perfil lejano.',
    lighting: 'luz natural directa',
    angle: 'medium shot',
    composition: 'rule of thirds'
  }
];

/**
 * Genera un hash simple de un string para selección determinista
 * @param {string} str - String para hashear
 * @returns {number} Hash numérico
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** @fix: Generar IA encadenado con ImageThemeEngine — 2025-11 */
// ========== HELPERS SIMPLIFICADOS ==========

/**
 * Genera descripción visual usando LLM basándose en el contexto completo de la noticia
 * El LLM extrae la esencia visual sin mencionar nombres de personas reales
 * @param {Object} params - { titulo, bajada, contenido, etiquetas, model }
 * @returns {Promise<string>} Descripción visual lista para usar como prompt de imagen
 */
async function generateVisualBrief({ titulo, bajada, contenido, etiquetas = [], model = 'claude-3-5-sonnet-20241022' }) {
  const systemPrompt = `Eres un director de arte especializado en ilustraciones de noticias.
Debes crear una descripción visual para una portada de artículo en estilo cómic editorial.

Analiza el siguiente contenido periodístico y describe una sola escena visual que capture el mensaje central de la noticia.
Usa el contexto real de la noticia, incluyendo países, ciudades o elementos geográficos relevantes cuando sea necesario para que la imagen tenga sentido.
La escena debe reflejar la situación social o política del artículo, usando elementos representativos (por ejemplo, arquitectura local, símbolos culturales, elementos climáticos, tecnología, escenarios reales, etc.).

**Instrucciones de estilo:**
- Estilo: cómic editorial / novela gráfica moderna.
- Composición: clara, expresiva, con colores vivos y líneas marcadas.
- Personajes: genéricos cuando aparezcan, sin identificación de personas reales específicas.
- No debe contener texto legible, logotipos ni palabras visibles.
- Usa el contexto geográfico y cultural del artículo para crear una imagen relevante y situada.

Devuelve solo la descripción de la escena en español, lista para usar como prompt de imagen.`;

  const userPrompt = `Contenido:
"""
${titulo || ''}
${bajada || ''}
${contenido || ''}
Palabras clave: ${etiquetas.join(', ')}
"""

Devuelve solo la descripción de la escena visual:`;

  try {
    const result = await callLLM({
      model,
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.5,
      timeoutMs: 15000
    });
    const visualBrief = result.text;

    console.log(`[Redactor:VisualBrief] Generado (${visualBrief.length} chars): "${visualBrief.substring(0, 120)}..."`);
    
    return visualBrief;
  } catch (error) {
    console.error(`[Redactor:VisualBrief] Error: ${error.message}`);
    // Fallback: usar título directamente
    return `Ilustración editorial estilo cómic sobre: ${titulo}`;
  }
}

/**
 * Limpia texto Markdown a texto plano simple
 * @param {string} markdown - Texto en formato Markdown
 * @param {number} maxLength - Longitud máxima del resultado
 * @returns {string} Texto plano limpio
 */
function stripMarkdownToPlainText(markdown, maxLength = 3000) {
  if (!markdown || typeof markdown !== 'string') return '';
  
  let text = markdown
    // Eliminar bloques de código
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Eliminar encabezados
    .replace(/^#{1,6}\s+/gm, '')
    // Eliminar énfasis
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Eliminar enlaces [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Eliminar imágenes ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Eliminar listas
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Eliminar blockquotes
    .replace(/^>\s+/gm, '')
    // Eliminar líneas horizontales
    .replace(/^[-*_]{3,}$/gm, '')
    // Normalizar espacios
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Recortar a longitud máxima
  if (text.length > maxLength) {
    text = text.substring(0, maxLength);
    // Intentar cortar en el último punto para no dejar frases incompletas
    const lastPeriod = text.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.8) {
      text = text.substring(0, lastPeriod + 1);
    }
  }
  
  return text;
}

/**
 * Image Prompt Builder contextual v2
 * Construye prompt de imagen usando contexto completo del draft
 * @param {Object} draft - Borrador con título, bajada, contenido, tags, categoría
 * @param {Object} topic - Topic asociado (opcional, para fuentes)
 * @param {Object} opts - Opciones { titleOnly, forceGeneric }
 * @returns {Promise<Object>} { prompt, negative, locale, style, context, signals, themeResult }
 */
async function buildImagePromptFromDraft(draft, topic = null, opts = {}) {
  console.log('[ImagePromptV2] 🎨 Construyendo prompt contextual desde draft');
  
  // ========== SISTEMA IIF (Image Instruction Format) ==========
  // Si IIF está habilitado, usar el sistema estructurado
  const useIIF = process.env.IMG_USE_IIF !== 'false'; // Default: true
  
  if (useIIF) {
    console.log('[ImagePromptV2:IIF] ✨ Usando sistema IIF (Image Instruction Format)');
    
    try {
      // Normalizar datos para IIF
      const title = (draft.titulo || draft.title || '').trim();
      const summary = (draft.bajada || draft.excerpt || '').trim();
      const rawContent = draft.contenidoMarkdown || draft.contenido_markdown || draft.content || '';
      const cleanContent = stripMarkdownToPlainText(rawContent, 3000);
      let tags = draft.etiquetas || draft.tags || [];
      if (Array.isArray(tags)) {
        tags = tags.filter(t => t && typeof t === 'string' && t.trim()).slice(0, 5);
      } else {
        tags = [];
      }
      const category = (draft.categoria || draft.category || '').trim();
      const sources = topic?.fuentesTop || draft?.fuentes || [];
      
      // Construir IIF
      const iif = buildImageInstructionFormat({
        title,
        summary,
        content: cleanContent,
        tags,
        category,
        sources
      }, { forceTheme: opts.forceTheme });
      
      // Convertir IIF a prompt final
      const iifResult = convertIIFtoPrompt(iif, {
        includeTitle: true,
        maxLength: 900
      });
      
      // Combinar con promptsImagen.principal si existe
      let finalPrompt = iifResult.prompt;
      const semanticBase = draft.promptsImagen?.principal?.trim();
      if (semanticBase && semanticBase.length > 0) {
        console.log(`[ImagePromptV2:IIF] semantic_base="${semanticBase.substring(0, 80)}..." (prepending)`);
        finalPrompt = `${semanticBase}. ${finalPrompt}`;
        if (finalPrompt.length > 1000) {
          finalPrompt = finalPrompt.substring(0, 1000);
        }
      }
      
      console.log(`[ImagePromptV2:IIF] ✅ IIF prompt generado: ${finalPrompt.length} chars`);
      console.log(`[ImagePromptV2:IIF] negative: ${iifResult.negative.split(',').length} items`);
      
      // Convertir a formato legacy para compatibilidad
      const legacyFormat = convertIIFtoLegacyFormat(iif);
      legacyFormat.prompt = finalPrompt;
      legacyFormat.negative = iifResult.negative;
      
      return legacyFormat;
      
    } catch (iifError) {
      console.error(`[ImagePromptV2:IIF] Error en sistema IIF: ${iifError.message}`);
      console.log('[ImagePromptV2:IIF] 🔄 Fallback a sistema legacy');
      // Continuar con sistema legacy si IIF falla
    }
  }
  
  // ========== SISTEMA LEGACY (fallback o si IIF deshabilitado) ==========
  console.log('[ImagePromptV2:Legacy] Usando sistema legacy');
  
  try {
    // 1. Normalizar signals
    const title = (draft.titulo || draft.title || '').trim();
    const summary = (draft.bajada || draft.excerpt || '').trim();
    
    // Limpiar contenido Markdown a texto plano y recortar
    const rawContent = draft.contenidoMarkdown || draft.contenido_markdown || draft.content || '';
    const cleanContent = stripMarkdownToPlainText(rawContent, 3000);
    
    // Normalizar y recortar tags a máximo 5
    let tags = draft.etiquetas || draft.tags || [];
    if (Array.isArray(tags)) {
      tags = tags
        .filter(t => t && typeof t === 'string' && t.trim())
        .slice(0, 5);
    } else {
      tags = [];
    }
    
    const category = (draft.categoria || draft.category || '').trim();
    
    console.log(`[ImagePromptV2] title="${title.substring(0, 60)}..." category="${category}" tags=[${tags.slice(0, 3).join(', ')}]`);
    console.log(`[ImagePromptV2] content_length=${cleanContent.length}chars summary_length=${summary.length}chars`);
    
    // 2. Detectar país y contexto
    const sources = topic?.fuentesTop || draft?.fuentes || [];
    const countryDetection = detectCountry({ title, summary, tags, sources });
    const country = countryDetection.country;
    
    if (country) {
      console.log(`[ImagePromptV2] country="${country}" detected`);
    }
    
    // 3. Construir signals para ImageThemeEngine
    const signals = {
      title,
      summary,
      content: cleanContent,
      tags,
      category,
      country,
      entities: tags, // Por ahora reutilizamos tags como entidades
      timeContext: null
    };
    
    // 4. Usar ImageThemeEngine para detectar tema
    const engine = new ImageThemeEngine({
      disasterThreshold: parseFloat(process.env.IMG_THEME_DISASTER_THRESHOLD) || 0.75,
      keywordsThreshold: parseInt(process.env.IMG_THEME_KEYWORDS_THRESHOLD) || 2
    });
    
    const themeResult = engine.deriveTheme(signals);
    
    console.log(`[ImagePromptV2] theme="${themeResult.contextId}" disaster=${themeResult.disaster} confidence=${themeResult.confidence.toFixed(2)}`);
    console.log(`[ImagePromptV2] keywords=[${themeResult.keywords.slice(0, 5).join(', ')}]`);
    
    // 5. Construir prompt desde plantillas
    const promptData = buildPrompt(themeResult, signals);
    
    let finalPrompt = promptData.prompt;
    const negative = promptData.negative;
    const locale = promptData.locale || 'es-CU';
    const style = promptData.style || 'news_photojournalism';
    const context = promptData.context || {};
    
    // 6. Combinar con promptsImagen.principal si existe
    const semanticBase = draft.promptsImagen?.principal?.trim();
    if (semanticBase && semanticBase.length > 0) {
      console.log(`[ImagePromptV2] semantic_base="${semanticBase.substring(0, 80)}..." (prepending)`);
      finalPrompt = `${semanticBase}. ${finalPrompt}`;
    }
    
    // Limitar longitud total
    if (finalPrompt.length > 1000) {
      finalPrompt = finalPrompt.substring(0, 1000);
    }
    
    console.log(`[ImagePromptV2] prompt_preview="${finalPrompt.substring(0, 150)}..."`);
    console.log(`[ImagePromptV2] negative="${negative.substring(0, 100)}"`);
    console.log(`[ImagePromptV2] locale="${locale}" style="${style}"`);
    
    return {
      prompt: finalPrompt.trim(),
      negative,
      locale,
      style,
      context: {
        ...context,
        category,
        tags,
        country,
        contextId: themeResult.contextId,
        disaster: themeResult.disaster
      },
      signals,
      themeResult
    };
    
  } catch (error) {
    console.error(`[ImagePromptV2] Error construyendo prompt contextual: ${error.message}`);
    console.error(`[ImagePromptV2] Stack: ${error.stack}`);
    throw error;
  }
}

// ========== FUNCIÓN PRINCIPAL ==========

/**
 * SISTEMA CONTEXTUAL - Generación de imágenes específicas al tema
 * Pipeline: Bajada + Contenido + Título + Categoría + Tags → Prompt contextual → DALL·E 3
 * 
 * USA: bajada (prioridad), contenido, título, categoría, tags
 * EVITA: patrones genéricos repetitivos (ej: "mujer damnificada en calles destruidas")
 * GENERA: covers específicos al tema real de cada noticia
 */
async function generateImages(prompts, config, topic, draft, draftId, mode = 'auto', opts = {}) {
  const { buildNeoRenaissancePrompt } = require('./promptTemplates');
  const { generateWithProvider } = require('./imageProvider');
  const { calculateImageCost, logCost } = require('./statsService');
  
  const images = {};
  const provider = config.imageProvider || 'dall-e-3';
  const startTime = Date.now();
  const customPrompt = opts.customPrompt;
  
  try {
    // Si hay customPrompt, usarlo directamente
    let prompt, neoMode;
    
    if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
      // MODO CUSTOM: Usar prompt manual del usuario
      prompt = customPrompt.trim();
      neoMode = 'custom_manual';
      
      console.log('[Redactor:Custom] 🎨 Usando PROMPT MANUAL del usuario');
      console.log(`[Redactor:Custom] Prompt (${prompt.length} chars): "${prompt.substring(0, 100)}..."`);
    } else {
      // MODO AUTOMÁTICO: Pipeline contextual
      console.log('[Redactor:Contextual] 🎨 Pipeline contextual - Bajada + Contenido + Título → Prompt específico');
      
      // Extraer título
      const title = draft?.titulo || draft?.title || topic?.tituloSugerido || '';
      
      if (!title || title.trim().length === 0) {
        console.warn('[Redactor:Contextual] ⚠️ Sin título, no se puede generar imagen');
        return images;
      }
      
      console.log(`[Redactor:Contextual] 📰 Título: "${title.substring(0, 80)}${title.length > 80 ? '...' : ''}"`);
      
      // Extraer contexto completo: bajada, contenido, categoría, tags
      const bajada = draft?.bajada || draft?.excerpt || '';
      const content = draft?.contenido || draft?.contenidoMarkdown || draft?.content || '';
      const category = draft?.categoria || draft?.category || '';
      const tags = draft?.etiquetas || draft?.tags || [];
      
      console.log(`[Redactor:Contextual] Contexto: bajada=${!!bajada} content=${content.length}chars category="${category}" tags=${tags.length}`);
      
      // Construir prompt contextual (detecta automáticamente si es político y genera prompt específico)
      const promptResult = buildNeoRenaissancePrompt(title, {
        bajada,
        content,
        category,
        tags
      });
      
      prompt = promptResult.prompt;
      neoMode = promptResult.mode;
      
      console.log(`[Redactor:Contextual] ✅ Prompt generado (${prompt.length} chars)`);
      console.log(`[Redactor:Contextual] mode=${neoMode}`);
    }
    
    // ============ GENERAR IMAGEN: MODO CUSTOM vs CONTEXTUAL ============
    let result;
    
    if (customPrompt) {
      // MODO CUSTOM_PROMPT: Prompt manual del usuario sin modificaciones
      // Solo se pasa el prompt crudo, sin title/summary/category
      console.log('[Redactor:Custom] 📤 Enviando prompt CRUDO al proveedor (sin contexto adicional)');
      
      result = await generateWithProvider({
        provider,
        mode: 'custom_prompt', // ← Modo específico para prompt manual
        draftId,
        topic: null, // No se necesita topic en modo custom
        draft: null, // No se necesita draft en modo custom
        prompt, // ← Prompt del usuario SIN MODIFICAR (solo trim aplicado antes)
        title: '', // Vacío en modo custom
        summary: '', // Vacío en modo custom
        category: '', // Vacío en modo custom
        _imageContext: {
          theme: 'custom_manual',
          mode: 'custom_manual',
          style: 'custom',
          isCustomPrompt: true, // Flag para identificar fácilmente
          locale: 'es-CU'
        }
      });
    } else {
      // MODO CONTEXTUAL: Pipeline automático con builder
      const title = draft?.titulo || draft?.title || topic?.tituloSugerido || '';
      const bajada = draft?.bajada || draft?.excerpt || '';
      const category = draft?.categoria || draft?.category || '';
      
      result = await generateWithProvider({
        provider,
        mode: 'synthesize_from_context',
        draftId,
        topic,
        draft,
        prompt,
        title,
        summary: bajada,
        category,
        _imageContext: {
          theme: 'contextual',
          mode: neoMode,
          style: 'contextual_editorial',
          isDisaster: false,
          confidence: 1.0,
          reasons: ['contextual_system'],
          keywords: [],
          locale: 'es-CU',
          negativePrompt: '',
          category: '',
          tags: [],
          entities: [],
          country: null
        }
      });
    }
    
    // Definir logPrefix ANTES del bloque if/else para evitar "logPrefix is not defined"
    const logPrefix = customPrompt ? '[Redactor:Custom]' : '[Redactor:Contextual]';
    
    if (result.ok) {
      const finalProvider = result.provider || provider;
      console.log(`${logPrefix} ✅ Imagen generada: provider=${finalProvider}`);
      
      // Calcular y registrar costo
      const imageCost = calculateImageCost(finalProvider);
      await logCost({
        type: 'image',
        costUSD: imageCost,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider: finalProvider,
          mode: neoMode,
          duration: Date.now() - startTime,
          success: true
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
      
      console.log(`[StatsService] Costo imagen: $${imageCost.toFixed(2)} (${finalProvider})`);
      
      // Preparar estructura de retorno
      images.provider = finalProvider;
      
      if (result.b64) {
        images.principal_b64 = result.b64;
        images.kind = 'ai';
        images.imageKind = 'ai';
        images.usedSource = false;
        images.referenceUrl = null;
        
        // Metadata contextual o custom
        images.imageMeta = {
          variant: customPrompt ? 'custom_manual' : 'contextual',
          provider: finalProvider,
          mode: neoMode,
          style: customPrompt ? 'custom' : 'contextual_editorial',
          likeness: false,
          reference: null,
          context: customPrompt ? 'custom_manual' : 'contextual',
          contextKeywords: [],
          country: null,
          economicLevel: 'neutral'
        };
        
        console.log(`${logPrefix} Imagen base64 generada (${(result.b64.length / 1024).toFixed(1)}KB)`);
      } else if (result.url) {
        images.principal_url = result.url;
        images.coverUrl = result.coverUrl;
        images.coverFallbackUrl = result.coverFallbackUrl;
        images.coverHash = result.coverHash;
        images.kind = result.kind || 'ai';
        images.imageKind = result.kind || 'ai';
        
        console.log(`${logPrefix} Imagen URL generada: ${result.url}`);
      }
    } else {
      console.warn(`${logPrefix} ❌ Error: ${result.error || 'unknown'}`);
      
      // Registrar fallo
      await logCost({
        type: 'image',
        costUSD: 0,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider,
          duration: Date.now() - startTime,
          success: false
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
    }
  } catch (error) {
    const errorPrefix = customPrompt ? '[Redactor:Custom]' : '[Redactor:Contextual]';
    
    // ⚠️ MANEJO ESPECÍFICO: Error NO_IMAGE_URL / HAILUO_NO_IMAGE_URL del proveedor
    if ((error.code === 'NO_IMAGE_URL' || error.code === 'HAILUO_NO_IMAGE_URL') && customPrompt) {
      console.warn(`${errorPrefix} ⚠️ Proveedor no devolvió URL de imagen (${error.code}).`, {
        provider: error.provider,
        message: error.message,
        details: error.details,
        httpStatus: error.httpStatus
      });
      
      // Registrar como fallo del proveedor (no error técnico)
      await logCost({
        type: 'image',
        costUSD: 0,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider: error.provider || config.imageProvider,
          duration: Date.now() - startTime,
          success: false,
          errorCode: error.code,
          reason: 'provider_rejected_prompt'
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
      
      // Re-lanzar con mensaje del error original (más específico para Hailuo)
      throw new Error(error.message || 'El proveedor de imágenes no pudo generar una imagen para este prompt. Prueba con una descripción menos explícita o más neutral.');
    }
    
    // ⚠️ MANEJO ESPECÍFICO: Error NO_IMAGE_DATA del proveedor (OpenAI/DALL-E)
    if (error.code === 'NO_IMAGE_DATA' && customPrompt) {
      console.warn(`${errorPrefix} ⚠️ Proveedor no devolvió imagen base64 (NO_IMAGE_DATA).`, {
        provider: error.provider,
        message: error.message
      });
      
      // Registrar como fallo del proveedor (no error técnico)
      await logCost({
        type: 'image',
        costUSD: 0,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider: error.provider || config.imageProvider,
          duration: Date.now() - startTime,
          success: false,
          errorCode: 'NO_IMAGE_DATA',
          reason: 'provider_no_image_data'
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
      
      // Re-lanzar con mensaje amigable
      throw new Error('El proveedor de imágenes no devolvió una imagen válida. Por favor, intenta nuevamente.');
    }
    
    // ⚠️ MANEJO ESPECÍFICO: Violación de política de contenido (OpenAI)
    if (error.code === 'CONTENT_POLICY_VIOLATION' && customPrompt) {
      console.warn(`${errorPrefix} ⚠️ Contenido bloqueado por política del proveedor (CONTENT_POLICY_VIOLATION).`, {
        provider: error.provider,
        message: error.message,
        originalError: error.originalError
      });
      
      // Registrar como fallo del proveedor (no error técnico)
      await logCost({
        type: 'image',
        costUSD: 0,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider: error.provider || config.imageProvider,
          duration: Date.now() - startTime,
          success: false,
          errorCode: 'CONTENT_POLICY_VIOLATION',
          reason: 'content_policy_violation'
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
      
      // Re-lanzar el mensaje del error (ya es amigable)
      throw error;
    }
    
    // Otros errores: log y registro normal
    console.error(`${errorPrefix} ❌ Error generando imagen:`, error.message);
    
    // Registrar error
    await logCost({
      type: 'image',
      costUSD: 0,
      draftId: draftId !== topic?.idTema ? draftId : null,
      topicId: topic?.idTema,
      metadata: {
        provider: config.imageProvider || 'dall-e-3',
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error.message
      },
      tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
    });
  }
  
  return images;
}

/**
 * @deprecated - Legacy function kept for compatibility
 * Old titleOnly mode - now handled by Neo-Renaissance system
 */
async function generateImagesLegacyTitleOnly(prompts, config, topic, draft, draftId, mode = 'auto', opts = {}) {
  if (opts.titleOnly) {
    console.log('[Redactor:TitleOnly] 🎯 MODO TÍTULO-ONLY ACTIVO - Generando descripción visual con LLM');
    
    const OpenAI = require('openai');
    
    const provider = config.imageProvider || 'dall-e-3';
    
    // ✅ Early return para proveedores no-DALL-E
    if (provider === 'hailuo' || provider === 'stable-diffusion' || provider === 'midjourney') {
      console.log(`[Redactor:TitleOnly] Provider ${provider} no soportado en legacy mode, delegando a generateWithProvider`);
      const { generateWithProvider } = require('./imageProvider');
      
      const visualBrief = await generateVisualBrief({
        titulo: draft.titulo || draft.title || '',
        bajada: draft.bajada || draft.excerpt || '',
        contenido: draft.contenido_markdown || draft.content || '',
        etiquetas: draft.etiquetas || draft.tags || [],
        model: config.llmModel || 'claude-3-5-sonnet-20241022'
      });
      
      const prompt = `${visualBrief}. Estilo: ilustración editorial tipo cómic / novela gráfica moderna, con colores vivos y líneas marcadas.`;
      
      const result = await generateWithProvider({
        provider,
        prompt,
        title: draft.titulo || draft.title || '',
        summary: draft.bajada || draft.excerpt || '',
        category: draft.categoria || draft.category || '',
        draftId,
        topic,
        draft,
        mode: 'synthesize_from_context'
      });
      
      if (result.ok && result.b64) {
        return {
          principal_b64: result.b64,
          provider,
          kind: 'ai',
          imageKind: 'ai',
          titleOnly: true
        };
      }
      
      throw new Error(result.error || 'Error generando imagen con proveedor no-DALL-E');
    }
    
    // 🔹 Usar LLM para generar descripción visual basada en contexto completo
    const visualBrief = await generateVisualBrief({
      titulo: draft.titulo || draft.title || '',
      bajada: draft.bajada || draft.excerpt || '',
      contenido: draft.contenido_markdown || draft.content || '',
      etiquetas: draft.etiquetas || draft.tags || [],
      model: config.llmModel || 'claude-3-5-sonnet-20241022'
    });
    
    // 🔹 Usar descripción visual como prompt, añadiendo estilo editorial
    const prompt = `${visualBrief}. Estilo: ilustración editorial tipo cómic / novela gráfica moderna, con colores vivos y líneas marcadas.`;
    
    // 🔹 Negative mínimo: solo texto, logos, marcas
    const negative = [
      'watermark',
      'logo',
      'text',
      'letters',
      'caption',
      'meme',
      'infographic'
    ].join(', ');
    
    console.log(`[Redactor:TitleOnly] 🎨 Visual brief generado por LLM`);
    console.log(`[Redactor:TitleOnly] prompt="${prompt.substring(0, 150)}..."`);
    console.log(`[Redactor:TitleOnly] negative="${negative}"`);
    
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
      
      // Configuración base
      const imageConfig = {
        model: provider,
        prompt: `${prompt}\n\nNEGATIVE: ${negative}`,
        size: provider === 'dall-e-3' ? '1792x1024' : '1024x1024',
        n: 1,
        response_format: 'b64_json',
      };
      
      // Solo DALL-E 3 soporta el parámetro 'quality'
      if (provider === 'dall-e-3') {
        imageConfig.quality = 'standard';
      }
      
      let response;
      try {
        response = await openai.images.generate(imageConfig);
      } catch (firstError) {
        // Si es error 400 (content filter), intentar con prompt más genérico
        if (firstError.status === 400 && firstError.code === 'content_policy_violation') {
          console.log(`[Redactor:TitleOnly] ⚠️ Bloqueado por filtros OpenAI, reintentando con prompt más genérico`);
          
          // Fallback simple: solo estilo, sin detalles del titular
          const fallbackPrompt = 'Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. Escena periodística con personajes y ambiente expresivos, contornos marcados y colores vivos.';
          
          console.log(`[Redactor:TitleOnly] Fallback prompt="${fallbackPrompt}"`);
          
          imageConfig.prompt = `${fallbackPrompt}\n\nNEGATIVE: ${negative}`;
          response = await openai.images.generate(imageConfig);
        } else {
          throw firstError;
        }
      }
      
      const b64 = response.data?.[0]?.b64_json;
      
      if (!b64) {
        throw new Error('No se recibió imagen en la respuesta');
      }
      
      console.log(`[Redactor:TitleOnly] ✅ Imagen generada exitosamente (${(b64.length / 1024).toFixed(1)}KB)`);
      
      // Retornar estructura correcta (no anidada en images)
      return {
        principal_b64: b64,
        provider,
        kind: 'ai',
        imageKind: 'ai',
        titleOnly: true
      };
    } catch (error) {
      console.error(`[Redactor:TitleOnly] Error: ${error.message}`);
      throw error;
    }
  }
  
  // ========== PIPELINE SIMPLE: BYPASS PARA GENERACIÓN AUTOMÁTICA ==========
  const { isSimpleMode } = require('../../config/image');
  
  if (isSimpleMode()) {
    console.log('[Redactor:AutoImage] 🚀 MODO SIMPLE ACTIVO - Pipeline mínimo automático');
    
    const { buildSimplePrompt } = require('./simpleImageService');
    const { sanitizeImagePrompt, hasSensitiveContent, getSymbolicFallbackPrompt, getGenericFallbackPrompt } = require('../utils/sanitizeImagePrompt');
    const OpenAI = require('openai');
    
    const provider = config.imageProvider || 'dall-e-3';
    
    // ✅ Early return para proveedores no-DALL-E (hailuo, stable-diffusion, etc.)
    if (provider === 'hailuo' || provider === 'stable-diffusion' || provider === 'midjourney') {
      console.log(`[Redactor:AutoImage] Provider ${provider} detectado, delegando a generateWithProvider`);
      const { generateWithProvider } = require('./imageProvider');
      
      const images = {};
      const startTime = Date.now();
      
      try {
        const result = await generateWithProvider({
          provider,
          prompt: '', // Se generará internamente
          title: draft.titulo || draft.title || '',
          summary: draft.bajada || draft.excerpt || '',
          category: draft.categoria || draft.category || '',
          draftId,
          topic,
          draft,
          mode: 'synthesize_from_context'
        });
        
        if (result.ok && result.b64) {
          images.principal_b64 = result.b64;
          images.provider = provider;
          images.kind = 'ai';
          images.imageKind = 'ai';
          
          console.log(`[Redactor:AutoImage] ✅ Imagen generada con ${provider} (base64, ${(result.b64.length / 1024).toFixed(1)}KB)`);
          
          return images;
        }
        
        throw new Error(result.error || `Error generando imagen con ${provider}`);
      } catch (error) {
        console.error(`[Redactor:AutoImage] Error con ${provider}: ${error.message}`);
        throw error;
      }
    }
    const images = {};
    const startTime = Date.now();
    const locale = 'es-CU';
    
    try {
      // Construir prompt (con sanitización si es necesario)
      let prompt;
      const fullText = `${draft.titulo} ${draft.bajada}`;
      
      if (hasSensitiveContent(fullText)) {
        console.log('[Redactor:AutoImage] Contenido sensible detectado, aplicando sanitización');
        const sanitizedPrompt = sanitizeImagePrompt({
          title: draft.titulo,
          lead: draft.bajada,
          category: draft.categoria,
          tags: draft.etiquetas,
          locale,
          isEditorial: false
        });
        prompt = sanitizedPrompt || buildSimplePrompt(draft);
      } else {
        prompt = buildSimplePrompt(draft);
      }
      
      console.log(`[Redactor:AutoImage] prompt="${prompt.substring(0, 120)}..."`);
      
      // Invocar DALL-E con fallback automático
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
      
      const attemptsList = [
        { level: 'A', prompt, label: 'original/sanitizado' }
      ];
      
      let lastError = null;
      
      for (const attempt of attemptsList) {
        try {
          if (attempt.level !== 'A') {
            console.log(`[ImageSafety] retry=${attempt.level} (${attempt.label})`);
          }
          
          const response = await openai.images.generate({
            model: provider,
            prompt: attempt.prompt,
            size: provider === 'dall-e-3' ? '1792x1024' : '1024x1024',
            quality: 'standard',
            n: 1,
            response_format: 'b64_json',
          });
          
          const b64 = response.data?.[0]?.b64_json;
          
          if (b64) {
            images.principal_b64 = b64;
            images.provider = provider;
            images.kind = 'ai';
            images.imageKind = 'ai';
            images.usedLevel = attempt.level;
            
            if (attempt.level !== 'A') {
              console.log(`[Redactor:AutoImage] ⚠️ Imagen generada con fallback nivel ${attempt.level}`);
            }
            
            console.log(`[Redactor:AutoImage] ✅ Imagen generada (base64, ${(b64.length / 1024).toFixed(1)}KB)`);
            break;
          }
        } catch (attemptError) {
          lastError = attemptError;
          
          // Si es error 400 (safety) y es el primer intento, agregar fallbacks
          if ((attemptError.status === 400 || attemptError.code === 'content_policy_violation') && attempt.level === 'A' && attemptsList.length === 1) {
            console.log('[ImageSafety] Error 400 detectado, agregando fallbacks');
            attemptsList.push(
              { level: 'B', prompt: getSymbolicFallbackPrompt(locale), label: 'simbólico' },
              { level: 'C', prompt: getGenericFallbackPrompt(locale), label: 'genérico' }
            );
          }
        }
      }
      
      if (!images.principal_b64 && lastError) {
        console.error(`[Redactor:AutoImage] Error después de todos los intentos: ${lastError.message}`);
      }
      
      return { images, duration: Date.now() - startTime };
    } catch (error) {
      console.error(`[Redactor:AutoImage] Error: ${error.message}`);
      return { images: {}, duration: 0 };
    }
  }
  
  // ========== PIPELINE AUGMENTED (LEGACY) ==========
  console.log('[Redactor:AutoImage] Pipeline AUGMENTED activo (modo completo)');
  
  const images = {};
  const provider = config.imageProvider || 'dall-e-3';
  const startTime = Date.now();

  console.log(`[Redactor] Generando imagen con proveedor: ${provider}, mode: ${mode}`);

  try {
    // ========== PASO 1: INTENTAR IMAGEN EDITORIAL (persona real) ==========
    const enableEditorial = process.env.IMG_USE_EDITORIAL_COVER !== 'false'; // Default true
    
    if (enableEditorial) {
      console.log('[Redactor] Intentando modo editorial (persona real)...');
      
      // Detectar persona principal
      const personDetection = detectPrimaryPerson({
        title: draft?.titulo || topic?.tituloSugerido || '',
        lead: draft?.bajada || topic?.resumenBreve || '',
        tags: draft?.etiquetas || [],
        content: draft?.contenidoMarkdown || ''
      });
      
      if (personDetection.isPerson && personDetection.confidence >= 60) {
        console.log(`[Redactor:Editorial] Persona detectada: "${personDetection.primaryPerson}" (confidence=${personDetection.confidence})`);
        
        // Buscar imagen editorial
        const editorialImage = await resolveEditorialImage({
          name: personDetection.primaryPerson,
          contextKeywords: draft?.etiquetas || [],
          country: 'Cuba', // Contexto editorial
          role: null
        });
        
        if (editorialImage) {
          console.log(`[Redactor:Editorial] ✅ Hit editorial: ${editorialImage.provider}`);
          
          // Descargar y guardar imagen editorial
          const localPath = await downloadEditorialImage(editorialImage.imageUrl, draftId);
          
          if (localPath) {
            // Registrar costo (editorial = gratis, solo bandwidth)
            await logCost({
              type: 'image',
              provider: 'editorial',
              model: editorialImage.provider,
              inputTokens: 0,
              outputTokens: 0,
              cost: 0,
              metadata: {
                draftId,
                person: personDetection.primaryPerson,
                source: editorialImage.provider,
                license: editorialImage.license
              }
            });
            
            // Estructura compatible con el resto del pipeline
            images.principal_url = localPath;
            images.coverUrl = localPath;
            images.kind = 'editorial';
            images.imageKind = 'editorial';
            images.provider = editorialImage.provider;
            
            // Metadatos de imagen editorial
            images.imageMeta = {
              variant: 'editorial',
              provider: editorialImage.provider,
              editorialPerson: personDetection.primaryPerson,
              editorialSource: editorialImage.sourceUrl,
              editorialLicense: editorialImage.license,
              editorialProvider: editorialImage.provider,
              context: 'person-editorial',
              likeness: false, // No es likeness IA, es foto real
              contextKeywords: []
            };
            
            console.log(`[Redactor:Editorial] ✅ Imagen editorial guardada: ${localPath}`);
            console.log(`[Redactor:Editorial] person="${personDetection.primaryPerson}" editorialHit=true provider=${editorialImage.provider} license=${editorialImage.license} fallback=none`);
            
            return { images, duration: Date.now() - startTime };
          } else {
            console.warn('[Redactor:Editorial] Fallo al descargar imagen editorial → fallback a IA');
          }
        } else {
          console.log(`[Redactor:Editorial] No se encontró imagen editorial para "${personDetection.primaryPerson}" → fallback a IA`);
          console.log(`[Redactor:Editorial] person="${personDetection.primaryPerson}" editorialHit=false fallback=ai`);
        }
      } else {
        console.log(`[Redactor:Editorial] No se detectó persona con suficiente confianza → modo IA genérico`);
      }
    }
    
    // ========== PASO 2: PIPELINE IA (fallback o modo primario) ==========
    // Usar Image Prompt Builder contextual v2
    let themeResult, finalPrompt, finalNegative, signals;
    let locale = 'es-CU'; // Default locale
    let style = 'news_photojournalism'; // Default style
    let promptContext = null; // Default context
    
    try {
      // Intentar construir prompt contextual usando el nuevo builder
      const promptBundle = await buildImagePromptFromDraft(draft, topic, opts);
      
      finalPrompt = promptBundle.prompt;
      finalNegative = promptBundle.negative;
      locale = promptBundle.locale;
      style = promptBundle.style;
      promptContext = promptBundle.context;
      signals = promptBundle.signals;
      themeResult = promptBundle.themeResult;
      
      console.log('[Redactor:Image] ✅ Prompt contextual v2 generado exitosamente');
      
    } catch (builderError) {
      // Fallback: usar sanitizeImagePrompt si el builder falla
      console.warn(`[Redactor:Image] Builder contextual falló: ${builderError.message}`);
      console.log('[Redactor:Image] 🔄 Fallback a sanitizeImagePrompt');
      
      const title = draft?.titulo || topic?.tituloSugerido || '';
      finalPrompt = sanitizeImagePrompt({ title, locale: 'es-CU' });
      finalNegative = 'text, letters, logos, watermarks, readable signage';
      locale = 'es-CU';
      style = 'news_photojournalism';
      
      // Construir signals mínimos para compatibilidad
      signals = {
        title,
        summary: draft?.bajada || topic?.resumenBreve || '',
        content: '',
        tags: draft?.etiquetas || [],
        category: draft?.categoria || topic?.categoriaSugerida || '',
        country: null,
        entities: [],
        timeContext: null
      };
      
      themeResult = {
        contextId: 'generic',
        disaster: false,
        confidence: 0.3,
        reasons: ['fallback_sanitize'],
        keywords: []
      };
      
      promptContext = {
        category: signals.category,
        tags: signals.tags,
        country: null,
        entities: [],
        keywords: [],
        contextId: 'generic',
        disaster: false
      };
      
      console.log('[Redactor:Image] fallback=sanitize reason=builder_error');
    }
    
    const result = await generateWithProvider({
      provider,
      mode,
      draftId,
      topic,
      draft,
      prompt: finalPrompt,
      title: draft?.titulo || topic?.tituloSugerido || '',
      summary: draft?.bajada || topic?.resumenBreve || '',
      category: draft?.categoria || topic?.categoriaSugerida || '',
      // Pasar metadata COMPLETA de tema al provider (incluye contexto enriquecido)
      _imageContext: {
        theme: themeResult.contextId,
        isDisaster: themeResult.disaster,
        confidence: themeResult.confidence,
        reasons: themeResult.reasons,
        keywords: themeResult.keywords,
        // NUEVOS CAMPOS para contexto enriquecido
        locale: locale || 'es-CU',
        style: style || 'news_photojournalism',
        negativePrompt: finalNegative,
        category: promptContext?.category || signals.category,
        tags: promptContext?.tags || signals.tags,
        entities: promptContext?.entities || [],
        country: promptContext?.country || null,
        // Para compatibilidad con código legacy en imageProvider
        pack: null,
        disasterSignals: themeResult.disaster ? 2 : 0,
        tagHit: false,
        catHit: false
      }
    });

    if (result.ok) {
      const finalProvider = result.provider || provider;
      console.log(`[ImageProvider] result=ok provider=${finalProvider}`);
      // Calcular y registrar costo de imagen con proveedor final
      const imageCost = calculateImageCost(finalProvider);
      await logCost({
        type: 'image',
        costUSD: imageCost,
        draftId: draftId !== topic?.idTema ? draftId : null, // Solo si es un ID real de draft
        topicId: topic?.idTema,
        metadata: {
          provider: finalProvider,
          duration: Date.now() - startTime,
          success: true
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
      console.log(`[StatsService] Costo imagen: $${imageCost.toFixed(2)} (${finalProvider})`);
      
      // Usar proveedor final para decidir forma de retorno
      images.provider = finalProvider;
      if (finalProvider === 'internal' && result.url) {
        images.principal_url = result.url;
        images.coverUrl = result.coverUrl;
        images.coverFallbackUrl = result.coverFallbackUrl;
        images.coverHash = result.coverHash;
        images.kind = result.kind || 'processed';
        images.imageKind = result.kind || 'processed';
        console.log(`[Redactor] Imagen interna generada: ${result.url} (kind: ${images.kind})`);
      }
      // Si es DALL-E u otro generador externo, devolvemos base64
      else if (result.b64) {
        images.principal_b64 = result.b64;
        images.kind = result.kind || 'ai';
        images.imageKind = result.kind || 'ai';
        // Capturar metadata de referencia si existe
        images.usedSource = result.usedSource || false;
        images.referenceUrl = result.referenceUrl || null;
        // Capturar metadata de likeness si existe
        if (result.likenessMetadata) {
          images.likenessMetadata = result.likenessMetadata;
          console.log(`[Redactor] Imagen generada con ${provider} (base64, kind: ${images.kind}, referenced=${images.usedSource}, likeness: ${result.likenessMetadata.likeness})`);
        } else {
          console.log(`[Redactor] Imagen generada con ${provider} (base64, kind: ${images.kind}, referenced=${images.usedSource})`);
        }
        // Capturar imageMeta si existe
        if (result.imageMeta) {
          images.imageMeta = result.imageMeta;
        }
      }
    } else {
      console.warn(`[Redactor] Generación de imagen falló: ${result.error || 'unknown'}`);
      
      // Registrar fallo (sin costo)
      await logCost({
        type: 'image',
        costUSD: 0,
        draftId: draftId !== topic?.idTema ? draftId : null,
        topicId: topic?.idTema,
        metadata: {
          provider,
          duration: Date.now() - startTime,
          success: false
        },
        tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
      });
    }
  } catch (error) {
    console.error('[Redactor] Error generando imagen:', error.message);
    
    // Registrar error
    await logCost({
      type: 'image',
      costUSD: 0,
      draftId: draftId !== topic?.idTema ? draftId : null,
      topicId: topic?.idTema,
      metadata: {
        provider,
        duration: Date.now() - startTime,
        success: false
      },
      tenantId: topic?.tenantId || config.defaultTenant || 'levantatecuba'
    });
  }

  return images;
}

function calculateConfidence(response) {
  let score = 70;
  if (response.verifications?.length > 0) score += 10;
  if (response.contenidoMarkdown?.length > 500) score += 10;
  if (response.etiquetas?.length >= 3) score += 10;
  return Math.min(100, score);
}

/** @fix: Generar IA encadenado (extraer→referenciar→DALL-E) — 2025-10 */
async function generateImageForDraft(draftId, providerOverride = null, force = false, mode = 'auto', user = null, opts = {}) {
  // ========== PIPELINE SIMPLE: BYPASS COMPLETO ==========
  const { isSimpleMode } = require('../../config/image');
  
  if (isSimpleMode()) {
    console.log('[Redactor:Image] 🚀 MODO SIMPLE ACTIVO - Pipeline mínimo');
    
    const { generateCoverSimple } = require('./simpleImageService');
    const { Types } = require('mongoose');
    
    // Normalizar userId: extraer y validar ObjectId
    let userId = null;
    if (user) {
      if (typeof user === 'string' && Types.ObjectId.isValid(user)) {
        userId = user;
      } else if (user instanceof Types.ObjectId) {
        userId = user.toString();
      } else if (typeof user === 'object' && user !== null) {
        const extracted = user._id || user.id;
        if (extracted && Types.ObjectId.isValid(extracted)) {
          userId = extracted.toString();
        }
      }
    }
    
    if (userId) {
      console.log(`[Redactor:Image] userId normalizado: ${userId}`);
    }
    
    const result = await generateCoverSimple({
      draftId,
      provider: providerOverride,
      userId
    });
    
    if (!result.ok) {
      throw new Error(result.error || 'Error en pipeline simple');
    }
    
    // Recargar draft actualizado
    const draft = await AiDraft.findById(draftId).populate('topicId');
    console.log(`[Redactor:Image] ✅ Pipeline simple completado: ${result.path}`);
    return draft;
  }
  
  // ========== PIPELINE AUGMENTED (LEGACY) ==========
  console.log('[Redactor:Image] Pipeline AUGMENTED activo (modo completo)');
  
  const { Types } = require('mongoose');
  const draft = await AiDraft.findById(draftId).populate('topicId');
  if (!draft) throw new Error('Borrador no encontrado');
  
  // Marcar como processing al iniciar
  draft.imageStatus = 'processing';
  await draft.save();
  
  // Asignar generatedBy si es generación manual y no tiene usuario asignado
  if (user && !draft.generatedBy) {
    // Defensa: normalizar user a ObjectId válido
    let validUserId = null;
    
    if (typeof user === 'string' && Types.ObjectId.isValid(user)) {
      validUserId = new Types.ObjectId(user);
    } else if (user instanceof Types.ObjectId) {
      validUserId = user;
    } else if (typeof user === 'object' && user !== null) {
      const extracted = user._id || user.id;
      if (extracted && Types.ObjectId.isValid(extracted)) {
        validUserId = new Types.ObjectId(extracted);
      }
    }
    
    if (validUserId) {
      draft.generatedBy = validUserId;
      console.log(`[Redactor:Manual] generatedBy asignado: ${validUserId}`);
    } else {
      console.warn(`[Redactor:Manual] user inválido (${typeof user}), se omite generatedBy`);
    }
  }
  
  const config = await AiConfig.getSingleton();
  
  // Usar proveedor override o el configurado
  const provider = providerOverride || config.imageProvider || 'dall-e-3';
  
  // Buscar el topic asociado para tener más contexto (opcional)
  let topic = null;
  try {
    const AiTopic = require('../../models/AiTopic');
    topic = await AiTopic.findOne({ idTema: draft.topicId });
  } catch (error) {
    console.warn('[Redactor] No se pudo obtener topic asociado:', error.message);
  }
  
  // Crear config temporal con el provider elegido
  const configWithProvider = { ...config.toObject(), imageProvider: provider };
  
  // Log de configuración para validación
  console.log(`[Redactor:ImageConfig] draft=${draftId} provider=${provider} mode=${mode} override=${providerOverride ? 'YES' : 'NO'} manual=${!!user} titleOnly=${opts.titleOnly || false}`);
  console.log(`[Redactor] Generando cover para draft ${draftId} con proveedor: ${provider}`);
  
  const images = await generateImages(
    draft.promptsImagen, 
    configWithProvider, 
    topic, 
    draft, 
    draftId,
    mode,
    opts // ✅ Pasar opciones (titleOnly, etc.) al generador de imágenes
  );
  
  // Si se generó una URL interna (proveedor internal)
  if (images?.principal_url) {
    draft.coverImageUrl = images.principal_url;
    draft.coverUrl = images.coverUrl || images.principal_url;
    draft.coverFallbackUrl = images.coverFallbackUrl || images.principal_url;
    draft.coverHash = images.coverHash || '';
    draft.generatedImages = { principal: images.principal_url };
    draft.generatedImagesPersisted = { principal: true };
    draft.imageKind = images.kind || images.imageKind || 'processed';
    draft.imageProvider = images.provider || provider || 'internal'; // Proveedor real de primer nivel
    
    // Guardar URLs originales para regeneración si se pierde la imagen
    draft.originalImageUrl = images.originalImageUrl || null;
    draft.originalImageSource = images.originalImageSource || null;
    
    // Asegurar proveedor real en aiMetadata
    draft.aiMetadata = draft.aiMetadata || {};
    draft.aiMetadata.imageProvider = images.provider || draft.aiMetadata.imageProvider || provider;
    
    // Detectar mismatch de contexto: palabras vetadas sin soporte en contenido
    const contenidoCompleto = draft.contenidoMarkdown || '';
    const mencionaDesastres = /huracán|terremoto|incendio|inundaci|ambulancia|desastre|víctima|muerto|herido/i.test(contenidoCompleto);
    const promptTieneDesastres = /disaster|hurricane|flood|fire|ambulance|war|chaos|blood|violence/i.test(draft.promptsImagen?.principal || '');
    
    if (!mencionaDesastres && promptTieneDesastres) {
      draft.aiMetadata.imageContextMismatch = true;
      console.warn(`[Redactor] Mismatch detectado: prompt tiene vocabulario de desastres pero contenido no`);
    }
    
    // Guardar imageMeta si existe
    if (images.imageMeta) {
      draft.imageMeta = images.imageMeta;
    }
    
    // Marcar como ready solo si coverUrl existe
    draft.imageStatus = 'ready';
    
    console.log(`[Redactor] Cover persistido en BD: ${draft.coverUrl} (hash=${draft.coverHash || 'VACÍO'})`);
  }
  // Si se generó una imagen en base64 (proveedores externos como DALL-E), procesarla
  else if (images?.principal_b64) {
    try {
      const sharp = require('sharp');
      const path = require('path');
      const fs = require('fs').promises;
      
      // Convertir base64 a buffer
      const imageBuffer = Buffer.from(images.principal_b64, 'base64');
      
      // Directorio de destino
      const mediaDir = path.join(process.cwd(), 'public', 'media', 'news', draftId);
      await fs.mkdir(mediaDir, { recursive: true });
      
      // Procesar y guardar en múltiples formatos
      const processed = sharp(imageBuffer)
        .resize(1280, 720, { fit: 'cover', position: 'attention' });
      
      // Guardar JPG
      await processed.jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(mediaDir, 'cover.jpg'));
      
      // Guardar WebP
      await processed.webp({ quality: 80 })
        .toFile(path.join(mediaDir, 'cover.webp'));
      
      // Guardar AVIF
      let avifGenerated = false;
      try {
        await processed.avif({ quality: 58 })
          .toFile(path.join(mediaDir, 'cover.avif'));
        avifGenerated = true;
      } catch (err) {
        console.warn('[Redactor] No se pudo generar AVIF:', err.message);
      }
      
      // Calcular hash del archivo final
      const finalFile = avifGenerated ? 'cover.avif' : 'cover.jpg';
      const finalBuffer = await fs.readFile(path.join(mediaDir, finalFile));
      const coverHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');
      
      // Asignar rutas
      draft.coverUrl = `/media/news/${draftId}/cover.${avifGenerated ? 'avif' : 'webp'}`;
      draft.coverFallbackUrl = `/media/news/${draftId}/cover.jpg`;
      draft.coverHash = coverHash;
      draft.coverImageUrl = `/media/news/${draftId}/cover.${avifGenerated ? 'avif' : 'jpg'}`;
      draft.generatedImages = { principal: draft.coverUrl };
      draft.generatedImagesPersisted = { principal: true };
      draft.imageKind = images.kind || images.imageKind || 'ai'; // Cambiar 'real' a 'ai'
      draft.imageProvider = images.provider || provider || 'dall-e-3'; // Proveedor real de primer nivel
      draft.aiMetadata = draft.aiMetadata || {};
      draft.aiMetadata.imageProvider = images.provider || draft.aiMetadata.imageProvider || provider;
      draft.aiMetadata.generationType = 'auto';
      draft.aiMetadata.usedSource = images.usedSource || false;
      draft.aiMetadata.referenceUrl = images.referenceUrl || null;
      
      // Detectar mismatch de contexto: palabras vetadas sin soporte en contenido
      const contenidoCompleto = draft.contenidoMarkdown || '';
      const mencionaDesastres = /huracán|terremoto|incendio|inundaci|ambulancia|desastre|víctima|muerto|herido/i.test(contenidoCompleto);
      const promptTieneDesastres = /disaster|hurricane|flood|fire|ambulance|war|chaos|blood|violence/i.test(draft.promptsImagen?.principal || '');
      
      if (!mencionaDesastres && promptTieneDesastres) {
        draft.aiMetadata.imageContextMismatch = true;
        console.warn(`[Redactor] Mismatch detectado: prompt tiene vocabulario de desastres pero contenido no`);
      }
      
      // Guardar imageMeta si existe
      if (images.imageMeta) {
        draft.imageMeta = images.imageMeta;
      }
      
      // Marcar como ready solo si coverUrl existe
      draft.imageStatus = 'ready';
      
      console.log(`[Redactor] Imagen IA procesada y persistida: ${draft.coverUrl} (kind=${draft.imageKind}, referenced=${draft.aiMetadata.usedSource}, hash=${coverHash.slice(0, 16)}...)`);
    } catch (error) {
      console.error('[Redactor] Error procesando imagen IA:', error.message);
      
      // Marcar como error si falla el procesamiento
      draft.imageStatus = 'error';
      draft.aiMetadata = draft.aiMetadata || {};
      draft.aiMetadata.imageError = {
        code: 'processing_failed',
        message: error.message,
        timestamp: new Date()
      };
      
      throw error;
    }
  } else {
    // Sin imagen generada
    draft.generatedImages = {};
    draft.imageStatus = 'error';
    draft.aiMetadata = draft.aiMetadata || {};
    draft.aiMetadata.imageError = {
      code: 'no_image_generated',
      message: 'No se generó imagen',
      timestamp: new Date()
    };
    console.warn(`[Redactor] No se generó imagen para borrador ${draftId}`);
  }
  
  await draft.save();
  return draft;
}

/**
 * Genera una propuesta de cambios aplicando instrucciones a contenido HTML base
 * @param {string} baseHtml - Contenido HTML actual
 * @param {string} reviewNote - Instrucciones del revisor
 * @returns {Promise<string>} - HTML editado
 */
async function generateChangesProposal(baseHtml, reviewNote) {
  const config = await AiConfig.getSingleton();
  const model = config.aiModel || 'claude-3-5-sonnet-20241022';
  
  const systemPrompt = `Eres un editor profesional que aplica correcciones precisas a artículos HTML.

REGLAS ESTRICTAS:
1. DEBES realizar modificaciones reales, NO repitas el texto idéntico
2. Aplica EXPLÍCITAMENTE las instrucciones solicitadas
3. Si las instrucciones son vagas ("amplía", "mejora"), interprétalas concretamente:
   - "Amplía" = añadir 2-3 párrafos con contexto, datos o análisis verificables
   - "Resume" = reducir a los puntos clave manteniendo claridad
   - "Mejora" = refinar estructura, claridad y flow
4. Mantén la estructura HTML completa (headers, párrafos, listas)
5. Conserva todos los estilos y clases CSS existentes
6. NO inventes datos o fuentes, pero SÍ expande con análisis cuando sea apropiado
7. Asegura que el HTML sea válido
8. Evita estilos inline innecesarios
9. Responde ÚNICAMENTE con el HTML editado, sin explicaciones ni markdown
10. El resultado DEBE ser diferente del original aplicando los cambios solicitados

Si las instrucciones son imposibles, aplica cambios conservadores en la dirección indicada.`;

  const userPrompt = `INSTRUCCIONES DEL REVISOR:
${reviewNote}

CONTENIDO BASE (HTML):
${baseHtml}

APLICA los cambios solicitados produciendo una versión REVISADA (no idéntica). Devuelve SOLO el HTML editado:`;

  try {
    const startTime = Date.now();
    const result = await callLLM({
      model,
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.6, // Más variabilidad para garantizar cambios reales
      timeoutMs: 60000
    });
    const proposedHtml = result.text;
    const usage = result.usage;
    
    const generationTime = Date.now() - startTime;
    
    // Log de uso con tokens reales
    const cost = calculateLLMCost({ 
      model, 
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens
    });
    
    await logCost({
      type: 'llm',
      costUSD: cost,
      metadata: {
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        duration: generationTime,
        operation: 'generate-changes-proposal',
        reviewNoteLength: reviewNote.length,
        baseHtmlLength: baseHtml.length,
        proposedHtmlLength: proposedHtml.length
      }
    });
    
    console.log(`[Redactor] Propuesta generada: ${usage.total_tokens} tokens (${usage.prompt_tokens} input + ${usage.completion_tokens} output), ${(generationTime/1000).toFixed(1)}s, $${cost.toFixed(4)}`);
    
    return proposedHtml;
  } catch (error) {
    console.error('[Redactor] Error generando propuesta:', error);
    throw new Error(`Error al generar propuesta: ${error.message}`);
  }
}

module.exports = {
  generateDrafts,
  generateSingleDraft,
  generateImageForDraft,
  generateChangesProposal,
};
