// src/admin_dashboard/redactor_ia/ColaTemas.jsx
import { useState, useEffect } from 'react';
import { 
  Search, Filter, ExternalLink, Clock, TrendingUp, 
  CheckCircle2, AlertCircle, Zap, RefreshCw, Trash2 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ColaTemas() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState(null); // 'factual' | 'opinion' | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [generatingById, setGeneratingById] = useState({});
  const [filters, setFilters] = useState({
    minImpact: 0,
    confianza: '',
    categoria: ''
  });
  
  const setGen = (id, status) => {
    setGeneratingById(prev => ({ ...prev, [id]: status }));
  };

  useEffect(() => {
    fetchTopics();
    checkScanStatus();
  }, [filters]);

  // Cleanup al desmontar: resetear estados
  useEffect(() => {
    return () => {
      // Limpiar estados de generación
      setIsGenerating(false);
      setScanning(false);
      setGeneratingById({});
    };
  }, []);

  const fetchTopics = async () => {
    try {
      const params = new URLSearchParams({
        status: 'pending',
        ...filters
      });
      
      const res = await fetch(`/api/redactor-ia/topics?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await res.json();
      const newTopics = data.topics || [];
      setTopics(newTopics);
      return newTopics.length; // Retornar el conteo de temas
    } catch (error) {
      console.error('Error fetching topics:', error);
      toast.error('Error al cargar temas');
      return 0; // Retornar 0 en caso de error
    } finally {
      setLoading(false);
    }
  };

  const checkScanStatus = async () => {
    try {
      const res = await fetch('/api/redactor-ia/scan/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setScanning(data.isScanning);
    } catch (error) {
      console.error('Error checking scan status:', error);
    }
  };

  const handleScanNow = async () => {
    if (scanning) return;
    
    setScanning(true);
    toast.loading('Iniciando escaneo...', { id: 'scan' });
    
    let pollInterval = null;
    const TIMEOUT_MS = 120000; // 120 segundos
    const POLL_INTERVAL_MS = 2000; // 2 segundos
    let shouldRefresh = false;
    const topicsCountBefore = topics.length;
    
    try {
      const res = await fetch('/api/redactor-ia/scan', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Manejo específico de código SCAN_IN_PROGRESS
        if (data.code === 'SCAN_IN_PROGRESS') {
          toast.error('⏳ Ya hay un escaneo en curso. Espera a que termine.', { id: 'scan', duration: 3000 });
        } else {
          toast.error(data.message || data.error || 'Error al iniciar escaneo', { id: 'scan' });
        }
        return;
      }
      
      const scanData = data;
      const isCubaStrict = scanData.mode === 'cuba_estricto';
      
      toast.success(
        isCubaStrict 
          ? 'Escaneo Cuba estricto en progreso (CiberCuba, ElToque, Martí Noticias)...'
          : 'Escaneo en progreso...', 
        { id: 'scan' }
      );
      shouldRefresh = true; // Marcar que se inició correctamente
      
      // Polling para verificar cuando termina
      const startTime = Date.now();
      
      await new Promise((resolve, reject) => {
        const checkStatus = async () => {
          try {
            // Verificar timeout
            if (Date.now() - startTime > TIMEOUT_MS) {
              clearInterval(pollInterval);
              reject(new Error('Timeout: El escaneo tomó demasiado tiempo'));
              return;
            }
            
            const statusRes = await fetch('/api/redactor-ia/scan/status', {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            const statusData = await statusRes.json();
            
            if (!statusData.isScanning) {
              // Escaneo terminado
              clearInterval(pollInterval);
              resolve();
            }
          } catch (error) {
            clearInterval(pollInterval);
            reject(error);
          }
        };
        
        // Verificar inmediatamente y luego cada 2 segundos
        checkStatus();
        pollInterval = setInterval(checkStatus, POLL_INTERVAL_MS);
      });
      
      // Refrescar temas ANTES de mostrar el toast final para obtener el conteo actualizado
      const topicsCountAfter = await fetchTopics();
      
      // Calcular nuevos temas encontrados
      const newTopicsCount = Math.max(0, topicsCountAfter - topicsCountBefore);
      
      // Mostrar toast con número de temas
      if (newTopicsCount > 0) {
        toast.success(`Escaneo completado: ${newTopicsCount} tema${newTopicsCount > 1 ? 's' : ''} nuevo${newTopicsCount > 1 ? 's' : ''}`, { 
          id: 'scan',
          duration: 4000 
        });
      } else {
        toast.success('Escaneo completado: sin temas nuevos', { 
          id: 'scan',
          duration: 3000 
        });
      }
      
      // Disparar evento para actualizar estadísticas
      window.dispatchEvent(new CustomEvent('redactor-ia:stats-changed'));
      
    } catch (error) {
      console.error('Error en escaneo:', error);
      toast.error(error.message || 'Error durante el escaneo', { id: 'scan' });
      
      // Intentar refrescar temas incluso si hubo error en el polling
      if (shouldRefresh) {
        await fetchTopics();
        window.dispatchEvent(new CustomEvent('redactor-ia:stats-changed'));
      }
    } finally {
      // SIEMPRE limpiar interval y reactivar botón
      if (pollInterval) clearInterval(pollInterval);
      setScanning(false);
    }
  };

  const handleGenerate = async (mode = 'factual') => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un tema');
      return;
    }
    
    // Bloquear si ya hay una generación en curso
    if (isGenerating) {
      toast.error('Ya hay una generación en curso. Espera a que termine.');
      return;
    }
    
    const selectedCount = selectedIds.size;
    const selectedTopicIds = Array.from(selectedIds);
    const modeLabel = mode === 'factual' ? 'factual' : 'opinión';
    
    setIsGenerating(true);
    setGeneratingMode(mode);
    
    // Marcar todos los seleccionados como "loading"
    selectedTopicIds.forEach(id => setGen(id, 'loading'));
    
    toast.loading(
      `🧠 Generando ${selectedCount} borrador${selectedCount > 1 ? 'es' : ''} en modo ${modeLabel}...`, 
      { id: 'generate' }
    );
    
    try {
      const res = await fetch('/api/redactor-ia/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topicIds: selectedTopicIds,
          mode
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Marcar como "done" antes de eliminar
        selectedTopicIds.forEach(id => setGen(id, 'done'));
        
        // Esperar 800ms para mostrar "Listo"
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Eliminar automáticamente los temas generados de la cola
        setTopics(prevTopics => 
          prevTopics.filter(topic => !selectedIds.has(topic.idTema))
        );
        
        // Limpiar selección y estado de generación
        setSelectedIds(new Set());
        selectedTopicIds.forEach(id => setGen(id, 'idle'));
        
        // Refrescar estadísticas después de generar borradores
        window.dispatchEvent(new CustomEvent('redactor-ia:stats-changed'));
        
        // Toast personalizado con color por tipo
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } pointer-events-auto max-w-md w-full rounded-lg border p-4 shadow-lg bg-zinc-900 text-zinc-100 ${
                mode === 'factual' ? 'border-sky-600/50' : 'border-violet-600/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-2 w-2 mt-2 rounded-full shrink-0 ${
                  mode === 'factual' ? 'bg-sky-400' : 'bg-violet-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    ✅ {selectedCount} borrador{selectedCount > 1 ? 'es' : ''} de{' '}
                    {mode === 'factual' ? 'Factual' : 'Opinión'} generado{selectedCount > 1 ? 's' : ''} y eliminado{selectedCount > 1 ? 's' : ''} de la cola.
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">Revisa la pestaña "Borradores IA".</p>
                </div>
              </div>
            </div>
          ),
          { id: 'generate', duration: 4000 }
        );
      } else {
        selectedTopicIds.forEach(id => setGen(id, 'error'));
        
        // Manejo específico de código GENERATION_IN_PROGRESS
        if (data.code === 'GENERATION_IN_PROGRESS') {
          toast.error('⏳ Ya hay una generación en curso. Espera a que termine.', { 
            id: 'generate', 
            duration: 3000 
          });
        } else {
          toast.error(data.message || data.error || '❌ Error al generar borradores.', { 
            id: 'generate', 
            duration: 4000 
          });
        }
        
        // Resetear después de 2s
        setTimeout(() => {
          selectedTopicIds.forEach(id => setGen(id, 'idle'));
        }, 2000);
      }
    } catch (error) {
      selectedTopicIds.forEach(id => setGen(id, 'error'));
      toast.error('❌ Error de conexión. Intenta nuevamente.', { id: 'generate', duration: 4000 });
      
      // Resetear después de 2s
      setTimeout(() => {
        selectedTopicIds.forEach(id => setGen(id, 'idle'));
      }, 2000);
    } finally {
      // SIEMPRE liberar el lock de generación
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const toggleSelection = (idTema) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(idTema)) {
      newSet.delete(idTema);
    } else {
      newSet.add(idTema);
    }
    setSelectedIds(newSet);
  };

  const getConfianzaColor = (confianza) => {
    switch (confianza) {
      case 'Alta': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Media': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Baja': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const handleClearQueue = async () => {
    const confirmed = window.confirm(
      'Se archivarán todos los temas visibles en la cola. Esta acción no borra permanentemente y puede revertirse desde la base de datos si es necesario. ¿Continuar?'
    );
    
    if (!confirmed) return;
    
    setIsBulkBusy(true);
    toast.loading('Archivando cola...', { id: 'clear-queue' });
    
    try {
      const res = await fetch('/api/redactor-ia/topics/queue', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Error al limpiar la cola');
      }
      
      toast.success(`Archivados: ${data.modified} tema(s)`, { id: 'clear-queue' });
      setSelectedIds(new Set());
      await fetchTopics();
    } catch (error) {
      toast.error(error.message, { id: 'clear-queue' });
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('No hay temas seleccionados');
      return;
    }
    
    const confirmed = window.confirm(
      `Se archivarán ${selectedIds.size} tema(s) seleccionado(s). ¿Confirmas?`
    );
    
    if (!confirmed) return;
    
    setIsBulkBusy(true);
    toast.loading('Archivando seleccionados...', { id: 'delete-selected' });
    
    try {
      const res = await fetch('/api/redactor-ia/topics', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Error al archivar seleccionados');
      }
      
      toast.success(`Archivados: ${data.modified} tema(s)`, { id: 'delete-selected' });
      setSelectedIds(new Set());
      await fetchTopics();
    } catch (error) {
      toast.error(error.message, { id: 'delete-selected' });
    } finally {
      setIsBulkBusy(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === topics.length && topics.length > 0) {
      // Deseleccionar todos
      setSelectedIds(new Set());
    } else {
      // Seleccionar todos los visibles
      setSelectedIds(new Set(topics.map(t => t.idTema)));
    }
  };

  return (
    <div>
      {/* Actions Bar */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 lg:gap-3">
          {/* Primary actions - Desktop en una fila */}
          <button
            onClick={handleScanNow}
            disabled={scanning || isBulkBusy}
            aria-label={scanning ? "Escaneando" : "Escanear ahora"}
            className="h-11 xl:h-12 min-w-[44px] lg:col-span-2 flex items-center justify-center gap-2 px-4 lg:px-5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {scanning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span className="hidden sm:inline">Escaneando...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Escanear</span>
              </>
            )}
          </button>

          <button
            onClick={handleClearQueue}
            disabled={isBulkBusy || loading || topics.length === 0}
            aria-label="Archivar todos los temas de la cola"
            className="h-11 xl:h-12 min-w-[44px] lg:col-span-2 flex items-center justify-center gap-2 px-4 lg:px-5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-100 border border-zinc-700 rounded-xl font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
          >
            <Trash2 size={16} />
            <span className="hidden md:inline">Limpiar</span>
          </button>

          <button
            onClick={handleDeleteSelected}
            disabled={isBulkBusy || selectedIds.size === 0}
            aria-label={`Eliminar ${selectedIds.size} temas seleccionados`}
            className="h-11 xl:h-12 min-w-[44px] lg:col-span-2 flex items-center justify-center gap-2 px-4 lg:px-5 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-rose-600"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Eliminar ({selectedIds.size})</span>
            <span className="sm:hidden">({selectedIds.size})</span>
          </button>

          {/* Generate buttons */}
          <button
            onClick={() => handleGenerate('factual')}
            disabled={selectedIds.size === 0 || isBulkBusy || isGenerating}
            aria-label={generatingMode === 'factual' ? "Generando..." : "Generar borradores factuales"}
            className="h-11 xl:h-12 min-w-[44px] lg:col-span-3 xl:col-span-2 flex items-center justify-center gap-2 px-4 lg:px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {generatingMode === 'factual' ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Factual</span>
              </>
            )}
          </button>
          <button
            onClick={() => handleGenerate('opinion')}
            disabled={selectedIds.size === 0 || isBulkBusy || isGenerating}
            aria-label={generatingMode === 'opinion' ? "Generando..." : "Generar borradores de opinión"}
            className="h-11 xl:h-12 min-w-[44px] lg:col-span-3 xl:col-span-2 flex items-center justify-center gap-2 px-4 lg:px-5 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {generatingMode === 'opinion' ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Opinión</span>
              </>
            )}
          </button>
        </div>

        {/* Selection info */}
        {selectedIds.size > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-700">
            <p className="text-sm text-zinc-400">
              <span className="font-medium text-white">{selectedIds.size}</span> tema(s) seleccionado(s)
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 mb-6">
        <div className="flex items-center gap-2 mb-3 lg:mb-4">
          <Filter size={16} className="text-zinc-400" />
          <span className="font-medium text-sm lg:text-base text-white">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          <div className="min-w-0">
            <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Impacto mínimo</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minImpact}
              onChange={(e) => setFilters({ ...filters, minImpact: e.target.value })}
              aria-label="Impacto mínimo"
              className="w-full h-2 min-w-0"
            />
            <span className="text-xs text-zinc-500 break-words">{filters.minImpact}%</span>
          </div>
          <div className="min-w-0">
            <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Confianza</label>
            <select
              value={filters.confianza}
              onChange={(e) => setFilters({ ...filters, confianza: e.target.value })}
              aria-label="Filtro de confianza"
              className="w-full h-11 xl:h-12 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Todas</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Categoría</label>
            <select
              value={filters.categoria}
              onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
              aria-label="Filtro de categoría"
              className="w-full h-11 xl:h-12 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Todas</option>
              <option value="Política">Política</option>
              <option value="Economía">Economía</option>
              <option value="Internacional">Internacional</option>
              <option value="Socio político">Socio político</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>
      </div>

      {/* Topics List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Cargando temas...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 bg-zinc-800/30 border border-zinc-700 rounded-xl">
          <Search size={48} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400">No hay temas pendientes</p>
          <p className="text-sm text-zinc-500 mt-2">Haz clic en "Escanear Ahora" para buscar nuevas noticias</p>
        </div>
      ) : (
        <>
          {/* List header con seleccionar todos */}
          <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-3 mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === topics.length && topics.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 shrink-0 accent-cyan-500 cursor-pointer"
              />
              <span className="text-sm text-zinc-300 font-medium">
                Seleccionar todos ({topics.length} temas)
              </span>
            </label>
          </div>

          {(() => {
            // Ordenar temas por fecha: más recientes primero
            const temasOrdenados = [...topics].sort(
              (a, b) => new Date(b.detectedAt) - new Date(a.detectedAt)
            );

            return (
              <div className="space-y-4">
                {temasOrdenados.map((topic) => {
                  const genStatus = generatingById[topic.idTema] || 'idle';
                  const isGenerating = genStatus === 'loading';
                  
                  return (
            <div
              key={topic.idTema}
              className={`grid grid-cols-[auto,1fr] lg:grid-cols-[auto,1fr,auto] gap-3 lg:gap-4 items-start p-3 sm:p-4 lg:p-4 xl:p-5 rounded-2xl border bg-zinc-900/60 backdrop-blur transition-all duration-200 hover:bg-zinc-900/80 hover:border-zinc-600 ${
                selectedIds.has(topic.idTema) 
                  ? 'border-cyan-500 shadow-lg shadow-cyan-500/20' 
                  : 'border-zinc-800'
              } ${
                isGenerating ? 'pointer-events-none opacity-75' : ''
              }`}
            >
              {/* Accesibilidad: anuncio para lectores de pantalla */}
              <div className="sr-only" aria-live="polite">
                {genStatus === 'loading' && 'Procesando borrador...'}
                {genStatus === 'done' && 'Borrador listo'}
                {genStatus === 'error' && 'Error al generar borrador'}
              </div>
              
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.has(topic.idTema)}
                onChange={() => toggleSelection(topic.idTema)}
                disabled={isGenerating}
                aria-label={`Seleccionar tema: ${topic.tituloSugerido}`}
                className="w-5 h-5 lg:w-6 lg:h-6 mt-1 shrink-0 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />

              {/* Content */}
              <div className="min-w-0">
                {/* Título */}
                <h3 className="text-base lg:text-lg xl:text-xl font-semibold text-white break-words line-clamp-3 lg:line-clamp-2 mb-2">
                  {topic.tituloSugerido}
                </h3>
                
                {/* Badges + Estado de generación */}
                <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm mb-3">
                  {/* Badge de estado de generación */}
                  {genStatus === 'loading' && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-600/30 rounded-full text-xs font-medium">
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Procesando...
                    </span>
                  )}
                  {genStatus === 'done' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-300 border border-green-600/30 rounded-full text-xs font-medium">
                      ✓ Listo
                    </span>
                  )}
                  {genStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-300 border border-red-600/30 rounded-full text-xs font-medium">
                      ✗ Error
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shrink-0">
                    <TrendingUp size={14} className="text-cyan-400" />
                    <span className="font-bold text-cyan-400">{topic.impacto}</span>
                  </div>
                  <span className={`px-2 py-1 border rounded-lg font-medium shrink-0 ${getConfianzaColor(topic.confianza)}`}>
                    {topic.confianza}
                  </span>
                </div>

                {/* Resumen */}
                <p className="text-sm lg:text-[15px] xl:text-base text-zinc-400 line-clamp-2 mb-3 break-words">
                  {topic.resumenBreve}
                </p>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 text-xs lg:text-sm text-zinc-500 break-words">
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock size={14} />
                    <span className="hidden sm:inline">{new Date(topic.detectedAt).toLocaleString('es-ES')}</span>
                    <span className="sm:hidden">{new Date(topic.detectedAt).toLocaleDateString('es-ES')}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-900 rounded shrink-0">
                    {topic.categoriaSugerida}
                  </span>
                  <span className="shrink-0">
                    {topic.fuentesTop?.length || 0} fuentes
                  </span>
                </div>

                {/* Fuentes */}
                {topic.fuentesTop && topic.fuentesTop.length > 0 && (
                  <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3">
                    <p className="text-xs font-medium text-zinc-400 mb-2">
                      Fuentes principales:
                    </p>
                    <div className="space-y-2">
                      {topic.fuentesTop.slice(0, 3).map((fuente, idx) => (
                        <a
                          key={idx}
                          href={fuente.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Leer fuente: ${fuente.titulo}`}
                          className="flex items-start gap-2 text-sm hover:text-cyan-400 transition-colors group focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                        >
                          <ExternalLink size={14} className="mt-0.5 shrink-0 text-zinc-500 group-hover:text-cyan-400" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium line-clamp-2 break-words">{fuente.titulo}</p>
                            <p className="text-xs text-zinc-500 break-words">
                              {fuente.medio} • {new Date(fuente.fecha).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
                })}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
