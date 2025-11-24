import React, { useState, useEffect, useMemo } from "react";

// Configuración de tamaños y límites para optimizar costos
const AI_IMAGE_CONFIG = {
  BASE_MAIN: 1024,     // portada en HQ
  BASE_OPT: 768,       // secundaria en HQ (más barata)
  PREVIEW: 512,        // previsualización
  MAX_ATTEMPTS_MAIN: 1,
  MAX_ATTEMPTS_OPT: 1,
  DAILY_LIMIT: 40
};

const SkeletonCard = () => (
  <div className="bg-zinc-900 border border-zinc-700 rounded p-2 animate-pulse">
    <div className="w-full aspect-square bg-zinc-800 rounded" />
    <div className="mt-2 h-7 bg-zinc-800 rounded" />
  </div>
);

// Función para generar hash único basado en contenido y rol
const generateHash = (title, content, style, role) => {
  const str = `${title}|${content}|${style}|${role}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `ai-img-${Math.abs(hash)}`;
};

// Función simple para verificar similitud entre imágenes (opcional)
const checkImageSimilarity = async (url1, url2) => {
  if (!url1 || !url2 || url1 === url2) return true;
  
  try {
    // Crear imágenes
    const img1 = new Image();
    const img2 = new Image();
    img1.crossOrigin = "anonymous";
    img2.crossOrigin = "anonymous";
    
    // Cargar imágenes
    await Promise.all([
      new Promise((resolve, reject) => {
        img1.onload = resolve;
        img1.onerror = reject;
        img1.src = url1;
      }),
      new Promise((resolve, reject) => {
        img2.onload = resolve;
        img2.onerror = reject;
        img2.src = url2;
      })
    ]);
    
    // Crear canvas pequeños para análisis rápido
    const size = 8; // Reducir a 8x8 para análisis rápido
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    canvas1.width = canvas1.height = size;
    canvas2.width = canvas2.height = size;
    
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    
    // Dibujar imágenes reducidas
    ctx1.drawImage(img1, 0, 0, size, size);
    ctx2.drawImage(img2, 0, 0, size, size);
    
    // Obtener datos de píxeles
    const data1 = ctx1.getImageData(0, 0, size, size).data;
    const data2 = ctx2.getImageData(0, 0, size, size).data;
    
    // Calcular diferencia simple
    let diff = 0;
    for (let i = 0; i < data1.length; i += 4) {
      diff += Math.abs(data1[i] - data2[i]); // R
      diff += Math.abs(data1[i+1] - data2[i+1]); // G
      diff += Math.abs(data1[i+2] - data2[i+2]); // B
    }
    
    // Normalizar diferencia (0-1)
    const maxDiff = size * size * 3 * 255;
    const similarity = 1 - (diff / maxDiff);
    
    console.log(`[AI Similarity] Similitud: ${(similarity * 100).toFixed(1)}%`);
    
    // Si la similitud es mayor al 85%, considerar las imágenes como muy similares
    return similarity > 0.85;
    
  } catch (error) {
    console.error('[AI Similarity] Error comparando imágenes:', error);
    return false; // En caso de error, asumir que no son similares
  }
};

export default function AIImageGenerator({
  newsId,
  title,
  content,
  disabled = false,
  onPickCover,
  onPickSecondary,
  onTempChange,
}) {
  // Estados principales
  const [style, setStyle] = useState("realista");
  const [previews, setPreviews] = useState({ main: null, secondary: null });
  const [confirmationMode, setConfirmationMode] = useState(false);
  const [useSameForSecondary, setUseSameForSecondary] = useState(false);
  
  // Estados de carga
  const [isGenPreview, setIsGenPreview] = useState(false);
  const [isGenMainHQ, setIsGenMainHQ] = useState(false);
  const [isGenOptHQ, setIsGenOptHQ] = useState(false);
  
  // Control de errores y límites
  const [err, setErr] = useState(null);
  const [billingLocked, setBillingLocked] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  
  // Generar tempId persistente para modo temporal
  const [tempId] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  });
  
  // Estado para imágenes pendientes en modo temporal
  const [pending, setPending] = useState({ coverUrl: null, secondaryUrl: null });
  
  // Cache de imágenes generadas
  const [imageCache, setImageCache] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-image-cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Determinar si se puede generar
  const canGenerate = (!!newsId || !!tempId) && !isGenPreview && !isGenMainHQ && !isGenOptHQ && !billingLocked && dailyCount < AI_IMAGE_CONFIG.DAILY_LIMIT;
  
  // Guardar cache cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem('ai-image-cache', JSON.stringify(imageCache));
    } catch (error) {
      console.error('[AI Cache] Error guardando cache:', error);
    }
  }, [imageCache]);
  
  // Cargar contador diario
  useEffect(() => {
    const today = new Date().toDateString();
    const savedCount = localStorage.getItem(`ai-daily-count-${today}`);
    setDailyCount(savedCount ? parseInt(savedCount) : 0);
    
    // Limpiar contadores antiguos
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('ai-daily-count-') && !key.includes(today)) {
        localStorage.removeItem(key);
      }
    });
  }, []);
  
  // Cargar selecciones pendientes desde sessionStorage
  useEffect(() => {
    if (!newsId && tempId) {
      try {
        const saved = sessionStorage.getItem(`ai-temp-${tempId}`);
        if (saved) {
          const parsedPending = JSON.parse(saved);
          setPending(parsedPending);
        }
      } catch (error) {
        console.error('[AI] Error cargando datos temporales:', error);
      }
    }
  }, [tempId, newsId]);
  
  // Emitir cambios en selecciones temporales
  useEffect(() => {
    if (!newsId && onTempChange) {
      onTempChange({ tempId, ...pending });
    }
  }, [pending, tempId, newsId, onTempChange]);

  // Incrementar contador diario
  const incrementDailyCount = () => {
    const today = new Date().toDateString();
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem(`ai-daily-count-${today}`, newCount.toString());
  };

  // Generar previews de baja resolución
  const generatePreviews = async () => {
    if (!canGenerate || (!newsId && !tempId)) return;
    
    setErr(null);
    setIsGenPreview(true);
    setConfirmationMode(false);
    
    try {
      // Revisar cache primero
      const hashMain = generateHash(title, content, style, 'main');
      const hashOpt = generateHash(title, content, style, 'optional');
      
      if (imageCache[hashMain] && imageCache[hashOpt]) {
        console.log('[AI Cache] Usando imágenes desde cache');
        setPreviews({
          main: imageCache[hashMain],
          secondary: imageCache[hashOpt]
        });
        setConfirmationMode(true);
        return;
      }
      
      // Generar preview de portada (512px)
      console.log('[AI Preview] Generando preview de portada...');
      const resMain = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "",
          content: content || "",
          style,
          size: AI_IMAGE_CONFIG.PREVIEW,
          n: 1,
          role: 'main',
          ...(newsId ? { newsId } : { tempId })
        }),
      });
      
      if (!resMain.ok) {
        const data = await resMain.json().catch(() => ({}));
        
        // Detectar límite de billing
        if (data?.code === 'billing_hard_limit_reached') {
          setBillingLocked(true);
          throw new Error("Se alcanzó el límite de facturación. Por favor contacta soporte.");
        }
        
        if (data?.code === "ORG_NOT_VERIFIED" || 
            (data?.message && data.message.includes("must be verified"))) {
          throw new Error("Tu organización debe estar verificada para usar gpt-image-1. Verifica en OpenAI y reintenta.");
        }
        
        throw new Error(data?.message || "Error al generar preview de portada");
      }
      
      const dataMain = await resMain.json();
      const previewMainUrl = dataMain?.images?.[0]?.url;
      
      if (!previewMainUrl) {
        throw new Error("No se pudo generar preview de portada");
      }
      
      incrementDailyCount();
      
      // Generar preview de secundaria (512px)
      console.log('[AI Preview] Generando preview secundaria...');
      let secondaryFailed = false;
      let previewOptUrl = null;
      
      try {
        const resOpt = await fetch("/api/ai/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "",
            content: content || "",
            style,
            size: AI_IMAGE_CONFIG.PREVIEW,
            n: 1,
            role: 'optional',
            ...(newsId ? { newsId } : { tempId })
          }),
        });
        
        if (!resOpt.ok) {
          const data = await resOpt.json().catch(() => ({}));
          
          if (data?.code === 'billing_hard_limit_reached') {
            setBillingLocked(true);
            throw new Error("Se alcanzó el límite de facturación.");
          }
          
          // Si falla la secundaria, marcar el error pero NO usar fallback automático
          console.error('[AI Preview] Error generando secundaria:', data?.message || resOpt.status);
          secondaryFailed = true;
        } else {
          const dataOpt = await resOpt.json();
          previewOptUrl = dataOpt?.images?.[0]?.url;
          
          if (!previewOptUrl) {
            secondaryFailed = true;
          } else {
            incrementDailyCount();
          }
        }
      } catch (error) {
        console.error('[AI Preview] Error generando secundaria:', error.message);
        secondaryFailed = true;
      }
      
      // Si falló la secundaria, preguntar al usuario qué hacer
      if (secondaryFailed) {
        setErr("No se pudo generar la imagen secundaria. Puedes activar 'Usar la misma imagen para secundaria' o reintentar.");
        setPreviews({
          main: previewMainUrl,
          secondary: null // NO establecer automáticamente la misma
        });
        setConfirmationMode(true);
        return;
      }
      
      // Verificar similitud antes de establecer las previews
      if (previewOptUrl && previewOptUrl !== previewMainUrl) {
        const areSimilar = await checkImageSimilarity(previewMainUrl, previewOptUrl);
        
        if (areSimilar) {
          console.log('[AI Preview] Imágenes detectadas como muy similares, regenerando secundaria...');
          
          // Intentar regenerar una vez más la secundaria con un prompt ligeramente modificado
          try {
            const resOptRetry = await fetch("/api/ai/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: title || "",
                content: content || "",
                style,
                size: AI_IMAGE_CONFIG.PREVIEW,
                n: 1,
                role: 'optional',
                // Agregar timestamp para forzar variación
                variation: Date.now(),
                ...(newsId ? { newsId } : { tempId })
              }),
            });
            
            if (resOptRetry.ok) {
              const dataOptRetry = await resOptRetry.json();
              const newOptUrl = dataOptRetry?.images?.[0]?.url;
              if (newOptUrl) {
                console.log('[AI Preview] Secundaria regenerada exitosamente');
                previewOptUrl = newOptUrl;
                incrementDailyCount();
              }
            }
          } catch (retryError) {
            console.error('[AI Preview] Error regenerando secundaria:', retryError);
            // Continuar con la imagen similar
          }
        }
      }
      
      setPreviews({
        main: previewMainUrl,
        secondary: previewOptUrl || null
      });
      setConfirmationMode(true);
      
    } catch (e) {
      setErr(e.message);
    } finally {
      setIsGenPreview(false);
    }
  };

  // Confirmar y generar versiones HQ
  const confirmAndGenerateHQ = async () => {
    if (!previews.main || (!newsId && !tempId)) return;
    
    // Si no hay preview secundaria y no se activa usar la misma, no continuar
    if (!previews.secondary && !useSameForSecondary) {
      setErr("Debes tener una imagen secundaria o activar 'Usar la misma imagen para secundaria'");
      return;
    }
    
    setErr(null);
    
    try {
      // Generar portada HQ (1024px)
      setIsGenMainHQ(true);
      console.log('[AI HQ] Generando portada en alta calidad...');
      
      const resMainHQ = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "",
          content: content || "",
          style,
          size: AI_IMAGE_CONFIG.BASE_MAIN,
          n: 1,
          role: 'main',
          square: true, // Solo generar versión cuadrada, la 16:9 se deriva
          ...(newsId ? { newsId } : { tempId })
        }),
      });
      
      if (!resMainHQ.ok) {
        const data = await resMainHQ.json().catch(() => ({}));
        if (data?.code === 'billing_hard_limit_reached') {
          setBillingLocked(true);
          throw new Error("Se alcanzó el límite de facturación.");
        }
        throw new Error(data?.message || "Error al generar portada HQ");
      }
      
      const dataMainHQ = await resMainHQ.json();
      const mainHQUrl = dataMainHQ?.images?.[0]?.url;
      
      if (!mainHQUrl) {
        throw new Error("No se pudo generar portada HQ");
      }
      
      // Guardar en cache
      const hashMain = generateHash(title, content, style, 'main');
      setImageCache(prev => ({ ...prev, [hashMain]: mainHQUrl }));
      
      // Procesar portada con callback
      if (onPickCover) {
        await onPickCover(mainHQUrl);
      }
      
      setIsGenMainHQ(false);
      incrementDailyCount();
      
      // Generar secundaria HQ solo si no se usa la misma
      if (!useSameForSecondary && previews.secondary) {
        setIsGenOptHQ(true);
        console.log('[AI HQ] Generando secundaria en alta calidad...');
        
        let secondaryHQFailed = false;
        let optHQUrl = null;
        
        try {
          const resOptHQ = await fetch("/api/ai/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title || "",
              content: content || "",
              style,
              size: AI_IMAGE_CONFIG.BASE_OPT,
              n: 1,
              role: 'optional',
              ...(newsId ? { newsId } : { tempId })
            }),
          });
          
          if (!resOptHQ.ok) {
            const data = await resOptHQ.json().catch(() => ({}));
            if (data?.code === 'billing_hard_limit_reached') {
              setBillingLocked(true);
              throw new Error("Se alcanzó el límite de facturación.");
            }
            
            console.error('[AI HQ] Error generando secundaria HQ:', data?.message || resOptHQ.status);
            secondaryHQFailed = true;
          } else {
            const dataOptHQ = await resOptHQ.json();
            optHQUrl = dataOptHQ?.images?.[0]?.url;
            
            if (!optHQUrl) {
              secondaryHQFailed = true;
            }
          }
        } catch (error) {
          console.error('[AI HQ] Error generando secundaria HQ:', error.message);
          secondaryHQFailed = true;
        }
        
        setIsGenOptHQ(false);
        
        // Si falló la secundaria HQ, preguntar qué hacer
        if (secondaryHQFailed) {
          const userConfirm = window.confirm(
            "No se pudo generar la imagen secundaria en alta calidad. " +
            "¿Deseas usar la imagen principal también como secundaria?"
          );
          
          if (userConfirm) {
            console.log('[AI HQ] Usuario eligió usar portada como secundaria');
            if (onPickSecondary) {
              await onPickSecondary(mainHQUrl);
            }
          } else {
            throw new Error("Generación de imagen secundaria cancelada por el usuario");
          }
        } else if (optHQUrl) {
          // Éxito: guardar en cache y procesar
          const hashOpt = generateHash(title, content, style, 'optional');
          setImageCache(prev => ({ ...prev, [hashOpt]: optHQUrl }));
          
          if (onPickSecondary) {
            await onPickSecondary(optHQUrl);
          }
          incrementDailyCount();
        }
      } else if (useSameForSecondary || !previews.secondary) {
        // Usar la misma imagen para secundaria (por elección del usuario)
        console.log('[AI HQ] Usando misma imagen para secundaria (elección del usuario)');
        if (onPickSecondary) {
          await onPickSecondary(mainHQUrl);
        }
      }
      
      // Limpiar estado de confirmación
      setConfirmationMode(false);
      setPreviews({ main: null, secondary: null });
      
      // Notificar éxito
      alert("✅ Imágenes generadas y aplicadas correctamente");
      
    } catch (e) {
      setErr(e.message);
    } finally {
      setIsGenMainHQ(false);
      setIsGenOptHQ(false);
    }
  };

  // Cancelar modo confirmación
  const cancelConfirmation = () => {
    setConfirmationMode(false);
    setPreviews({ main: null, secondary: null });
  };

  // Verificar si está generando algo
  const isGenerating = isGenPreview || isGenMainHQ || isGenOptHQ;

  return (
    <fieldset className="mt-6 border border-zinc-700 rounded-lg p-4">
      <legend className="px-2 text-white/80">Generar imágenes con IA</legend>

      {disabled && (
        <div className="mb-3 text-xs text-white/60">
          {!title || !content 
            ? "Completa el título y contenido para generar imágenes con IA."
            : "Guarda la noticia para habilitar la generación con IA."
          }
        </div>
      )}
      
      {billingLocked && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-200">
          ⚠️ Se alcanzó el límite de facturación. Por favor contacta soporte.
        </div>
      )}
      
      {dailyCount >= AI_IMAGE_CONFIG.DAILY_LIMIT && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-200">
          ⚠️ Has alcanzado el límite diario de {AI_IMAGE_CONFIG.DAILY_LIMIT} generaciones.
        </div>
      )}

      {!confirmationMode ? (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            <label className="text-sm text-white/80">Estilo:</label>
            <select
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              disabled={disabled || isGenerating}
            >
              <option value="realista">Foto realista</option>
              <option value="ilustracion">Ilustración</option>
              <option value="infografia">Infografía</option>
            </select>

            <button
              onClick={generatePreviews}
              disabled={!canGenerate || !title?.trim() || !content?.trim()}
              className="ml-auto px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white disabled:opacity-60"
            >
              {isGenPreview ? "Generando previews…" : "Generar 2 (Portada + Opcional)"}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="useSameForSecondary"
              checked={useSameForSecondary}
              onChange={(e) => setUseSameForSecondary(e.target.checked)}
              className="rounded border-zinc-600"
            />
            <label htmlFor="useSameForSecondary" className="text-sm text-white/70">
              Usar la misma imagen para secundaria (ahorra créditos)
            </label>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-700 rounded p-4">
            <h3 className="text-sm font-medium mb-3 text-white">Vista previa de imágenes generadas</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-white/60 mb-1">Portada (se generará en 1024px)</p>
                <img
                  src={previews.main}
                  alt="Preview portada"
                  className="w-full aspect-square object-cover rounded border border-zinc-700"
                />
              </div>
              
              <div>
                <p className="text-xs text-white/60 mb-1">
                  Secundaria {useSameForSecondary ? "(usará la misma)" : "(se generará en 768px)"}
                </p>
                {(previews.secondary || useSameForSecondary) ? (
                  <img
                    src={useSameForSecondary ? previews.main : previews.secondary}
                    alt="Preview secundaria"
                    className="w-full aspect-square object-cover rounded border border-zinc-700"
                  />
                ) : (
                  <div className="w-full aspect-square bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center">
                    <p className="text-xs text-zinc-500 text-center px-4">
                      No se pudo generar preview secundaria. 
                      Activa "Usar la misma imagen" o reintenta.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={cancelConfirmation}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-white disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndGenerateHQ}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-60"
              >
                {isGenMainHQ ? "Generando portada HQ…" : 
                 isGenOptHQ ? "Generando secundaria HQ…" : 
                 "Confirmar y generar en alta calidad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-3 text-sm text-red-400">
          {err}
          {err.includes("verificada") && (
            <div className="mt-1">
              <a href="https://platform.openai.com/settings/organization/general"
                 target="_blank" rel="noreferrer"
                 className="underline">
                Abrir verificación de organización
              </a>
            </div>
          )}
        </div>
      )}

      {isGenerating && (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
          <span>
            {isGenPreview ? "Generando vistas previas..." :
             isGenMainHQ ? "Generando portada en alta calidad..." :
             isGenOptHQ ? "Generando imagen secundaria..." :
             "Procesando..."}
          </span>
        </div>
      )}

      <div className="mt-4 text-xs text-white/40">
        <p>• Las imágenes se generan primero en baja resolución (512px) para preview</p>
        <p>• Al confirmar, se generan en alta calidad: portada (1024px) y secundaria (768px)</p>
        <p>• La variante 16:9 de la portada se deriva automáticamente sin costo adicional</p>
        <p>• Generaciones hoy: {dailyCount} / {AI_IMAGE_CONFIG.DAILY_LIMIT}</p>
      </div>
    </fieldset>
  );
}