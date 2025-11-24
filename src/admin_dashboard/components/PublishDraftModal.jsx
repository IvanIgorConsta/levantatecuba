// src/admin_dashboard/components/PublishDraftModal.jsx
import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Tag, Folder, Sparkles } from 'lucide-react';

export default function PublishDraftModal({
  draft,
  onSubmit,
  onClose
}) {
  const [publishNow, setPublishNow] = useState(true);
  const [scheduleAt, setScheduleAt] = useState('');
  const [categoryOverride, setCategoryOverride] = useState('');
  const [tagsOverride, setTagsOverride] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const dateInputRef = useRef(null);

  const categories = ['General', 'Política', 'Economía', 'Internacional', 'Socio político', 'Tecnología'];

  useEffect(() => {
    // Setear valores por defecto del borrador
    setCategoryOverride(draft?.categoria || 'General');
    setTagsOverride(draft?.etiquetas || []);
    
    // Listener para Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [draft, isSubmitting, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    // Validación básica
    if (!publishNow && !scheduleAt) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        scheduleAt: publishNow ? null : scheduleAt,
        categoryOverride,
        tagsOverride: tagsOverride.length > 0 ? tagsOverride : undefined
      });
      onClose();
    } catch (error) {
      console.error('Error en submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = publishNow || (scheduleAt && new Date(scheduleAt) > new Date());

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-modal-title"
    >
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 id="publish-modal-title" className="text-lg font-semibold text-white">
            Publicar borrador
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Preview del borrador */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-zinc-400 mb-1">Vista previa:</p>
            <h4 className="text-base font-semibold text-white mb-2">{draft?.titulo}</h4>
            {draft?.bajada && (
              <p className="text-sm text-zinc-300">{draft.bajada}</p>
            )}
          </div>

          {/* Modo de publicación */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
              <input
                type="radio"
                checked={publishNow}
                onChange={() => setPublishNow(true)}
                disabled={isSubmitting}
                className="w-4 h-4 accent-indigo-500"
              />
              <div className="flex items-center gap-2 flex-1">
                <Clock size={18} className="text-indigo-400" />
                <div>
                  <span className="text-white font-medium">Publicar ahora</span>
                  <p className="text-xs text-zinc-400">La noticia se publicará inmediatamente</p>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
              <input
                type="radio"
                checked={!publishNow}
                onChange={() => setPublishNow(false)}
                disabled={isSubmitting}
                className="w-4 h-4 accent-indigo-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={18} className="text-indigo-400" />
                  <span className="text-white font-medium">Programar publicación</span>
                </div>
                {!publishNow && (
                  <input
                    ref={dateInputRef}
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    disabled={isSubmitting}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                )}
              </div>
            </label>
          </div>

          {/* Categoría (opcional override) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <Folder size={16} />
              Categoría
            </label>
            
            {/* Mostrar categoría sugerida por IA si existe */}
            {draft?.aiMetadata?.categoryConfidence !== undefined && (
              <p className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-cyan-400">
                  <Sparkles size={12} />
                  Sugerida por IA:
                </span>
                <span className="text-zinc-300 font-medium">
                  {draft.categoria}
                </span>
                <span className="text-zinc-500">
                  (precisión {Math.round((draft.aiMetadata.categoryConfidence || 0) * 100)}%)
                </span>
              </p>
            )}
            
            <select
              value={categoryOverride}
              onChange={(e) => setCategoryOverride(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Etiquetas (opcional override) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <Tag size={16} />
              Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              value={tagsOverride.join(', ')}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                setTagsOverride(tags);
              }}
              disabled={isSubmitting}
              placeholder="Cuba, Política, Internacional..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            {tagsOverride.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tagsOverride.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Advertencia si no es válido */}
          {!publishNow && !isValid && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Clock size={16} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                Selecciona una fecha y hora futura para programar la publicación
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publicando...
              </>
            ) : (
              publishNow ? 'Publicar ahora' : 'Programar publicación'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
