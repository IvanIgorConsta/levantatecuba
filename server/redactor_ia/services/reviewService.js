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
  const system = `Eres un EDITOR JEFE profesional. Tu trabajo tiene DOS FASES OBLIGATORIAS:

═══════════════════════════════════════════════════════════════════════════════
FASE 1: APLICA LAS INSTRUCCIONES DEL EDITOR
═══════════════════════════════════════════════════════════════════════════════
- Realiza los cambios que solicita el editor
- Mejora claridad, coherencia y ritmo de lectura
- Corrige errores ortográficos y gramaticales

═══════════════════════════════════════════════════════════════════════════════
FASE 2: VERIFICACIÓN COMPLETA DEL DOCUMENTO FINAL (OBLIGATORIA)
═══════════════════════════════════════════════════════════════════════════════

⚠️ DESPUÉS de aplicar los cambios, DEBES releer TODO el documento completo
   (TÍTULO, BAJADA y CUERPO) y corregir CUALQUIER frase que viole estas reglas:

╔══════════════════════════════════════════════════════════════════════════════╗
║  🔴 VERBOS/EXPRESIONES PROHIBIDAS PARA HECHOS FUTUROS (BUSCAR Y ELIMINAR)   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ lanza, implementará, se realizará, comenzará, operará, llegará, marcará,    ║
║ convertirá, promete, garantizará, reducirá, posiciona, consolida, será,     ║
║ responde a, se espera que, representa, ofrece, mejorará, transformará,      ║
║ revolucionará, permitirá, logrará, asegurará, proporcionará                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ REEMPLAZAR SIEMPRE POR:
   podría, tiene previsto, planea, se proyecta, según estimaciones,
   estaría sujeto a, pendiente de aprobación, potencialmente, se estima que

📋 CHECKLIST DE VERIFICACIÓN FINAL:
   □ ¿El TÍTULO contiene verbos afirmativos sobre el futuro? → CORREGIR
   □ ¿La BAJADA afirma hechos no confirmados? → CORREGIR  
   □ ¿El CUERPO presenta proyectos futuros como hechos? → CORREGIR
   □ ¿Se atribuyen motivaciones sin cita? → REFORMULAR
   □ ¿Los impactos se presentan como garantizados? → Cambiar a "potenciales"

⛔ CONDICIÓN DE ENTREGA:
   Si el texto final contiene UNA SOLA frase afirmativa sobre el futuro,
   NO LO ENTREGUES. Corrígelo primero.

═══════════════════════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA OBLIGATORIO (JSON)
═══════════════════════════════════════════════════════════════════════════════
DEBES devolver un JSON válido con TODOS estos campos revisados:

{
  "titulo": "El título revisado y corregido",
  "bajada": "La bajada/entradilla revisada y corregida",
  "contenidoHTML": "<p>El contenido HTML completo revisado...</p>"
}

⚠️ NO devuelvas texto plano. SOLO JSON válido con los 3 campos.
⚠️ El contenidoHTML debe incluir TODO el cuerpo con etiquetas HTML.`;

  const user = `DOCUMENTO A REVISAR:

TÍTULO ACTUAL:
${draft.titulo || 'Sin título'}

BAJADA ACTUAL:
${draft.bajada || 'Sin bajada'}

CONTENIDO ACTUAL:
${draft.contenidoHTML || draft.contenidoMarkdown || ''}

═══════════════════════════════════════════════════════════════════════════════
NOTAS DEL EDITOR (aplica estos cambios):
${notes || 'Mejorar claridad general y corregir errores'}
═══════════════════════════════════════════════════════════════════════════════

PROCESO OBLIGATORIO:
1. PRIMERO: Aplica los cambios que solicita el editor a TODO el documento
2. SEGUNDO: Relee TÍTULO, BAJADA y CONTENIDO de principio a fin
3. TERCERO: Busca y corrige CUALQUIER frase con verbos prohibidos en TODOS los campos
4. CUARTO: Verifica que el texto esté 100% limpio antes de entregar

Devuelve SOLO el JSON con los 3 campos revisados (titulo, bajada, contenidoHTML):`;

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
    let rawResponse;
    try {
      rawResponse = await retryLLMCall(
        () => callLLM({ model, system, user, temperature: 0.3, timeoutMs: 60000 }),
        60000,
        2
      );
    } catch (error) {
      console.error('[Review] Error en LLM:', error);
      throw new Error(`Error al generar revisión: ${error.message}`);
    }

    // 6. Parsear JSON de la respuesta
    let proposedData;
    try {
      // Limpiar respuesta de posibles bloques de código markdown
      let cleanResponse = rawResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();
      
      proposedData = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('[Review] Error parseando JSON:', parseError.message);
      console.log('[Review] Respuesta raw:', rawResponse.substring(0, 500));
      // Fallback: si no es JSON, usar como contenido HTML directo
      proposedData = {
        titulo: draft.titulo,
        bajada: draft.bajada,
        contenidoHTML: rawResponse
      };
    }

    // 7. Validar que la propuesta tenga contenido
    const proposedContent = proposedData.contenidoHTML || rawResponse;
    if (!proposedContent || proposedContent.trim().length < 100) {
      throw new Error('La IA devolvió una respuesta muy corta o vacía');
    }

    // 8. Generar diff del contenido
    const diff = createTwoFilesPatch(
      'original',
      'propuesta',
      originalContent,
      proposedContent,
      '',
      '',
      { context: 3 }
    );

    // 9. Verificar si hay cambios reales (en cualquier campo)
    const hasChanges = 
      originalContent.trim() !== proposedContent.trim() ||
      (proposedData.titulo && draft.titulo !== proposedData.titulo) ||
      (proposedData.bajada && draft.bajada !== proposedData.bajada);
      
    if (!hasChanges) {
      console.log(`[Review] nochange id=${draftId} (contenido idéntico)`);
      return {
        ok: false,
        status: 'nochange',
        message: 'La IA devolvió un contenido idéntico al original'
      };
    }

    // 10. Guardar en el borrador (con todos los campos)
    draft.review = {
      requestedNotes: notes || '',
      requestedBy: userId || null,
      requestedAt: new Date(),
      proposed: proposedContent,
      proposedTitulo: proposedData.titulo || draft.titulo,
      proposedBajada: proposedData.bajada || draft.bajada,
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

    // Aplicar cambios - TODOS los campos (título, bajada, contenido)
    if (draft.review.proposedTitulo) {
      draft.titulo = draft.review.proposedTitulo;
    }
    if (draft.review.proposedBajada) {
      draft.bajada = draft.review.proposedBajada;
    }
    draft.contenidoHTML = draft.review.proposed;
    draft.contenidoMarkdown = ''; // Limpiar markdown si existe
    
    console.log(`[Review] Aplicando cambios: titulo=${!!draft.review.proposedTitulo}, bajada=${!!draft.review.proposedBajada}, contenido=true`);

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
