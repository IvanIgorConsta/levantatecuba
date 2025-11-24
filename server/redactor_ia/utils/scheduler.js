// server/redactor_ia/utils/scheduler.js
const cron = require('node-cron');
const AiConfig = require('../../models/AiConfig');
const { scanSources } = require('../services/crawler');
const { runFacebookAutoPublisher } = require('../services/facebookAutoPublisher');

// Almacena la tarea cron actual
let currentTask = null;
let facebookTask = null;

/**
 * Convierte frecuencia de string a expresión cron
 * @param {string} frequency - '2h', '3h', '4h', '6h', '12h', '24h'
 * @returns {string} Expresión cron válida
 */
function frequencyToCron(frequency) {
  const cronMap = {
    '2h': '0 */2 * * *',   // Cada 2 horas
    '3h': '0 */3 * * *',   // Cada 3 horas
    '4h': '0 */4 * * *',   // Cada 4 horas
    '6h': '0 */6 * * *',   // Cada 6 horas
    '12h': '0 */12 * * *', // Cada 12 horas
    '24h': '0 0 * * *'     // Diariamente a medianoche
  };
  
  return cronMap[frequency] || '0 */3 * * *'; // Default 3h
}

/**
 * Inicia el scheduler con la configuración actual
 */
async function startScheduler() {
  try {
    const config = await AiConfig.getSingleton();
    
    // Detener tarea anterior si existe
    if (currentTask) {
      currentTask.stop();
      currentTask = null;
    }
    
    // Si la frecuencia es manual, no programar nada
    if (config.scanFrequency === 'manual') {
      console.log('🔧 Redactor IA scheduler: modo manual → no se programan escaneos automáticos');
      
      // Limpiar nextScanAt
      await AiConfig.findOneAndUpdate(
        { singleton: true },
        { nextScanAt: null }
      );
      
      return true;
    }
    
    const cronExpression = frequencyToCron(config.scanFrequency);
    
    // Crear nueva tarea
    currentTask = cron.schedule(cronExpression, async () => {
      console.log(`[Redactor IA] Ejecutando escaneo automático (${config.scanFrequency})`);
      
      try {
        // Verificar que no haya otro escaneo en curso
        const currentConfig = await AiConfig.getSingleton();
        if (currentConfig.isScanning) {
          console.log('[Redactor IA] Escaneo anterior aún en curso, omitiendo...');
          return;
        }
        
        // Ejecutar escaneo
        await scanSources();
        
        // Actualizar última ejecución
        await AiConfig.findOneAndUpdate(
          { singleton: true },
          { 
            lastScanAt: new Date(),
            nextScanAt: getNextScanTime(config.scanFrequency)
          }
        );
        
        console.log('[Redactor IA] Escaneo completado exitosamente');
      } catch (error) {
        console.error('[Redactor IA] Error en escaneo automático:', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/Havana' // Zona horaria de Cuba
    });
    
    const nextRun = getNextScanTime(config.scanFrequency);
    console.log(`✅ Redactor IA scheduler iniciado: ${cronExpression} (${config.scanFrequency})`);
    console.log(`   Próxima ejecución: ${nextRun.toLocaleString('es-ES', { timeZone: 'America/Havana' })}`);
    
    // Actualizar próxima ejecución
    await AiConfig.findOneAndUpdate(
      { singleton: true },
      { nextScanAt: getNextScanTime(config.scanFrequency) }
    );
    
    return true;
  } catch (error) {
    console.error('[Redactor IA] Error al iniciar scheduler:', error);
    return false;
  }
}

/**
 * Detiene el scheduler actual
 */
function stopScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
    console.log('[Redactor IA] Scheduler detenido');
    return true;
  }
  return false;
}

/**
 * Reinicia el scheduler con nueva configuración
 */
async function restartScheduler() {
  stopScheduler();
  return await startScheduler();
}

/**
 * Calcula la próxima hora de escaneo
 */
function getNextScanTime(frequency) {
  // Si es manual, no hay próxima ejecución
  if (frequency === 'manual') {
    return null;
  }
  
  const now = new Date();
  const hours = parseInt(frequency.replace('h', ''));
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Obtiene el estado actual del scheduler
 */
async function getSchedulerStatus() {
  const config = await AiConfig.getSingleton();
  
  return {
    isActive: currentTask !== null,
    frequency: config.scanFrequency,
    cronExpression: frequencyToCron(config.scanFrequency),
    lastScanAt: config.lastScanAt,
    nextScanAt: config.nextScanAt,
    isScanning: config.isScanning,
    facebookSchedulerActive: facebookTask !== null
  };
}

/**
 * Inicia el scheduler de Facebook (se ejecuta cada 2 minutos)
 */
function startFacebookScheduler() {
  // Detener tarea anterior si existe
  if (facebookTask) {
    facebookTask.stop();
    facebookTask = null;
  }
  
  // Crear tarea que se ejecuta cada 2 minutos
  facebookTask = cron.schedule('*/2 * * * *', async () => {
    try {
      const result = await runFacebookAutoPublisher();
      
      if (result.success) {
        console.log(`[Facebook Scheduler] ✅ ${result.message}`);
      } else {
        // Solo log de debug, no error
        if (result.reason !== 'disabled' && result.reason !== 'interval_not_reached') {
          console.log(`[Facebook Scheduler] ℹ️ ${result.reason}: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('[Facebook Scheduler] ❌ Error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'America/Havana'
  });
  
  console.log('✅ Facebook Auto Publisher scheduler iniciado (cada 2 minutos)');
}

/**
 * Detiene el scheduler de Facebook
 */
function stopFacebookScheduler() {
  if (facebookTask) {
    facebookTask.stop();
    facebookTask = null;
    console.log('[Facebook Scheduler] Scheduler detenido');
    return true;
  }
  return false;
}

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
  getSchedulerStatus,
  frequencyToCron,
  startFacebookScheduler,
  stopFacebookScheduler
};
