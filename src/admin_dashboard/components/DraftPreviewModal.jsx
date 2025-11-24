// src/admin_dashboard/components/DraftPreviewModal.jsx
import { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, CheckCircle, AlertCircle, MessageSquare, Clock, FileText, Eye, EyeOff, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DraftPreviewModal({ draft, onClose, onApprove, onResetToPending, onPublish, onRefresh }) {
  const [imageKey, setImageKey] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [diffHtml, setDiffHtml] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [showReviewDiff, setShowReviewDiff] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  // Forzar re-render cuando cambie coverHash
  useEffect(() => {
    if (draft?.coverHash) {
      setImageKey(prev => prev + 1);
    }
  }, [draft?.coverHash]);
  
  // Mapeo de proveedor de imagen a label legible
  const getProviderLabel = (provider) => {
    const providerMap = {
      'dall-e-3': 'DALL·E',
      'dall-e-2': 'DALL·E 2',
      'hailuo': 'Hailuo',
      'internal': 'Interno',
      'stable-diffusion': 'SD',
      'midjourney': 'MJ'
    };
    return providerMap[provider] || provider || 'DALL·E';
  };
  
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove(draft._id);
    }
  };

  const handleResetToPending = () => {
    if (onResetToPending) {
      onResetToPending(draft._id);
    }
  };

  const handlePublish = () => {
    if (onPublish) {
      onPublish(draft);
    }
  };

  // Lógica condicional de botones
  const reviewStatus = draft?.reviewStatus || 'pending';
  const canApprove = reviewStatus !== 'approved';
  const canReset = reviewStatus !== 'pending';
  const canPublish = reviewStatus === 'approved' && !draft?.publishedAs;
  
  // Cargar diff cuando se active
  const loadDiff = async (baseline = 'approved') => {
    setLoadingDiff(true);
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draft._id}/diff?baseline=${baseline}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      if (!data.hasBaseline) {
        toast.error('No hay versión base para comparar');
        setShowDiff(false);
        return;
      }
      
      if (!data.hasChanges) {
        toast('No hay cambios entre versiones', { icon: 'ℹ️' });
      }
      
      // Usar diff2html para renderizar (debe estar cargado globalmente o via CDN)
      if (window.Diff2Html) {
        const html = window.Diff2Html.getPrettyHtml(data.patch, {
          inputFormat: 'diff',
          showFiles: false,
          matching: 'lines',
          outputFormat: 'side-by-side'
        });
        setDiffHtml(html);
      } else {
        // Fallback: mostrar patch en texto plano
        setDiffHtml(`<pre class="text-xs overflow-x-auto p-4 bg-zinc-900 rounded">${data.patch}</pre>`);
      }
    } catch (error) {
      console.error('Error cargando diff:', error);
      toast.error('Error al cargar diferencias');
    } finally {
      setLoadingDiff(false);
    }
  };
  
  const toggleDiff = () => {
    if (!showDiff) {
      loadDiff('approved');
    }
    setShowDiff(prev => !prev);
  };
  
  // Polling para verificar estado de revisión
  const checkRevisionStatus = async () => {
    try {
      const cacheBuster = Date.now();
      const res = await fetch(`/api/redactor-ia/drafts/${draft._id}/revision?v=${cacheBuster}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      if (data.status === 'ready') {
        setReviewData(data);
        toast.success('Revisión completada', { id: 'revision-status' });
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setIsGenerating(false);
      } else if (data.status === 'error') {
        toast.error(`Error: ${data.errorMsg || 'Error desconocido'}`, { id: 'revision-status' });
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setIsGenerating(false);
      } else if (data.status === 'pending') {
        // Continuar polling
        toast.loading('Procesando revisión...', { id: 'revision-status' });
      }
    } catch (error) {
      console.error('Error checking revision:', error);
    }
  };
  
  // Iniciar polling automático si hay revisión pendiente
  useEffect(() => {
    if (draft?.review?.status === 'pending') {
      setIsGenerating(true);
      const interval = setInterval(checkRevisionStatus, 3000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (draft?.review?.status === 'ready') {
      setReviewData({
        status: 'ready',
        proposed: draft.review.proposed,
        diff: draft.review.diff,
        model: draft.review.model,
        finishedAt: draft.review.finishedAt
      });
    }
  }, [draft?._id, draft?.review?.status]);
  
  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);
  
  // Solicitar revisión con IA
  const handleRequestRevision = async () => {
    if (!draft?.reviewNotes?.trim()) {
      toast.error('Agrega una Nota de revisión con las instrucciones');
      return;
    }
    
    setIsGenerating(true);
    toast.loading('Solicitando revisión...', { id: 'request-revision' });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draft._id}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: draft.reviewNotes })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Revisión iniciada', { id: 'request-revision' });
        // Iniciar polling
        const interval = setInterval(checkRevisionStatus, 3000);
        setPollingInterval(interval);
      } else {
        toast.error(data.error || 'Error al solicitar revisión', { id: 'request-revision' });
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error solicitando revisión:', error);
      toast.error('Error de conexión', { id: 'request-revision' });
      setIsGenerating(false);
    }
  };
  
  // Cargar diff de revisión desde servidor
  const loadReviewDiff = async () => {
    if (!reviewData?.proposed) return;
    
    setLoadingDiff(true);
    try {
      const cacheBuster = reviewData.finishedAt || Date.now();
      const res = await fetch(`/api/redactor-ia/drafts/${draft._id}/diff?baseline=current&v=${cacheBuster}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      if (!data.hasChanges || !data.patch) {
        setDiffHtml('<div class="p-4 text-center text-zinc-400">Sin cambios relevantes detectados</div>');
      } else if (data.patch) {
        // Renderizar diff
        if (window.Diff2Html) {
          const html = window.Diff2Html.getPrettyHtml(data.patch, {
            inputFormat: 'diff',
            showFiles: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
          });
          setDiffHtml(html);
        } else {
          setDiffHtml(`<pre class="text-xs overflow-x-auto p-4 bg-zinc-900 rounded">${data.patch}</pre>`);
        }
      } else if (reviewData.diff) {
        // Fallback: usar diff guardado en review
        if (window.Diff2Html) {
          const html = window.Diff2Html.getPrettyHtml(reviewData.diff, {
            inputFormat: 'diff',
            showFiles: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
          });
          setDiffHtml(html);
        } else {
          setDiffHtml(`<pre class="text-xs overflow-x-auto p-4 bg-zinc-900 rounded">${reviewData.diff}</pre>`);
        }
      }
    } catch (error) {
      console.error('Error cargando diff de revisión:', error);
      toast.error('Error al cargar diferencias');
    } finally {
      setLoadingDiff(false);
    }
  };
  
  // Toggle diff de revisión
  const toggleReviewDiff = () => {
    if (!showReviewDiff) {
      loadReviewDiff();
    }
    setShowReviewDiff(prev => !prev);
  };
  
  // Aplicar revisión
  const applyRevision = async () => {
    if (!reviewData?.proposed) return;
    
    setIsApplying(true);
    toast.loading('Aplicando cambios...', { id: 'apply-revision' });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draft._id}/apply-revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Cambios aplicados al borrador', { id: 'apply-revision' });
        setReviewData(null);
        setShowReviewDiff(false);
        // Refrescar borrador sin cerrar modal
        if (onRefresh) await onRefresh();
      } else {
        toast.error(data.error || 'No se pudieron aplicar los cambios', { id: 'apply-revision' });
      }
    } catch (error) {
      console.error('Error aplicando revisión:', error);
      toast.error('Error de conexión', { id: 'apply-revision' });
    } finally {
      setIsApplying(false);
    }
  };
  
  // Descartar revisión
  const handleDiscardRevision = () => {
    setReviewData(null);
    setShowReviewDiff(false);
    toast.info('Revisión descartada');
  };
  

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
          <h3 className="text-lg font-semibold text-white">Vista previa del borrador</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white/70 hover:text-white transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Imagen principal con cache-bust */}
            {(draft?.coverUrl || draft?.generatedImages?.principal) && (
              <div key={`cover-${draft.coverHash || imageKey}`} className="relative">
                {draft.coverUrl && draft.imageKind === 'processed' ? (
                  <picture className="block w-full">
                    <source 
                      srcSet={`${draft.coverUrl}?v=${draft.coverHash || ''}`}
                      type="image/avif"
                    />
                    <img
                      src={`${draft.coverFallbackUrl || draft.coverUrl}?v=${draft.coverHash || ''}`}
                      alt={draft.titulo || 'Imagen principal'}
                      className="w-full h-56 md:h-64 object-cover rounded-lg border border-zinc-800 shadow-lg"
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                ) : (
                  <img
                    src={`${draft.coverUrl || draft.generatedImages?.principal}?v=${draft.coverHash || Date.now()}`}
                    alt={draft.titulo || 'Imagen principal'}
                    className="w-full h-56 md:h-64 object-cover rounded-lg border border-zinc-800 shadow-lg"
                    loading="eager"
                    decoding="async"
                  />
                )}
                
                {/* Badge de tipo de imagen */}
                {/* @fix: Generar IA encadenado (extraer→referenciar→DALL-E) — 2025-10 */}
                {/** @feature: opción "Generar desde contexto" (sin referencia, solo DALL-E) — Oct 2025 **/}
                {(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
                  <div 
                    className="absolute bottom-2 right-2 px-2 py-1 bg-purple-600/90 backdrop-blur text-white text-xs rounded font-medium"
                    title={draft.aiMetadata?.usedSource === false ? "Generada con IA desde contexto (sin referencia)" : "Generada con IA usando referencia de fuente"}
                  >
                    {draft.aiMetadata?.usedSource === false 
                      ? '✨ IA - sin ref'
                      : `✨ IA (${getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})`
                    }
                  </div>
                )}
                {/* @fix Claude 4.5 – Corrección flujo de imágenes procesadas Redactor IA (2025-10) */}
                {draft.imageKind === 'processed' && (
                  <div 
                    className="absolute bottom-2 right-2 px-2 py-1 bg-emerald-600/90 backdrop-blur text-white text-xs rounded"
                    title="Imagen procesada y almacenada localmente desde fuente"
                  >
                    ✓ Procesada
                  </div>
                )}
                
                {/* Badge de likeness (figura real vs contextual) */}
                {draft?.aiMetadata?.likenessMetadata && (
                  <div 
                    className={`absolute bottom-2 left-2 px-2 py-1 backdrop-blur text-white text-xs rounded font-medium flex items-center gap-1 ${
                      draft.aiMetadata.likenessMetadata.likeness
                        ? 'bg-amber-600/90'
                        : 'bg-blue-600/90'
                    }`}
                    title={
                      draft.aiMetadata.likenessMetadata.likeness
                        ? `Figura real: ${draft.aiMetadata.likenessMetadata.person || 'personaje detectado'} (con referencia)`
                        : draft.aiMetadata.likenessMetadata.person
                        ? `Imagen contextual: ${draft.aiMetadata.likenessMetadata.person} (sin referencia disponible)`
                        : 'Imagen contextual'
                    }
                  >
                    {draft.aiMetadata.likenessMetadata.likeness ? (
                      <>🎭 Figura real</>
                    ) : (
                      <>🏛️ Contextual</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Título */}
            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
              {draft?.titulo || 'Sin título'}
            </h2>

            {/* Metadatos */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20 font-medium">
                {draft?.categoria || 'Sin categoría'}
              </span>
              <span className={`px-2 py-1 rounded font-medium ring-1 ${
                draft?.mode === 'opinion'
                  ? 'bg-purple-500/15 text-purple-300 ring-purple-500/20'
                  : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20'
              }`}>
                {draft?.mode === 'opinion' ? 'Opinión' : 'Factual'}
              </span>
              
              {/* Confianza de categoría */}
              {draft?.aiMetadata?.categoryConfidence != null && (
                <span className={`px-2 py-1 rounded font-medium flex items-center gap-1 ${
                  draft.aiMetadata.categoryLowConfidence
                    ? 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/20'
                    : draft.aiMetadata.categoryConfidence >= 0.7
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20'
                }`}>
                  {draft.aiMetadata.categoryLowConfidence && <AlertCircle size={12} />}
                  Cat: {Math.round(draft.aiMetadata.categoryConfidence * 100)}%
                </span>
              )}

              {/* Originalidad */}
              {draft?.aiMetadata?.originalityScore !== undefined && (
                <span className={`px-2 py-1 rounded font-medium ${
                  draft.aiMetadata.contentOrigin === 'ai_synthesized'
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20'
                    : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20'
                }`}>
                  {draft.aiMetadata.contentOrigin === 'ai_synthesized' 
                    ? `Original ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                    : `Derivado ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                  }
                </span>
              )}

              {/* Estado de revisión */}
              {draft?.reviewStatus && draft.reviewStatus !== 'pending' && (
                <span className={`px-2 py-1 rounded font-medium flex items-center gap-1 ${
                  draft.reviewStatus === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20'
                    : draft.reviewStatus === 'changes_requested'
                    ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20'
                    : draft.reviewStatus === 'changes_in_progress'
                    ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20'
                    : draft.reviewStatus === 'changes_completed'
                    ? 'bg-green-500/15 text-green-300 ring-1 ring-green-500/20'
                    : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/20'
                }`}>
                  {draft.reviewStatus === 'approved' ? (
                    <><CheckCircle size={12} /> Aprobado</>
                  ) : draft.reviewStatus === 'changes_requested' ? (
                    <><MessageSquare size={12} /> Cambios solicitados</>
                  ) : draft.reviewStatus === 'changes_in_progress' ? (
                    <><Clock size={12} /> En revisión por IA</>
                  ) : draft.reviewStatus === 'changes_completed' ? (
                    <><CheckCircle size={12} /> Cambios aplicados</>
                  ) : (
                    <><AlertCircle size={12} /> Rechazado</>
                  )}
                </span>
              )}
            </div>

            {/* Etiquetas */}
            {draft?.etiquetas?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.etiquetas.map((tag, idx) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bajada */}
            {draft?.bajada && (
              <p className="text-zinc-300 leading-relaxed text-base border-l-2 border-cyan-500/50 pl-3 italic">
                {draft.bajada}
              </p>
            )}
            
            {/* Botón ver diferencias */}
            {(draft?.lastApprovedContent || draft?.previousContent) && (
              <div className="flex gap-2">
                <button
                  onClick={toggleDiff}
                  disabled={loadingDiff}
                  className="px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {loadingDiff ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : showDiff ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                  {showDiff ? 'Ocultar diferencias' : 'Ver diferencias'}
                </button>
              </div>
            )}
            
            {/* Vista diff */}
            {showDiff && diffHtml && (
              <div className="mt-3 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900/50">
                <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-700 text-xs text-zinc-400 font-medium">
                  Comparación: Versión aprobada vs. Actual
                </div>
                <div 
                  className="prose prose-invert prose-sm max-w-none overflow-x-auto" 
                  dangerouslySetInnerHTML={{ __html: diffHtml }}
                  style={{ fontSize: '12px' }}
                />
              </div>
            )}

            {/* Contenido HTML */}
            {!showDiff && !showReviewDiff && (
              <div
                className="prose prose-invert prose-sm md:prose-base max-w-none"
                dangerouslySetInnerHTML={{ __html: draft?.contenidoHTML || '' }}
              />
            )}
            
            {/* Revisión propuesta por IA */}
            {reviewData?.proposed && !showDiff && !showReviewDiff && (
              <section className="mt-4 rounded-lg border border-sky-700 bg-sky-900/30 p-4">
                <div className="text-sm font-semibold text-sky-300 mb-3 flex items-center gap-2">
                  <Sparkles size={16} />
                  Versión revisada por IA ({reviewData.model})
                </div>
                <article 
                  className="prose prose-invert prose-sm md:prose-base max-w-none"
                  dangerouslySetInnerHTML={{ __html: reviewData.proposed }}
                />
                
                {/* Botones de acción para la revisión */}
                <div className="mt-4 pt-4 border-t border-sky-700/50 flex items-center gap-3">
                  <button
                    onClick={applyRevision}
                    disabled={isApplying}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-medium shadow-sm"
                    aria-label="Aplicar cambios de revisión al borrador"
                  >
                    {isApplying ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Aplicar cambios
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDiscardRevision}
                    disabled={isApplying}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                    aria-label="Descartar revisión sin aplicar cambios"
                  >
                    <X size={16} />
                    Descartar revisión
                  </button>
                </div>
              </section>
            )}
            
            {/* Diff de revisión */}
            {showReviewDiff && diffHtml && (
              <div className="mt-3 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900/50">
                <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-700 text-xs text-zinc-400 font-medium flex items-center gap-2">
                  <FileText size={14} />
                  Comparación: Contenido actual vs. Revisión IA
                  <span className="ml-auto px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">vs. borrador actual</span>
                </div>
                <div 
                  className="prose prose-invert prose-sm max-w-none overflow-x-auto" 
                  dangerouslySetInnerHTML={{ __html: diffHtml }}
                  style={{ fontSize: '12px' }}
                />
              </div>
            )}

            {/* Notas de revisión */}
            {draft?.reviewNotes && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300 mb-1">Notas de revisión:</p>
                    <p className="text-sm text-zinc-300">{draft.reviewNotes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fuentes */}
            {Array.isArray(draft?.fuentes) && draft.fuentes.length > 0 && (
              <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-semibold mb-3 flex items-center gap-2">
                  <ExternalLink size={14} />
                  Fuentes utilizadas ({draft.fuentes.length})
                </h3>
                <ul className="space-y-2">
                  {draft.fuentes.map((f, i) => (
                    <li key={i} className="text-sm">
                      {f?.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 group"
                        >
                          <ExternalLink size={12} className="flex-shrink-0" />
                          <span className="group-hover:underline">
                            {f?.titulo || f.medio || f.url}
                          </span>
                        </a>
                      ) : (
                        <span className="text-zinc-400">{f?.titulo || f.medio || 'Fuente sin título'}</span>
                      )}
                      {f?.medio && (
                        <span className="text-xs text-zinc-500 ml-2">· {f.medio}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata técnico (colapsado) */}
            {draft?.aiMetadata && (
              <details className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors">
                  Metadata técnico (debugging)
                </summary>
                <div className="mt-2 text-xs text-zinc-500 space-y-1">
                  <p>Modelo: {draft.aiMetadata.model}</p>
                  <p>Tokens: {draft.aiMetadata.tokensUsed || 'N/A'}</p>
                  <p>Tiempo: {draft.aiMetadata.generationTime ? (draft.aiMetadata.generationTime / 1000).toFixed(1) + 's' : 'N/A'}</p>
                  <p>Confianza general: {draft.aiMetadata.confidence || 0}%</p>
                  {draft.aiMetadata.categoryDetail && (
                    <details className="mt-2">
                      <summary className="cursor-pointer hover:text-zinc-400">Detalle de clasificación</summary>
                      <pre className="mt-1 text-[10px] overflow-x-auto">
                        {JSON.stringify(JSON.parse(draft.aiMetadata.categoryDetail), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </details>
            )}
            
          </div>
        </div>

        {/* Footer con acciones */}
        {(onApprove || onResetToPending || onPublish) && (
          <div className="p-4 border-t border-zinc-700/50 space-y-3">
            {/* Fila 1: Solicitar revisión o ver diff */}
            {draft?.reviewNotes && (
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-700/50">
                {/* Botón solicitar revisión (solo si no hay revisión en curso o lista) */}
                {!isGenerating && !reviewData?.proposed && (
                  <button
                    onClick={handleRequestRevision}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors flex items-center gap-2 font-medium border border-amber-600/60 shadow-sm"
                  >
                    <Sparkles size={16} />
                    Solicitar revisión con IA
                  </button>
                )}
                
                {/* Indicador de procesamiento */}
                {isGenerating && (
                  <div className="px-4 py-2 bg-sky-600/30 border border-sky-600/50 text-sky-200 rounded-lg flex items-center gap-2 text-sm">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                    Generando revisión...
                  </div>
                )}
                
                {/* Botón ver diff (solo si hay revisión lista) */}
                {reviewData?.proposed && (
                  <button
                    onClick={toggleReviewDiff}
                    disabled={loadingDiff}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {loadingDiff ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : showReviewDiff ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                    {showReviewDiff ? 'Ocultar diferencias' : 'Ver diferencias'}
                  </button>
                )}
              </div>
            )}
            
            {/* Fila 2: Acciones normales */}
            <div className="flex justify-between items-center gap-3">
              <div className="flex gap-2">
                {onResetToPending && canReset && (
                  <button
                    onClick={handleResetToPending}
                    disabled={isGenerating || isApplying}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Clock size={16} />
                    Volver a pendiente
                  </button>
                )}
                {onPublish && canPublish && (
                  <button
                    onClick={handlePublish}
                    disabled={isGenerating || isApplying}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <ExternalLink size={16} />
                    Publicar
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {onApprove && canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={isGenerating || isApplying}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Aprobar
                  </button>
                )}
                <button
                  onClick={onClose}
                  disabled={isGenerating || isApplying}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
