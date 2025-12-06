// src/admin_dashboard/redactor_ia/ConfiguracionIA.jsx
import { useState, useEffect } from 'react';
import { Save, Clock, Image, TrendingUp, AlertCircle, CheckCircle, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConfiguracionIA() {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    fetchConfig();
    fetchStats();
    fetchSuggestion();

    // Escuchar cambios en estadísticas desde otros componentes
    const handleStatsChange = () => {
      console.log('[ConfiguracionIA] Refrescando estadísticas...');
      fetchStats();
    };

    window.addEventListener('redactor-ia:stats-changed', handleStatsChange);
    return () => {
      window.removeEventListener('redactor-ia:stats-changed', handleStatsChange);
    };
  }, []);

  const fetchConfig = async () => {
    try {
      console.log('[RedactorConfig] Cargando configuración desde backend...');
      const res = await fetch('/api/redactor-ia/config', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      console.log('[RedactorConfig] Config recibida:', {
        scanFrequency: data.scanFrequency,
        freshnessWindowHours: data.freshnessWindowHours,
        perSourceCap: data.perSourceCap,
        maxTopicsPerScan: data.maxTopicsPerScan,
        autoGenerateImages: data.autoGenerateImages,
        autoCaptureImageFromSourceOnCreate: data.autoCaptureImageFromSourceOnCreate,
        strictCuba: data.strictCuba
      });
      
      setConfig(data);
    } catch (error) {
      console.error('[RedactorConfig] Error fetching config:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/redactor-ia/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setStats(data.usage);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSuggestion = async () => {
    try {
      const res = await fetch('/api/redactor-ia/config/suggest-frequency', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setSuggestion(data);
    } catch (error) {
      console.error('Error fetching suggestion:', error);
    }
  };

  const handleToggleAllowlist = async (checked) => {
    const updatedConfig = { ...config, enforceSourceAllowlist: checked };
    setConfig(updatedConfig);
    
    // Guardar inmediatamente
    try {
      toast.loading('Actualizando configuración...', { id: 'allowlist' });
      const res = await fetch('/api/redactor-ia/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enforceSourceAllowlist: checked })
      });
      
      if (res.ok) {
        toast.success(checked ? 'Modo estricto activado' : 'Modo estricto desactivado', { id: 'allowlist' });
        fetchConfig();
      } else {
        toast.error('Error al actualizar', { id: 'allowlist' });
        setConfig(config); // Revertir
      }
    } catch (error) {
      toast.error('Error de conexión', { id: 'allowlist' });
      setConfig(config); // Revertir
    }
  };

  const handleAutoSchedule = async () => {
    if (!config.autoScheduleEnabled) {
      toast.error('Activa la programación automática primero');
      return;
    }
    
    toast.loading('Programando borradores...', { id: 'auto-schedule' });
    
    try {
      const res = await fetch('/api/redactor-ia/auto-schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success(data.message, { id: 'auto-schedule' });
      } else {
        toast.error(data.error || 'Error al programar', { id: 'auto-schedule' });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: 'auto-schedule' });
    }
  };

  const handleFacebookRecalculate = async () => {
    if (!config.facebookScheduler?.enabled) {
      toast.error('Activa la programación automática en Facebook primero');
      return;
    }
    
    toast.loading('Consultando estado...', { id: 'fb-schedule' });
    
    try {
      const res = await fetch('/api/redactor-ia/facebook/recalculate-schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (data.ok) {
        const { summary } = data;
        toast.success(
          `${summary.candidatesCount} candidatos, ${summary.publishedToday} publicados hoy`,
          { id: 'fb-schedule', duration: 4000 }
        );
      } else {
        toast.error(data.error || 'Error al consultar', { id: 'fb-schedule' });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: 'fb-schedule' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    toast.loading('Guardando configuración...', { id: 'save' });

    const payload = {
      scanFrequency: config.scanFrequency,
      autoGenerateImages: Boolean(config.autoGenerateImages),
      autoCaptureImageFromSourceOnCreate: Boolean(config.autoCaptureImageFromSourceOnCreate ?? false),
      maxTopicsPerScan: Number(config.maxTopicsPerScan),
      minSourcesForHighConfidence: Number(config.minSourcesForHighConfidence),
      suggestOptimalFrequency: Boolean(config.suggestOptimalFrequency),
      newsApiEnabled: Boolean(config.newsApiEnabled),
      strictCuba: Boolean(config.strictCuba ?? false),
      freshnessWindowHours: Number(config.freshnessWindowHours || 48),
      perSourceCap: Number(config.perSourceCap || 5),
      aiModel: config.aiModel,
      imageProvider: config.imageProvider,
      enforceSourceAllowlist: Boolean(config.enforceSourceAllowlist),
      trustedSources: config.trustedSources || [],
      autoScheduleEnabled: Boolean(config.autoScheduleEnabled ?? false),
      autoScheduleInterval: Number(config.autoScheduleInterval || 10),
      autoScheduleStartHour: Number(config.autoScheduleStartHour ?? 7),
      autoScheduleEndHour: Number(config.autoScheduleEndHour ?? 23),
      facebookScheduler: {
        enabled: Boolean(config.facebookScheduler?.enabled ?? false),
        intervalMinutes: Number(config.facebookScheduler?.intervalMinutes || 30),
        startHour: Number(config.facebookScheduler?.startHour ?? 9),
        endHour: Number(config.facebookScheduler?.endHour ?? 23),
        maxPerDay: Number(config.facebookScheduler?.maxPerDay || 0)
      }
    };

    console.log('[RedactorConfig] Guardando configuración...');
    console.log('[RedactorConfig] Payload:', payload);

    try {
      const res = await fetch('/api/redactor-ia/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[RedactorConfig] ✅ Configuración guardada exitosamente');
        console.log('[RedactorConfig] Campos actualizados:', data.updated);
        
        toast.success('Configuración guardada', { id: 'save' });
        
        // Re-fetch para confirmar persistencia
        await fetchConfig();
        await fetchSuggestion();
        
        console.log('[RedactorConfig] Config recargada desde backend');
      } else {
        const data = await res.json();
        console.error('[RedactorConfig] Error del servidor:', data);
        toast.error(data.error || 'Error al guardar', { id: 'save' });
      }
    } catch (error) {
      console.error('[RedactorConfig] Error de conexión:', error);
      toast.error('Error de conexión', { id: 'save' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestion = () => {
    if (suggestion?.suggested) {
      setConfig({ ...config, scanFrequency: suggestion.suggested });
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-zinc-400">Cargando configuración...</div>;
  }

  if (!config) {
    return <div className="text-center py-12 text-red-400">Error al cargar configuración</div>;
  }

  return (
    <div className="mx-auto lg:max-w-none">
      {/* Sugerencia de frecuencia óptima */}
      {suggestion?.shouldChange && config.suggestOptimalFrequency && (
        <div className="min-w-0 rounded-2xl border border-cyan-900/30 bg-cyan-900/20 p-3 sm:p-4 lg:p-4 xl:p-5 2xl:p-6 mb-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center lg:justify-between gap-3 lg:gap-6">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <TrendingUp className="text-cyan-400 shrink-0 mt-1" size={20} />
              <div className="min-w-0 flex-1">
                <h4 className="text-base sm:text-lg font-semibold text-cyan-400 mb-2">
                  Sugerencia de optimización
                </h4>
                <p className="text-sm text-zinc-300 break-words">
                  Basado en tus estadísticas, recomendamos cambiar la frecuencia de escaneo 
                  de <strong>{suggestion.current}</strong> a <strong>{suggestion.suggested}</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={handleApplySuggestion}
              aria-label="Aplicar sugerencia de frecuencia"
              className="h-11 xl:h-12 px-4 lg:px-5 shrink-0 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Aplicar sugerencia
            </button>
          </div>
        </div>
      )}

      {/* Configuración de Escaneo */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 xl:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 lg:mb-5">
          <Clock className="text-cyan-400" size={20} />
          <h3 className="text-base sm:text-lg font-bold">Configuración de Escaneo</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Frecuencia */}
          <div className="min-w-0 sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-2">
              Frecuencia de escaneo automático
            </label>
            <select
              value={config.scanFrequency}
              onChange={(e) => setConfig({ ...config, scanFrequency: e.target.value })}
              aria-label="Frecuencia de escaneo"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="manual">Manual (sin escaneo automático)</option>
              <option value="2h">Cada 2 horas</option>
              <option value="3h">Cada 3 horas (recomendado)</option>
              <option value="4h">Cada 4 horas</option>
              <option value="6h">Cada 6 horas</option>
              <option value="12h">Cada 12 horas</option>
              <option value="24h">Diariamente</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              {config.scanFrequency === 'manual'
                ? 'Solo escanearás cuando lo ejecutes manualmente'
                : 'Mayor frecuencia = más temas detectados, pero mayor costo de API'
              }
            </p>
            
            {/* Mensaje de ayuda para modo manual */}
            {config.scanFrequency === 'manual' && (
              <p className="mt-2 text-sm text-zinc-400 break-words">
                El escaneo automático está desactivado. Usa el botón <strong>Escanear</strong> en <em>Cola de Temas</em>.
              </p>
            )}
          </div>

          {/* Max topics per scan */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Máximo de temas por escaneo
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.maxTopicsPerScan}
              onChange={(e) => setConfig({ ...config, maxTopicsPerScan: Number(e.target.value) || 8 })}
              aria-label="Máximo de temas por escaneo"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Temas más relevantes por escaneo (1-20)
            </p>
          </div>

          {/* Min sources for high confidence */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Fuentes mínimas para confianza alta
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.minSourcesForHighConfidence}
              onChange={(e) => setConfig({ ...config, minSourcesForHighConfidence: Number(e.target.value) || 3 })}
              aria-label="Fuentes mínimas"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Fuentes para marcar "Alta confianza"
            </p>
          </div>

          {/* NewsAPI enabled */}
          <div className="min-w-0 sm:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="newsApiEnabled"
              checked={config.newsApiEnabled}
              onChange={(e) => setConfig({ ...config, newsApiEnabled: e.target.checked })}
              className="w-5 h-5 shrink-0 accent-cyan-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <label htmlFor="newsApiEnabled" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words">
              Habilitar NewsAPI para escaneo de fuentes internacionales
            </label>
          </div>

          {/* Modo Cuba estricto */}
          <div className="min-w-0 sm:col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="strictCuba"
                checked={config.strictCuba ?? false}
                onChange={(e) => setConfig({ ...config, strictCuba: e.target.checked })}
                className="w-5 h-5 shrink-0 accent-amber-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <label htmlFor="strictCuba" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words font-medium">
                Modo Cuba estricto (solo noticias relacionadas)
              </label>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 leading-relaxed ml-8">
              Si está activo, el escáner obtendrá exclusivamente noticias recientes desde fuentes cubanas principales (CiberCuba, ElToque y Martí Noticias), ignorando NewsAPI y otros países.
            </p>
          </div>

          {/* Suggest optimal frequency */}
          <div className="min-w-0 sm:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="suggestOptimal"
              checked={config.suggestOptimalFrequency}
              onChange={(e) => setConfig({ ...config, suggestOptimalFrequency: e.target.checked })}
              className="w-5 h-5 shrink-0 accent-cyan-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <label htmlFor="suggestOptimal" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words">
              Mostrar sugerencias automáticas de frecuencia óptima
            </label>
          </div>
        </div>
      </div>

      {/* Priorización de Frescura */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 xl:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 lg:mb-5">
          <Clock className="text-emerald-400" size={20} />
          <h3 className="text-base sm:text-lg font-bold">Priorización de Frescura</h3>
        </div>
        
        <p className="text-xs sm:text-sm text-zinc-400 mb-4 leading-relaxed">
          Controla cómo se priorizan las noticias más recientes. Una ventana menor muestra solo lo más nuevo; 
          el cap por fuente evita que medios prolíficos dominen la cola.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Ventana temporal */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Ventana de tiempo
            </label>
            <select
              value={config.freshnessWindowHours || 48}
              onChange={(e) => setConfig({ ...config, freshnessWindowHours: Number(e.target.value) })}
              aria-label="Ventana de tiempo para frescura"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="12">12 horas (ultra-reciente)</option>
              <option value="24">24 horas (1 día)</option>
              <option value="48">48 horas (2 días) - Recomendado</option>
              <option value="72">72 horas (3 días)</option>
              <option value="168">7 días (semana completa)</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Solo artículos publicados en este período
            </p>
          </div>

          {/* Cap por fuente */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Máximo por fuente
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.perSourceCap || 5}
              onChange={(e) => setConfig({ ...config, perSourceCap: Number(e.target.value) || 5 })}
              aria-label="Máximo de artículos por fuente"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Artículos más recientes por dominio (1-10)
            </p>
          </div>

          {/* Explicación */}
          <div className="min-w-0 sm:col-span-2 bg-emerald-900/10 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-[10px] sm:text-xs text-emerald-300/90 leading-relaxed">
              <strong>Efecto:</strong> Las noticias se ordenan por score de frescura × impacto. 
              Artículos recientes obtienen mayor puntuación, decayendo exponencialmente con el tiempo. 
              Esto garantiza que lo más nuevo aparezca primero en la cola.
            </p>
          </div>
        </div>
      </div>

      {/* Configuración de Generación */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 xl:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 lg:mb-5">
          <Image className="text-purple-400" size={20} />
          <h3 className="text-base sm:text-lg font-bold">Configuración de Generación</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Auto generate images */}
          <div className="min-w-0 sm:col-span-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoImages"
                checked={config.autoGenerateImages}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setConfig({ 
                    ...config, 
                    autoGenerateImages: isChecked,
                    // Si se activa generación IA, desactivar captura del sitio
                    autoCaptureImageFromSourceOnCreate: isChecked ? false : config.autoCaptureImageFromSourceOnCreate
                  });
                }}
                className="w-5 h-5 shrink-0 accent-purple-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <label htmlFor="autoImages" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words">
                Generar imágenes automáticamente al crear borradores (IA)
              </label>
            </div>
            <p className="text-xs text-zinc-500 mt-2 ml-8 break-words">
              Crea portadas con inteligencia artificial basadas en el contenido
            </p>
          </div>

          {/* Auto capture images from source */}
          <div className="min-w-0 sm:col-span-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoCaptureImages"
                checked={config.autoCaptureImageFromSourceOnCreate}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setConfig({ 
                    ...config, 
                    autoCaptureImageFromSourceOnCreate: isChecked,
                    // Si se activa captura del sitio, desactivar generación IA
                    autoGenerateImages: isChecked ? false : config.autoGenerateImages
                  });
                }}
                className="w-5 h-5 shrink-0 accent-cyan-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <label htmlFor="autoCaptureImages" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words">
                Extraer imágenes automáticamente del sitio al crear borradores
              </label>
            </div>
            <p className="text-xs text-zinc-500 mt-2 ml-8 break-words">
              Usa la imagen del artículo original como portada cuando sea posible
            </p>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <p className="text-xs text-amber-400 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Solo uno de los modos automáticos puede estar activo a la vez</span>
            </p>
          </div>

          {/* AI Model */}
          <div className="min-w-0 sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-2">
              Modelo de texto (LLM)
            </label>
            <select
              value={config.aiModel}
              onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
              aria-label="Modelo de IA"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="claude-sonnet-4.5-thinking">Claude Sonnet 4.5 Thinking (recomendado)</option>
              <option value="claude-opus">Claude Opus (premium)</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o-mini</option>
            </select>
          </div>

          {/* Image Provider */}
          <div className="min-w-0 sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-2">
              Proveedor de imágenes
            </label>
            <select
              value={config.imageProvider}
              onChange={(e) => setConfig({ ...config, imageProvider: e.target.value })}
              aria-label="Proveedor de imágenes"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="dall-e-3">DALL-E 3 (OpenAI)</option>
              <option value="dall-e-2">DALL-E 2 (OpenAI)</option>
              <option value="hailuo">Hailuo (MiniMax)</option>
              <option value="stable-diffusion">Stable Diffusion</option>
              <option value="midjourney">Midjourney</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              ⚠️ Genera imágenes con IA; puede tener costos por uso
            </p>
          </div>

          {/* Editor de fuentes confiables */}
          <div className="min-w-0 sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-2">
              Fuentes confiables (allowlist)
            </label>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 max-h-40 overflow-y-auto min-w-0">
              <div className="flex flex-wrap gap-2 mb-3">
                {(config.trustedSources || []).map((source, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded-full border border-cyan-600/30 shrink-0"
                  >
                    <span className="break-all">{source}</span>
                    <button
                      onClick={() => {
                        const newSources = config.trustedSources.filter((_, i) => i !== idx);
                        setConfig({ ...config, trustedSources: newSources });
                      }}
                      aria-label={`Eliminar ${source}`}
                      className="hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Agregar dominio (ej: bbc.com)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const newSource = e.target.value.trim();
                    if (!config.trustedSources?.includes(newSource)) {
                      setConfig({
                        ...config,
                        trustedSources: [...(config.trustedSources || []), newSource]
                      });
                    }
                    e.target.value = '';
                  }
                }}
                aria-label="Agregar fuente confiable"
                className="w-full h-10 min-w-0 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Solo artículos de estos dominios serán considerados (presiona Enter para agregar)
            </p>
          </div>

          {/* Toggle enforceSourceAllowlist */}
          <div className="min-w-0 sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enforceSourceAllowlist || false}
                onChange={(e) => handleToggleAllowlist(e.target.checked)}
                className="w-5 h-5 shrink-0 rounded border-zinc-700 bg-zinc-900 text-cyan-600 cursor-pointer focus:ring-2 focus:ring-cyan-600 focus:ring-offset-0"
              />
              <span className="text-xs sm:text-sm text-zinc-300 break-words">
                Aplicar allowlist estrictamente (solo fuentes confiables)
              </span>
            </label>
            {config.enforceSourceAllowlist && (
              <div className="mt-2 flex items-center gap-2 p-2 sm:p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl min-w-0">
                <CheckCircle size={16} className="text-cyan-400 shrink-0" />
                <p className="text-xs text-cyan-300 break-words">
                  🔒 Modo estricto activo — solo se escanearán fuentes verificadas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Programación automática */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 xl:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 lg:mb-5">
          <Clock className="text-amber-400" size={20} />
          <h3 className="text-base sm:text-lg font-bold">Programación automática de Borradores</h3>
        </div>
        
        <p className="text-xs sm:text-sm text-zinc-400 mb-4 leading-relaxed">
          Distribuye automáticamente fechas de publicación a los borradores pendientes según el intervalo y la franja horaria configurados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Activar programación automática */}
          <div className="min-w-0 sm:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="autoScheduleEnabled"
              checked={config.autoScheduleEnabled ?? false}
              onChange={(e) => setConfig({ ...config, autoScheduleEnabled: e.target.checked })}
              className="w-5 h-5 shrink-0 accent-amber-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <label htmlFor="autoScheduleEnabled" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words font-medium">
              Activar programación automática de publicaciones
            </label>
          </div>

          {/* Intervalo entre publicaciones */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Intervalo entre publicaciones
            </label>
            <select
              value={config.autoScheduleInterval || 10}
              onChange={(e) => setConfig({ ...config, autoScheduleInterval: Number(e.target.value) })}
              disabled={!config.autoScheduleEnabled}
              aria-label="Intervalo entre publicaciones"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="5">5 minutos</option>
              <option value="10">10 minutos (recomendado)</option>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Tiempo entre cada publicación automática
            </p>
          </div>

          {/* Franja horaria - Inicio */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Hora de inicio
            </label>
            <select
              value={config.autoScheduleStartHour ?? 7}
              onChange={(e) => setConfig({ ...config, autoScheduleStartHour: Number(e.target.value) })}
              disabled={!config.autoScheduleEnabled}
              aria-label="Hora de inicio de franja horaria"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Hora de inicio de la franja
            </p>
          </div>

          {/* Franja horaria - Fin */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Hora de fin
            </label>
            <select
              value={config.autoScheduleEndHour ?? 23}
              onChange={(e) => setConfig({ ...config, autoScheduleEndHour: Number(e.target.value) })}
              disabled={!config.autoScheduleEnabled}
              aria-label="Hora de fin de franja horaria"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Hora de fin de la franja
            </p>
          </div>

          {/* Botón recalcular programación */}
          <div className="min-w-0 sm:col-span-2">
            <button
              onClick={handleAutoSchedule}
              disabled={!config.autoScheduleEnabled}
              className="h-11 w-full flex items-center justify-center gap-2 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <Clock size={16} />
              Recalcular programación ahora
            </button>
            <p className="text-xs text-zinc-500 mt-2 break-words">
              Distribuye fechas de publicación a todos los borradores pendientes
            </p>
          </div>

          {/* Explicación */}
          <div className="min-w-0 sm:col-span-2 bg-amber-900/10 border border-amber-900/30 rounded-lg p-3">
            <p className="text-[10px] sm:text-xs text-amber-300/90 leading-relaxed">
              <strong>Cómo funciona:</strong> Los borradores pendientes se programan automáticamente con el intervalo configurado, 
              respetando la franja horaria. Si la hora actual está fuera de la franja, se programa para el siguiente día. 
              Los borradores aprobados se publican inmediatamente como siempre.
            </p>
          </div>
        </div>
      </div>

      {/* Programación automática en Facebook */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 xl:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 lg:mb-5">
          <Facebook className="text-blue-400" size={20} />
          <h3 className="text-base sm:text-lg font-bold">Programación automática en Facebook</h3>
        </div>
        
        <p className="text-xs sm:text-sm text-zinc-400 mb-4 leading-relaxed">
          Publica automáticamente TODAS las noticias que aún no están en Facebook, siguiendo el intervalo y la franja horaria configurados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Activar programación automática en Facebook */}
          <div className="min-w-0 sm:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="facebookSchedulerEnabled"
              checked={config.facebookScheduler?.enabled ?? false}
              onChange={(e) => setConfig({ 
                ...config, 
                facebookScheduler: { 
                  ...config.facebookScheduler, 
                  enabled: e.target.checked 
                } 
              })}
              className="w-5 h-5 shrink-0 accent-blue-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="facebookSchedulerEnabled" className="text-xs sm:text-sm text-zinc-300 cursor-pointer break-words font-medium">
              Activar programación automática en Facebook
            </label>
          </div>

          {/* Intervalo entre publicaciones en Facebook */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Intervalo entre publicaciones en Facebook
            </label>
            <select
              value={config.facebookScheduler?.intervalMinutes || 30}
              onChange={(e) => setConfig({ 
                ...config, 
                facebookScheduler: { 
                  ...config.facebookScheduler, 
                  intervalMinutes: Number(e.target.value) 
                } 
              })}
              disabled={!config.facebookScheduler?.enabled}
              aria-label="Intervalo entre publicaciones en Facebook"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="10">10 minutos</option>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos (recomendado)</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Tiempo entre cada publicación en Facebook
            </p>
          </div>

          {/* Máximo de publicaciones diarias en Facebook */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Máximo de publicaciones diarias
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={config.facebookScheduler?.maxPerDay || 0}
              onChange={(e) => setConfig({ 
                ...config, 
                facebookScheduler: { 
                  ...config.facebookScheduler, 
                  maxPerDay: Number(e.target.value) 
                } 
              })}
              disabled={!config.facebookScheduler?.enabled}
              aria-label="Máximo de publicaciones diarias en Facebook"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-zinc-500 mt-1 break-words">
              0 = sin límite diario
            </p>
          </div>

          {/* Franja horaria - Inicio (Facebook) */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Hora de inicio (Facebook)
            </label>
            <select
              value={config.facebookScheduler?.startHour ?? 9}
              onChange={(e) => setConfig({ 
                ...config, 
                facebookScheduler: { 
                  ...config.facebookScheduler, 
                  startHour: Number(e.target.value) 
                } 
              })}
              disabled={!config.facebookScheduler?.enabled}
              aria-label="Hora de inicio de franja horaria en Facebook"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Hora de inicio de la franja
            </p>
          </div>

          {/* Franja horaria - Fin (Facebook) */}
          <div className="min-w-0">
            <label className="block text-xs text-zinc-400 mb-2">
              Hora de fin (Facebook)
            </label>
            <select
              value={config.facebookScheduler?.endHour ?? 23}
              onChange={(e) => setConfig({ 
                ...config, 
                facebookScheduler: { 
                  ...config.facebookScheduler, 
                  endHour: Number(e.target.value) 
                } 
              })}
              disabled={!config.facebookScheduler?.enabled}
              aria-label="Hora de fin de franja horaria en Facebook"
              className="w-full h-11 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1 break-words">
              Hora de fin de la franja
            </p>
          </div>

          {/* Botón recalcular programación en Facebook */}
          <div className="min-w-0 sm:col-span-2">
            <button
              onClick={handleFacebookRecalculate}
              disabled={!config.facebookScheduler?.enabled}
              className="h-11 w-full flex items-center justify-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Facebook size={16} />
              Recalcular programación en Facebook ahora
            </button>
            <p className="text-xs text-zinc-500 mt-2 break-words">
              Consulta el estado actual de la cola de publicación en Facebook
            </p>
          </div>

          {/* Explicación */}
          <div className="min-w-0 sm:col-span-2 bg-blue-900/10 border border-blue-900/30 rounded-lg p-3">
            <p className="text-[10px] sm:text-xs text-blue-300/90 leading-relaxed">
              <strong>Cómo funciona:</strong> El sistema detecta automáticamente TODAS las noticias publicadas que aún no están compartidas en Facebook. 
              Las publica en orden cronológico (más antiguas primero) respetando el intervalo, franja horaria y límite diario configurados. 
              Sin selección manual requerida.
            </p>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-green-400" size={20} />
            <h3 className="text-lg font-bold">Estadísticas de Uso</h3>
            <span className="text-xs text-zinc-500 ml-auto">
              {stats.range?.days ? `Últimos ${stats.range.days} días` : 'Mes actual'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Temas por escaneo</p>
              <p className="text-2xl font-bold text-white">
                {(stats.totalScans || 0) === 0 ? '—' : (stats.avgTopicsPerScan || 0).toFixed(1)}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {stats.totalScans || 0} escaneos
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Borradores aprobados</p>
              <p className="text-2xl font-bold text-white">
                {stats.approvedDrafts || 0}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {stats.approvalRate?.toFixed(0) || 0}% de {stats.totalDrafts || 0}
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Costo promedio</p>
              <p className="text-2xl font-bold text-white">
                {stats.avgCost > 0 ? `$${stats.avgCost.toFixed(4)}` : '—'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {stats.totalCost > 0 ? `Total: $${stats.totalCost.toFixed(2)}` : 'Sin datos'}
              </p>
            </div>
          </div>

          {/* Desglose de costos por tipo */}
          {stats.costsByType && Object.keys(stats.costsByType).length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <p className="text-xs text-zinc-500 mb-2">Desglose de costos:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(stats.costsByType).map(([type, data]) => (
                  <div key={type} className="text-xs">
                    <span className="text-zinc-400 capitalize">{type}:</span>
                    <span className="text-white ml-1 font-medium">
                      ${data.total.toFixed(2)}
                    </span>
                    <span className="text-zinc-600 ml-1">({data.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Información del sistema */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-400 mt-1" size={20} />
          <div>
            <h4 className="font-bold text-blue-400 mb-2">Información importante</h4>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>• El escaneo solo detecta temas, NO genera texto automáticamente</li>
              <li>• Debes seleccionar manualmente los temas que deseas convertir en borradores</li>
              <li>• Los borradores generados NO se publican automáticamente</li>
              <li>• Revisa y edita cada borrador antes de publicarlo</li>
              <li>• Las imágenes generadas pueden requerir revisión editorial</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          aria-label="Guardar configuración"
          className="h-11 xl:h-12 min-w-[44px] flex items-center justify-center gap-2 px-6 lg:px-8 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="hidden sm:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span className="hidden sm:inline">Guardar Configuración</span>
              <span className="sm:hidden">Guardar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
