// server/redactor_ia/services/textDraftGenerator.js
/**
 * Generador de borradores desde texto pegado
 * Usa el mismo pipeline que el Redactor IA con soporte para modo factual/opinión
 */

const { buildSystemPrompt } = require('./promptBuilder');
const AiConfig = require('../../models/AiConfig');

// Cliente LLM
let anthropicClient = null;
async function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Genera un borrador de noticia a partir de texto pegado
 * @param {string} texto - Texto de la noticia a procesar
 * @param {string} mode - 'factual' o 'opinion'
 * @returns {Promise<Object>} - { titulo, categoria, bajada, contenidoHtml, etiquetas }
 */
async function generateDraftFromText(texto, mode = 'factual') {
  if (!texto || texto.trim().length < 100) {
    throw new Error('El texto debe tener al menos 100 caracteres');
  }

  const config = await AiConfig.getSingleton();
  const modelUsed = config.aiModel || 'claude-3-5-sonnet-20240620';
  
  console.log(`[TextDraftGenerator] Iniciando generación desde texto (${texto.length} chars) en modo: ${mode}`);
  
  // 1. Construir prompt del sistema según modo
  const systemPrompt = buildSystemPrompt(mode, 'standard');
  
  // 2. Construir prompt del usuario
  const userPrompt = `
Procesa el siguiente texto y genera una noticia ${mode === 'factual' ? 'factual objetiva' : 'de opinión/análisis'}.

TEXTO ORIGINAL A PROCESAR:
---
${texto}
---

INSTRUCCIONES ESPECÍFICAS:
1. Reescribe el contenido como una noticia original para LevántateCuba
2. NO copies textualmente - reformula con tu propio estilo
3. Mantén los hechos y datos verificables
4. Genera un título SEO optimizado
5. Clasifica en la categoría más apropiada
6. ${mode === 'factual' ? 'OBLIGATORIO: Incluye las 4 secciones requeridas (Contexto, Causa/Consecuencia, Por qué es importante, Qué viene después)' : 'Estructura el contenido de forma clara con análisis editorial'}

Responde SOLO con el JSON válido según el esquema indicado en las instrucciones del sistema.
`;

  // 3. Llamar a Claude
  const client = await getAnthropicClient();
  
  const response = await client.messages.create({
    model: modelUsed,
    max_tokens: 4096,
    temperature: mode === 'factual' ? 0.2 : 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  // 4. Extraer texto de la respuesta
  const rawText = response.content[0]?.text || '';
  
  if (!rawText.trim()) {
    throw new Error('La respuesta del modelo está vacía');
  }

  // 5. Parsear JSON
  let parsed;
  try {
    // Intentar extraer JSON del texto
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se encontró JSON válido en la respuesta');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('[TextDraftGenerator] Error parseando JSON:', parseError.message);
    console.error('[TextDraftGenerator] Respuesta raw:', rawText.substring(0, 500));
    throw new Error('Error al parsear la respuesta del modelo');
  }

  // 6. Validar campos obligatorios
  if (!parsed.titulo || !parsed.contenidoMarkdown) {
    throw new Error('La respuesta no contiene los campos obligatorios (titulo, contenidoMarkdown)');
  }

  // 7. Validar longitud mínima
  const contenidoMarkdown = parsed.contenidoMarkdown || '';
  if (mode === 'factual' && contenidoMarkdown.length < 2000) {
    console.warn(`[TextDraftGenerator] Contenido corto (${contenidoMarkdown.length} chars), pero continuando...`);
  }

  // 8. Log de validación básica (estructura)
  if (mode === 'factual') {
    const hasRequiredSections = 
      contenidoMarkdown.includes('## Contexto') ||
      contenidoMarkdown.includes('## Por qué es importante');
    
    if (!hasRequiredSections) {
      console.warn('[TextDraftGenerator] Algunas secciones obligatorias podrían faltar');
    }
  }

  // 9. Convertir markdown a HTML básico
  const contenidoHtml = markdownToHtml(contenidoMarkdown);

  console.log(`[TextDraftGenerator] ✅ Borrador generado: "${parsed.titulo}" (${contenidoHtml.length} chars HTML)`);

  return {
    titulo: parsed.titulo || '',
    categoria: parsed.categoria || 'General',
    bajada: parsed.bajada || '',
    contenidoHtml: contenidoHtml,
    contenidoMarkdown: contenidoMarkdown,
    etiquetas: parsed.etiquetas || [],
    mode: mode
  };
}

/**
 * Convierte markdown básico a HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  let html = markdown
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs (lines that aren't headers or list items)
    .replace(/^(?!<[hul]|<li)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Line breaks
    .replace(/\n\n/g, '\n');
  
  return html.trim();
}

module.exports = {
  generateDraftFromText
};
