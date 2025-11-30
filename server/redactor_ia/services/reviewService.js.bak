// server/redactor_ia/services/reviewService.js
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const AiDraft = require('../../models/AiDraft');
const AiConfig = require('../../models/AiConfig');
const { createTwoFilesPatch } = require('diff');

// Inicializar clientes
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

function isGPT(model) {
  return typeof model === 'string' && model.startsWith('gpt-');
}

/**
 * Llama al LLM correcto según el modelo
 */
async function callLLM({ model, system, user, temperature = 0.3, timeoutMs = 30000 }) {
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

  // Claude
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
 * Construye el prompt para revisar un borrador
 */
function buildRevisionPrompt(draft, notes) {
  const system = `Eres un editor profesional especializado en periodismo para medios digitales. Tu misión es mejorar la claridad, precisión y fluidez de borradores noticiosos sin inventar información.

REGLAS ESTRICTAS:
1. NO inventes hechos, fechas ni datos que no estén en el original
2. Mantén el tono neutral y objetivo (salvo si es opinión marcada)
3. Usa español neutro latinoamericano (evita regionalismos)
4. Respeta la estructura HTML existente (etiquetas <p>, <h2>, <strong>, etc.)
5. Mejora la redacción: claridad, coherencia, ritmo de lectura
6. Corrige errores ortográficos y gramaticales
7. Si el usuario pide cambios específicos, aplícalos con precisión

OUTPUT: Devuelve SOLO el contenido HTML revisado completo. NO agregues introducciones como "Aquí está el texto revisado" ni explicaciones adicionales.`;

  const user = `Título: ${draft.titulo || 'Sin título'}
Categoría: ${draft.categoria || 'General'}
Modo: ${draft.mode === 'opinion' ? 'Opinión' : 'Factual'}

${draft.bajada ? `Bajada:\n${draft.bajada}\n\n` : ''}Contenido a revisar:
${draft.contenidoHTML || draft.contenidoMarkdown || ''}

NOTAS DEL EDITOR (aplica estos cambios):
${notes || 'Mejorar claridad general y corregir errores'}

Devuelve el contenido HTML revisado completo (sin explicaciones adicionales):`;

  return { system, user };
}

/**
 * Genera una propuesta de revisión para un borrador
 * @param {Object} params - { draftId, notes, model, userId }
 * @returns {Promise<Object>} - { ok, proposed, diff, error }
 */
async function generateRevision({ draftId, notes, model, userId }) {
  const startTime = Date.now();
  
  try {
    console.log(`[Review] requested draft=${draftId} model=${model || 'default'}`);
    
    // 1. Cargar borrador
    const draft = await AiDraft.findById(draftId);
    if (!draft) {
      throw new Error('Borrador no encontrado');
    }

    // 2. Obtener modelo desde config si no se especificó
    if (!model) {
      const config = await AiConfig.getSingleton();
      model = config.generation?.modelText || 'gpt-4o-mini';
    }

    // 3. Validar que hay contenido
    const originalContent = draft.contenidoHTML || draft.contenidoMarkdown || '';
    if (!originalContent.trim()) {
      throw new Error('El borrador no tiene contenido para revisar');
    }

    // 4. Construir prompt
    const { system, user } = buildRevisionPrompt(draft, notes);

    // 5. Llamar a LLM con retry
    let proposedContent;
    try {
      proposedContent = await retryLLMCall(
        () => callLLM({ model, system, user, temperature: 0.3, timeoutMs: 45000 }),
        45000,
        2
      );
    } catch (error) {
      console.error('[Review] Error en LLM:', error);
      throw new Error(`Error al generar revisión: ${error.message}`);
    }

    // 6. Validar que la propuesta no esté vacía
    if (!proposedContent || proposedContent.trim().length < 100) {
      throw new Error('La IA devolvió una respuesta muy corta o vacía');
    }

    // 7. Generar diff
    const diff = createTwoFilesPatch(
      'original',
      'propuesta',
      originalContent,
      proposedContent,
      '',
      '',
      { context: 3 }
    );

    // 8. Verificar si hay cambios reales
    const hasChanges = originalContent.trim() !== proposedContent.trim();
    if (!hasChanges) {
      console.log('[Review] nochange id=${draftId} (contenido idéntico)');
      return {
        ok: false,
        status: 'nochange',
        message: 'La IA devolvió un contenido idéntico al original'
      };
    }

    // 9. Guardar en el borrador
    draft.review = {
      requestedNotes: notes || '',
      requestedBy: userId || null,
      requestedAt: new Date(),
      proposed: proposedContent,
      diff,
      status: 'ready',
      model,
      generationTime: Date.now() - startTime,
      finishedAt: new Date()
    };

    await draft.save();

    const diffChars = diff.length;
    console.log(`[Review] ready draft=${draftId} diffChars=${diffChars}`);

    return {
      ok: true,
      status: 'ready',
      proposed: proposedContent,
      diff
    };

  } catch (error) {
    console.error('[Review] error id=${draftId}:', error);

    // Guardar estado de error en el draft
    try {
      const draft = await AiDraft.findById(draftId);
      if (draft) {
        draft.review = {
          ...draft.review,
          status: 'error',
          errorMsg: error.message,
          errorAt: new Date()
        };
        await draft.save();
      }
    } catch (saveError) {
      console.error('[Review] Error guardando estado de error:', saveError);
    }

    return {
      ok: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Retry helper
 */
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
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[Review] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Aplica la revisión propuesta al borrador
 * @param {Object} params - { draftId, userId }
 * @returns {Promise<Object>} - { ok, draft }
 */
async function applyRevision({ draftId, userId }) {
  try {
    console.log(`[Review] applying id=${draftId} by=${userId}`);

    const draft = await AiDraft.findById(draftId);
    if (!draft) {
      throw new Error('Borrador no encontrado');
    }

    if (!draft.review || draft.review.status !== 'ready') {
      throw new Error('No hay revisión lista para aplicar');
    }

    if (!draft.review.proposed) {
      throw new Error('La propuesta de revisión está vacía');
    }

    // Guardar versión anterior en historial (opcional)
    if (!draft.review.history) {
      draft.review.history = [];
    }

    draft.review.history.push({
      content: draft.contenidoHTML || draft.contenidoMarkdown,
      appliedAt: new Date(),
      appliedBy: userId,
      notes: draft.review.requestedNotes
    });

    // Aplicar cambios
    draft.contenidoHTML = draft.review.proposed;
    draft.contenidoMarkdown = ''; // Limpiar markdown si existe

    // Limpiar review (o mantener en history)
    draft.review.status = 'applied';
    draft.review.appliedAt = new Date();
    draft.review.appliedBy = userId;

    await draft.save();

    console.log(`[Review] applied draft=${draftId} by=${userId}`);

    return {
      ok: true,
      draft
    };

  } catch (error) {
    console.error('[Review] Error applying revision:', error);
    return {
      ok: false,
      error: error.message
    };
  }
}

/**
 * Obtiene el estado de una revisión
 * @param {string} draftId
 * @returns {Promise<Object>}
 */
async function getRevisionStatus(draftId) {
  try {
    const draft = await AiDraft.findById(draftId);
    if (!draft) {
      return { status: 'not_found' };
    }

    if (!draft.review || !draft.review.status) {
      return { status: 'none' };
    }

    return {
      status: draft.review.status,
      proposed: draft.review.proposed || null,
      diff: draft.review.diff || null,
      errorMsg: draft.review.errorMsg || null,
      requestedAt: draft.review.requestedAt,
      finishedAt: draft.review.finishedAt,
      model: draft.review.model
    };

  } catch (error) {
    console.error('[Review] Error getting status:', error);
    return { status: 'error', errorMsg: error.message };
  }
}

module.exports = {
  generateRevision,
  applyRevision,
  getRevisionStatus
};
