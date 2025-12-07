/**
 * Sistema de cola y semáforo para operaciones pesadas
 * Evita sobrecarga del servidor por múltiples operaciones simultáneas
 */

class OperationQueue {
  constructor(name, maxConcurrent = 2) {
    this.name = name;
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
    this.stats = {
      completed: 0,
      failed: 0,
      queued: 0,
      totalWaitTime: 0
    };
  }

  /**
   * Encola una operación y la ejecuta cuando hay capacidad
   * @param {Function} operation - Función async a ejecutar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise} - Resultado de la operación
   */
  async enqueue(operation, options = {}) {
    const { timeout = 120000, priority = 0 } = options;
    const startWait = Date.now();

    return new Promise((resolve, reject) => {
      const task = {
        operation,
        resolve,
        reject,
        timeout,
        priority,
        startWait,
        id: `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Insertar según prioridad (mayor prioridad primero)
      const insertIndex = this.queue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }

      this.stats.queued++;
      
      console.log(`[Queue:${this.name}] ➕ Tarea encolada (${this.queue.length} en cola, ${this.running}/${this.maxConcurrent} ejecutando)`);
      
      this._processNext();
    });
  }

  async _processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.running++;
    
    const waitTime = Date.now() - task.startWait;
    this.stats.totalWaitTime += waitTime;
    
    console.log(`[Queue:${this.name}] ▶️ Ejecutando tarea (esperó ${(waitTime/1000).toFixed(1)}s, ${this.running}/${this.maxConcurrent} activos)`);

    // Timeout para la operación
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operación excedió timeout de ${task.timeout}ms`)), task.timeout);
    });

    try {
      const result = await Promise.race([
        task.operation(),
        timeoutPromise
      ]);
      
      this.stats.completed++;
      task.resolve(result);
    } catch (error) {
      this.stats.failed++;
      console.error(`[Queue:${this.name}] ❌ Error en tarea:`, error.message);
      task.reject(error);
    } finally {
      this.running--;
      console.log(`[Queue:${this.name}] ✅ Tarea completada (${this.running}/${this.maxConcurrent} activos, ${this.queue.length} en cola)`);
      
      // Procesar siguiente tarea
      this._processNext();
    }
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats() {
    return {
      ...this.stats,
      running: this.running,
      queued: this.queue.length,
      avgWaitTime: this.stats.completed > 0 
        ? Math.round(this.stats.totalWaitTime / this.stats.completed) 
        : 0
    };
  }

  /**
   * Verifica si hay capacidad inmediata
   */
  hasCapacity() {
    return this.running < this.maxConcurrent;
  }

  /**
   * Número de operaciones en cola
   */
  getPendingCount() {
    return this.queue.length;
  }
}

// Colas especializadas con límites apropiados
const imageGenerationQueue = new OperationQueue('ImageGen', 2);  // Max 2 imágenes simultáneas
const llmGenerationQueue = new OperationQueue('LLM', 3);         // Max 3 llamadas LLM simultáneas
const draftGenerationQueue = new OperationQueue('Draft', 1);     // Max 1 borrador a la vez (ya tiene candado interno)

module.exports = {
  OperationQueue,
  imageGenerationQueue,
  llmGenerationQueue,
  draftGenerationQueue,
  
  // Helper para obtener estado de todas las colas
  getAllQueueStats: () => ({
    imageGen: imageGenerationQueue.getStats(),
    llm: llmGenerationQueue.getStats(),
    draft: draftGenerationQueue.getStats()
  })
};
