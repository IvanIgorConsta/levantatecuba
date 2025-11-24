// server/redactor_ia/services/statsService.js
const dayjs = require('dayjs');
const ScanLog = require('../../models/ScanLog');
const AiDraft = require('../../models/AiDraft');
const CostLog = require('../../models/CostLog');

/**
 * Obtiene estadísticas de uso con aggregations en tiempo real
 * @param {Object} options - { from, to, tenantId }
 * @returns {Object} Estadísticas calculadas
 */
async function getUsageStats({ from, to, tenantId = 'levantatecuba' } = {}) {
  const start = from ? new Date(from) : dayjs().startOf('month').toDate();
  const end = to ? new Date(to) : dayjs().endOf('day').toDate();

  console.log(`[StatsService] Calculando estadísticas ${start.toISOString()} → ${end.toISOString()}`);

  // 1) Temas por escaneo (promedio) - últimos 26 días
  const scansAgg = await ScanLog.aggregate([
    {
      $match: {
        tenantId,
        createdAt: { $gte: start, $lte: end }
        // Removido filtro status: 'success' para contar todos los escaneos
      }
    },
    {
      $group: {
        _id: null,
        totalTopics: { $sum: '$topicsFound' },
        scans: { $sum: 1 }
      }
    },
    {
      $project: {
        scans: 1,
        totalTopics: 1,
        avgTopicsPerScan: {
          $cond: [
            { $eq: ['$scans', 0] },
            0,
            { $divide: ['$totalTopics', '$scans'] }
          ]
        }
      }
    }
  ]);

  // 2) Borradores aprobados (conteo real por fecha de aprobación)
  const approvedDrafts = await AiDraft.countDocuments({
    tenantId,
    reviewStatus: 'approved',
    reviewedAt: { $gte: start, $lte: end }
  });

  // 3) Total de borradores generados en el período
  const totalDrafts = await AiDraft.countDocuments({
    tenantId,
    createdAt: { $gte: start, $lte: end }
  });

  // 4) Costo promedio (requiere CostLog)
  const costsAgg = await CostLog.aggregate([
    {
      $match: {
        tenantId,
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$costUSD' },
        operations: { $sum: 1 }
      }
    },
    {
      $project: {
        avgCost: {
          $cond: [
            { $eq: ['$operations', 0] },
            0,
            { $divide: ['$totalCost', '$operations'] }
          ]
        },
        totalCost: 1,
        operations: 1
      }
    }
  ]);

  // 5) Desglose de costos por tipo
  const costsByType = await CostLog.aggregate([
    {
      $match: {
        tenantId,
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$costUSD' },
        count: { $sum: 1 }
      }
    }
  ]);

  const scanData = scansAgg[0] || { avgTopicsPerScan: 0, scans: 0, totalTopics: 0 };
  const costData = costsAgg[0] || { avgCost: 0, totalCost: 0, operations: 0 };

  // Calcular tasa de aprobación
  const approvalRate = totalDrafts > 0 ? (approvedDrafts / totalDrafts) * 100 : 0;

  return {
    // Métricas principales
    avgTopicsPerScan: Number((scanData.avgTopicsPerScan || 0).toFixed(1)),
    approvedDrafts,
    avgCost: Math.round(costData.avgCost * 10000) / 10000, // 4 decimales
    
    // Métricas adicionales
    scans: scanData.scans || 0, // Campo para frontend
    totalScans: scanData.scans || 0, // Compatibilidad
    totalTopicsFound: scanData.totalTopics || 0,
    totalDrafts,
    approvalRate: Math.round(approvalRate * 10) / 10,
    
    // Costos
    totalCost: Math.round(costData.totalCost * 100) / 100, // 2 decimales
    costOperations: costData.operations,
    costsByType: costsByType.reduce((acc, item) => {
      acc[item._id] = {
        total: Math.round(item.total * 100) / 100,
        count: item.count,
        avg: Math.round((item.total / item.count) * 10000) / 10000
      };
      return acc;
    }, {}),
    
    // Rango
    range: {
      from: start,
      to: end,
      days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    }
  };
}

/**
 * Registra un costo de operación
 * @param {Object} data - { type, costUSD, draftId?, topicId?, metadata? }
 */
async function logCost({ type, costUSD, draftId = null, topicId = null, metadata = {}, tenantId = 'levantatecuba' }) {
  try {
    const log = await CostLog.create({
      tenantId,
      type,
      costUSD,
      draftId,
      topicId,
      metadata
    });
    
    console.log(`[StatsService] Costo registrado: ${type} = $${costUSD.toFixed(4)}`);
    return log;
  } catch (error) {
    console.error('[StatsService] Error registrando costo:', error.message);
    return null;
  }
}

/**
 * Registra un escaneo
 * @param {Object} data - { topicsFound, scanType, sources, duration, status, error? }
 */
async function logScan({ topicsFound, scanType = 'scheduled', sources = {}, duration = 0, status = 'success', error = null, tenantId = 'levantatecuba' }) {
  try {
    const log = await ScanLog.create({
      tenantId,
      topicsFound,
      scanType,
      sources,
      duration,
      status,
      error
    });
    
    console.log(`[StatsService] Escaneo registrado: ${topicsFound} temas encontrados (${status})`);
    return log;
  } catch (error) {
    console.error('[StatsService] Error registrando escaneo:', error.message);
    return null;
  }
}

/**
 * Calcula el costo real de una llamada LLM
 * @param {Object} data - { model, promptTokens, completionTokens }
 * @returns {number} Costo en USD
 */
function calculateLLMCost({ model, promptTokens = 0, completionTokens = 0 }) {
  // Precios por 1M tokens - input y output diferenciados
  // Fuente: https://openai.com/api/pricing/ y https://www.anthropic.com/pricing
  const pricing = {
    // Claude models (input / output por 1M tokens)
    'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-sonnet-4.5-thinking': { input: 3.00, output: 15.00 },
    'claude-opus': { input: 15.00, output: 75.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    
    // OpenAI GPT-4 models (input / output por 1M tokens)
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
    'gpt-4o-2024-08-06': { input: 2.50, output: 10.00 },
    'gpt-4o-2024-05-13': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.150, output: 0.600 },
    'gpt-4o-mini-2024-07-18': { input: 0.150, output: 0.600 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4-turbo-2024-04-09': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-4-32k': { input: 60.00, output: 120.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
  };
  
  // Default a Claude Sonnet 3.5 si el modelo no está en la lista
  const modelPricing = pricing[model] || { input: 3.00, output: 15.00 };
  
  // Calcular costo: (tokens / 1M) * precio
  const inputCost = (promptTokens / 1000000) * modelPricing.input;
  const outputCost = (completionTokens / 1000000) * modelPricing.output;
  
  return inputCost + outputCost;
}

/**
 * Calcula el costo estimado de generación de imagen
 * @param {string} provider - 'dall-e-3', 'dall-e-2', etc.
 * @returns {number} Costo en USD
 */
function calculateImageCost(provider) {
  const pricing = {
    'dall-e-3': 0.04, // $0.04 por imagen 1024x1024
    'dall-e-2': 0.02, // $0.02 por imagen 1024x1024
    'stable-diffusion': 0.01,
    'midjourney': 0.05,
    'hailuo': 0.03 // $0.03 por imagen 1280x720 (MiniMax)
  };
  
  return pricing[provider] || 0;
}

module.exports = {
  getUsageStats,
  logCost,
  logScan,
  calculateLLMCost,
  calculateImageCost
};
