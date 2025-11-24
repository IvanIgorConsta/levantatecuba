// src/admin_dashboard/components/ReviewNotesModal.jsx
import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function ReviewNotesModal({
  title = 'Solicitar cambios',
  initialNotes = '',
  required = true,
  maxLength = 500,
  onSubmit,
  onClose,
  mode = 'notes' // 'notes' | 'changes-list' | 'ai-revision' | 'custom-cover-prompt'
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);

  // Resetear notes cuando cambie initialNotes (al reabrir el modal)
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    // Auto-focus al montar
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    // Listener para Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting]);

  const handleClose = () => {
    setNotes(''); // Limpiar estado antes de cerrar
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleClose();
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter para enviar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmedNotes = notes.trim();
    
    // Validación
    if (required && !trimmedNotes) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Si es modo lista de cambios, parsear líneas
      if (mode === 'changes-list') {
        const items = trimmedNotes
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        if (items.length === 0 && required) {
          setIsSubmitting(false);
          return;
        }
        
        await onSubmit(items);
      } else {
        await onSubmit(trimmedNotes);
      }
      setNotes(''); // Limpiar estado después de enviar exitosamente
      onClose();
    } catch (error) {
      // El error ya se maneja en el componente padre con toast
      console.error('Error en submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = !required || notes.trim().length > 0;
  const charsLeft = maxLength - notes.length;
  const isNearLimit = charsLeft <= 100;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-notes-title"
    >
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 id="review-notes-title" className="text-lg font-semibold text-white">
            {title}
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div>
            <label htmlFor="review-notes" className="block text-sm font-medium text-zinc-300 mb-2">
              {mode === 'changes-list' ? 'Lista de cambios solicitados' : 
               mode === 'ai-revision' ? 'Instrucciones para la IA' :
               mode === 'custom-cover-prompt' ? 'Prompt personalizado para la imagen' :
               'Notas de revisión'} {required && <span className="text-amber-400">*</span>}
            </label>
            {mode === 'changes-list' && (
              <p className="text-xs text-zinc-400 mb-2">
                Escribe un cambio por línea. Cada línea será un punto en la lista.
              </p>
            )}
            {mode === 'ai-revision' && (
              <p className="text-xs text-zinc-400 mb-2">
                Describe los cambios que deseas. La IA revisará el borrador según tus instrucciones.
              </p>
            )}
            {mode === 'custom-cover-prompt' && (
              <p className="text-xs text-zinc-400 mb-2">
                Escribe el prompt personalizado para generar una nueva imagen de portada. La IA reemplazará la imagen anterior manteniendo la resolución estándar del sitio.
              </p>
            )}
            <textarea
              ref={textareaRef}
              id="review-notes"
              name="review-notes-field"
              autoComplete="off"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              rows={mode === 'changes-list' ? 8 : 6}
              disabled={isSubmitting}
              placeholder={
                mode === 'changes-list' 
                  ? "Ejemplo:\nCorregir título para mayor claridad\nAgregar más contexto en la introducción\nVerificar ortografía en párrafo 3" 
                  : mode === 'ai-revision'
                  ? "Ejemplo: Mejorar la claridad del segundo párrafo, corregir errores ortográficos, hacer el título más atractivo..."
                  : mode === 'custom-cover-prompt'
                  ? "Ejemplo: Editorial illustration showing a press conference with microphones and cameras, modern cinematic style, horizontal format 16:9, professional lighting..."
                  : required ? "Describe los cambios necesarios..." : "Notas opcionales..."
              }
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-200 placeholder-zinc-500 p-3 resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Contador de caracteres */}
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${isNearLimit ? 'text-amber-400' : 'text-zinc-400'}`}>
              {notes.length}/{maxLength} caracteres
            </span>
            {required && !isValid && (
              <div className="flex items-center gap-1 text-amber-400">
                <AlertCircle size={14} />
                <span>Las notas son obligatorias</span>
              </div>
            )}
          </div>

          {/* Hint de atajos */}
          <p className="text-xs text-zinc-500">
            Presiona <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">Ctrl+Enter</kbd> para enviar
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === 'custom-cover-prompt' ? 'Generando...' : 'Enviando...'}
              </>
            ) : (
              mode === 'custom-cover-prompt' ? 'Generar' : 'Enviar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
