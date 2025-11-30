// server/redactor_ia/services/urlDraftGenerator.js
const { marked } = require('marked');
const { extractArticleContent } = require('./urlExtractor');
const { buildSystemPrompt, strictValidateAndAutocorrect } = require('./promptBuilder');
const { deriveCategory } = require('../utils/categoryDeriver');
const AiConfig = require('../../models/AiConfig');

/**
 * Llama al LLM correcto según el modelo (copia de redactor.js para evitar dependencia circular)
 */
async function callLLM({ model, system, user, temperature = 0.3, timeoutMs = 30000 }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const OpenAI = require('openai');
  
  function isGPT(model) {
    return typeof model === 'string' && model.startsWith('gpt-');
  }
  
  if (isGPT(model)) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    const res = await openai.chat.completions.create(
      {
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { timeout: timeoutMs }
    );
    
    const txt = res.choices?.[0]?.message?.content ?? '';
    return String(txt || '').trim();
  }
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
  });
  
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  });
  
  const txt = msg?.content?.[0]?.text ?? '';
  return String(txt || '').trim();
}

/**
 * Parsea JSON de respuesta del LLM (copia de redactor.js para evitar dependencia circular)
 */
function parseCleanJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('No se encontró JSON válido en la respuesta');
  }
}

/**
 * Genera un borrador (solo texto) a partir de una URL
 * @param {string} url - URL del artículo original
 * @returns {Promise<Object>} Objeto con título, categoría, bajada, contenidoHtml, etiquetas
 */
async function generateDraftFromUrl(url) {
  console.log(`[URLDraftGenerator] Generando borrador desde URL: ${url}`);
  
  // 1. Extraer contenido de la URL
  const article = await extractArticleContent(url);
  
  if (article.length < 500) {
    throw new Error('El contenido extraído es demasiado corto (mínimo 500 caracteres)');
  }
  
  // 2. Obtener configuración del Redactor IA
  const config = await AiConfig.getSingleton();
  const modelUsed = config.aiModel || 'claude-3-5-sonnet-20240620';
  
  // 3. Construir input para el LLM (similar al formato del topic)
  const llmInput = {
    tituloOriginal: article.title,
    contenidoExtraido: article.content.substring(0, 8000), // Limitar para no saturar
    resumen: article.excerpt,
    urlOrigen: url,
    instrucciones: {
      modo: 'factual',
      estilo: 'standard',
      objetivo: 'Reescribe este artículo como una noticia original para LevántateCuba. Mantén los hechos pero adapta el lenguaje y estructura. NO copies textualmente.',
      requisitos: {
        titulo: 'Título claro y directo (máx 80 caracteres)',
        bajada: 'Resumen del lead (2-3 oraciones)',
        contenido: 'Mínimo 3000 caracteres, con secciones claras',
        etiquetas: '3-5 etiquetas relevantes',
        categoria: 'Deriva automáticamente según el contenido'
      }
    }
  };
  
  // 4. Construir prompt del sistema
  const systemPrompt = buildSystemPrompt('factual', 'standard');
  
  // 5. Construir prompt del usuario
  const userPrompt = `
Eres un redactor profesional. A continuación recibes el contenido extraído de un artículo web.
Tu tarea es REESCRIBIR este contenido como una noticia original, adaptando el lenguaje y estructura 
para LevántateCuba, manteniendo los hechos esenciales.

CONTENIDO ORIGINAL:
Título: ${article.title}
URL: ${url}
Resumen: ${article.excerpt}

Texto completo:
${article.content.substring(0, 8000)}

FORMATO DE RESPUESTA (JSON):
{
  "titulo": "Título reescrito (máx 80 chars)",
  "bajada": "Lead/resumen del artículo (2-3 oraciones)",
  "categoria": "Categoría apropiada (General, Política, Economía, Internacional, Tecnología, Tendencia)",
  "contenidoMarkdown": "# Sección 1\\n\\nPárrafo...\\n\\n## Subsección\\n\\nMás contenido...",
  "etiquetas": ["tag1", "tag2", "tag3"],
  "verifications": []
}

INSTRUCCIONES CRÍTICAS:
1. El contenidoMarkdown debe tener mínimo 3000 caracteres
2. Usa formato Markdown con encabezados (##), negritas (**texto**), listas, etc.
3. NO copies textualmente, reescribe con tus propias palabras
4. Mantén un tono profesional y objetivo
5. La categoría debe ser una de las opciones listadas
6. Las etiquetas deben ser relevantes al tema principal

Responde SOLO con el JSON, sin explicaciones adicionales.
`;
  
  console.log(`[URLDraftGenerator] Llamando al LLM (${modelUsed})...`);
  
  // 6. Llamar al LLM
  const llmText = await callLLM({
    model: modelUsed,
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.2 // Baja temperatura para mantener fidelidad
  });
  
  // 7. Parsear respuesta
  const response = parseCleanJSON(llmText);
  
  console.log(`[URLDraftGenerator] Respuesta LLM parseada:`, {
    titulo: response.titulo?.substring(0, 50),
    categoria: response.categoria,
    contenidoLength: response.contenidoMarkdown?.length || 0,
    etiquetas: response.etiquetas?.length || 0
  });
  
  // 8. Normalizar y validar campos
  const titulo = response.titulo?.trim() || article.title;
  const bajada = response.bajada?.trim() || article.excerpt;
  let categoria = response.categoria?.trim() || '';
  
  // Derivar categoría si falta
  if (!categoria) {
    console.log('[URLDraftGenerator] Derivando categoría automáticamente...');
    categoria = deriveCategory({
      title: titulo,
      summary: bajada,
      tags: response.etiquetas || [],
      source: null
    });
  }
  
  const etiquetas = Array.isArray(response.etiquetas) 
    ? response.etiquetas.filter(t => typeof t === 'string' && t.trim())
    : [];
  
  let contenidoMarkdown = response.contenidoMarkdown?.trim() || '';
  
  if (contenidoMarkdown.length < 500) {
    throw new Error('El contenido generado es demasiado corto');
  }
  
  // 8.5. Validar estructura de secciones obligatorias (FACTUAL)
  const structureValidation = strictValidateAndAutocorrect(contenidoMarkdown, {
    model: modelUsed,
    allowAutocorrect: true
  });
  
  if (structureValidation.shouldReject) {
    console.error('[URLDraftGenerator] ❌ Estructura inválida:', structureValidation.rejectReason);
    throw new Error(`Estructura de artículo inválida: ${structureValidation.rejectReason}`);
  }
  
  // Si se autocorrigió, usar el contenido corregido
  if (structureValidation.corrected && structureValidation.correctedContent) {
    console.log('[URLDraftGenerator] ✅ Estructura autocorregida');
    contenidoMarkdown = structureValidation.correctedContent;
  }
  
  console.log(`[URLDraftGenerator] Validación estructura: ${structureValidation.valid ? '✅ OK' : '⚠️ Autocorregido'}`);
  
  // 9. Convertir Markdown a HTML
  const contenidoHtml = marked(contenidoMarkdown);
  
  console.log(`[URLDraftGenerator] ✅ Borrador generado: ${titulo} (${contenidoHtml.length} chars HTML)`);
  
  // 10. Retornar solo texto (SIN imágenes)
  return {
    titulo,
    categoria,
    bajada,
    contenidoHtml,
    etiquetas,
    urlOrigen: url
  };
}

module.exports = {
  generateDraftFromUrl
};
