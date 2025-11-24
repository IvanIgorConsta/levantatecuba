// src/components/CommentThread.jsx
// ✅ CORREGIDO: Bug de input que solo permite 1 carácter
// ✅ OPTIMIZADO: Sin re-renders innecesarios, foco estable, contador correcto

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useThreadedComments } from '../hooks/useThreadedComments';
import DOMPurify from 'dompurify';
import { 
  User, 
  Send, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Reply,
  Trash2,
  AlertCircle,
  Loader2
} from 'lucide-react';

/**
 * Componente reutilizable para comentarios anidados
 * @param {Object} props
 * @param {'news' | 'report'} props.contextType - Tipo de contexto
 * @param {string} props.targetId - ID del elemento objetivo
 * @param {string} props.className - Clases CSS adicionales
 */
export default function CommentThread({ contextType, targetId, className = '' }) {
  const {
    rootComments,
    isLoading,
    error,
    currentUser,
    isAuthenticated,
    addComment,
    deleteComment,
    hasMoreReplies,
    isOptimistic,
    totalCommentCount // ✅ Cuenta raíz + respuestas anidadas
  } = useThreadedComments({ contextType, targetId });

  // ✅ FIX PRINCIPAL: Estado separado por input para evitar re-renders
  // Cada input de respuesta tiene su propio valor en replyInputs[commentId]
  const [replyInputs, setReplyInputs] = useState({});
  const [rootCommentInput, setRootCommentInput] = useState('');
  
  // Estado de UI - NO afectan el valor del input
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [respuestasVisibles, setRespuestasVisibles] = useState({});
  const [enviando, setEnviando] = useState({});
  
  // Refs estables para foco (NO causan re-render)
  const textareaRefs = useRef({});

  // ✅ Auto-focus SOLO al abrir caja de respuesta (dependencia estable)
  useEffect(() => {
    if (respondiendoA && textareaRefs.current[respondiendoA]) {
      // Pequeño delay para asegurar que el DOM está listo
      const timer = setTimeout(() => {
        textareaRefs.current[respondiendoA]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [respondiendoA]); // Solo se ejecuta cuando cambia el ID del comentario a responder

  // Helper para tiempo relativo
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = {
      año: 31536000,
      mes: 2592000,
      día: 86400,
      hora: 3600,
      minuto: 60
    };
    
    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval);
      if (interval >= 1) {
        return `${interval} ${name}${interval > 1 ? (name === 'mes' ? 'es' : 's') : ''}`;
      }
    }
    return "ahora";
  };

  // ✅ Handler memoizado para input de respuesta (evita recreación)
  // IMPORTANTE: Solo actualiza replyInputs[commentId], no dispara re-render del árbol
  const handleReplyInputChange = useCallback((commentId, value) => {
    setReplyInputs(prev => ({ ...prev, [commentId]: value }));
  }, []);

  // ✅ Handler memoizado para input raíz (separado del anterior)
  const handleRootInputChange = useCallback((value) => {
    setRootCommentInput(value);
  }, []);

  // antes: const handleEnviarComentario = async (parentId = null) => { ... }
const handleEnviarComentario = async (parentId = null, contenidoArg, onSuccessClear) => {
  const contenido = parentId ? contenidoArg : rootCommentInput;
  if (!contenido?.trim()) return;
  if (!isAuthenticated) { alert('⚠ Debes iniciar sesión para comentar.'); return; }

  setEnviando(prev => ({ ...prev, [parentId || 'root']: true }));

  const result = await addComment({ contenido, parentId });

  if (result.success) {
    if (parentId) {
      onSuccessClear?.();     // limpia el input local de ese CommentItem
      setRespondiendoA(null); // cierra la caja
    } else {
      setRootCommentInput('');
    }
  } else {
    alert(`❌ Error: ${result.error || 'No se pudo enviar el comentario'}`);
  }

  setEnviando(prev => ({ ...prev, [parentId || 'root']: false }));
};


  // ✅ Cancelar respuesta (limpia input y cierra caja)
  const handleCancelarRespuesta = useCallback((commentId) => {
    setReplyInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[commentId];
      return newInputs;
    });
    setRespondiendoA(null);
  }, []);

  // Eliminar comentario
  const handleEliminarComentario = async (commentId) => {
    const result = await deleteComment(commentId);
    if (!result.success && result.error !== 'Cancelado por usuario') {
      alert(`❌ Error: ${result.error || 'No se pudo eliminar el comentario'}`);
    }
  };

  // ✅ Componente interno memoizado para evitar re-renders innecesarios
  // React.memo previene que se re-renderice si sus props no cambian
  const CommentItem = memo(({ comentario, nivel = 0 }) => {
    const isReplyingToThis = respondiendoA === comentario._id;
    const hasReplies = comentario.respuestas && comentario.respuestas.length > 0;
    const areRepliesVisible = respuestasVisibles[comentario._id];
    const isOwner = currentUser?.id === comentario.userId;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';
    const canDelete = isOwner || isAdmin;
    const isOptimisticComment = isOptimistic(comentario._id);
    // dentro de CommentItem (no en el padre)
    const [replyValue, setReplyValue] = useState('');
    const replyRef = useRef(null);

// cuando se abra la caja de respuesta, enfocar una sola vez
    useEffect(() => {
    if (respondiendoA === comentario._id) {
    const t = setTimeout(() => replyRef.current?.focus(), 40);
    return () => clearTimeout(t);
      }
      }, [respondiendoA, comentario._id]);

    return (
      <div className={`${nivel > 0 ? 'ml-12 mt-2' : 'mt-3'}`}>
        <div className={`group ${nivel === 0 ? 'border-l-2 border-zinc-800 pl-4' : ''} ${isOptimisticComment ? 'opacity-70' : ''}`}>
          <div className="flex gap-3">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              nivel === 0 ? 'bg-zinc-800' : 'bg-zinc-900'
            }`}>
              {comentario.usuario?.profileImage ? (
                <img 
                  src={comentario.usuario.profileImage} 
                  alt="avatar" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Header del comentario */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white text-sm">
                  {comentario.usuario || "Anónimo"}
                </span>
                {isOptimisticComment && (
                  <span className="text-xs text-blue-400 animate-pulse">Enviando...</span>
                )}
                <span className="text-xs text-zinc-500">
                  · {timeAgo(comentario.createdAt)}
                </span>
              </div>
              
              {/* Contenido */}
              <p 
                className="text-sm text-zinc-300 break-words"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(comentario.contenido || comentario.texto || comentario.mensaje || '')
                }}
              />
              
              {/* Acciones */}
              <div className="flex items-center gap-4 mt-2">
                {isAuthenticated && !isOptimisticComment && (
                  <button
                    type="button" // ✅ CRÍTICO: Evita submit si está en form
                    onClick={() => setRespondiendoA(comentario._id)}
                    className="text-xs text-zinc-500 hover:text-blue-400 transition flex items-center gap-1"
                    aria-label="Responder al comentario"
                  >
                    <Reply className="w-3 h-3" />
                    Responder
                  </button>
                )}
                
                {canDelete && !isOptimisticComment && (
                  <button
                    type="button"
                    onClick={() => handleEliminarComentario(comentario._id)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition flex items-center gap-1"
                    aria-label="Eliminar comentario"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                )}
                
                {hasReplies && (
                  <button
                    type="button"
                    onClick={() => setRespuestasVisibles(prev => ({
                      ...prev,
                      [comentario._id]: !prev[comentario._id]
                    }))}
                    className="text-xs text-zinc-500 hover:text-white transition flex items-center gap-1"
                    aria-expanded={areRepliesVisible}
                    aria-controls={`replies-${comentario._id}`}
                  >
                    {areRepliesVisible ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        {comentario.respuestas.length} respuesta{comentario.respuestas.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {isReplyingToThis && (
                <div className="mt-3 flex gap-2">
                  <input
                    ref={replyRef}
                    type="text"
                    placeholder={`Responder a ${comentario.usuario || "Anónimo"}...`}
                    value={replyValue}
                    onChange={(e) => setReplyValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleEnviarComentario(comentario._id, replyValue, () => setReplyValue(''));
                      } else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (replyValue.trim()) {
                          handleEnviarComentario(comentario._id, replyValue, () => setReplyValue(''));
                        }
                      }
                    }}
                    disabled={enviando[comentario._id]}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                    aria-label="Escribir respuesta"
                  />

                  <button
                    type="button"
                    onClick={() => handleEnviarComentario(comentario._id, replyValue, () => setReplyValue(''))}
                    disabled={!replyValue.trim() || enviando[comentario._id]}
                    className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-lg transition"
                    aria-label="Enviar respuesta"
                  >
                    {enviando[comentario._id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyValue('');
                      setRespondiendoA(null);
                    }}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
                    aria-label="Cancelar respuesta"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {/* Respuestas anidadas */}
              {areRepliesVisible && hasReplies && (
                <div id={`replies-${comentario._id}`} className="mt-2">
                  {comentario.respuestas.map((respuesta) => (
                    <CommentItem
                      key={respuesta._id}
                      comentario={respuesta}
                      nivel={nivel + 1}
                    />
                  ))}
                  
                  {/* Paginación de respuestas */}
                  {hasMoreReplies(comentario._id) && (
                    <button
                      type="button"
                      onClick={() => loadMore(comentario._id)}
                      className="ml-12 mt-2 text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      Ver más respuestas...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  // Agregar displayName para React DevTools
  CommentItem.displayName = 'CommentItem';

  // Renderizado principal
  if (isLoading && rootComments.length === 0) {
    return (
      <div className={`flex justify-center items-center py-8 ${className}`}>
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando comentarios...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Error al cargar comentarios: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Formulario para nuevo comentario raíz */}
      {isAuthenticated ? (
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-zinc-400" />
            </div>
            
            {/* ✅ Input raíz con estado separado */}
            <input
              type="text"
              placeholder="Escribe un comentario..."
              value={rootCommentInput}
              onChange={(e) => handleRootInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && rootCommentInput.trim()) {
                  e.preventDefault();
                  handleEnviarComentario();
                }
                else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (rootCommentInput.trim()) {
                    handleEnviarComentario();
                  }
                }
              }}
              disabled={enviando['root']}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
              aria-label="Escribir comentario"
            />
            
            <button
              type="button"
              onClick={() => handleEnviarComentario()}
              disabled={!rootCommentInput.trim() || enviando['root']}
              className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-lg transition"
              aria-label="Publicar comentario"
            >
              {enviando['root'] ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center">
          <p className="text-sm text-zinc-400 mb-3">Inicia sesión para comentar</p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
          >
            <User className="w-4 h-4" />
            Iniciar sesión
          </a>
        </div>
      )}

      {/* Lista de comentarios */}
      {rootComments.length > 0 ? (
        <div className="space-y-3">
          {rootComments.map((comentario) => (
            <CommentItem
              key={comentario._id}
              comentario={comentario}
              nivel={0}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-500 py-8 bg-zinc-900/30 rounded-lg">
          {isAuthenticated 
            ? "Sé el primero en comentar"
            : "No hay comentarios aún"}
        </p>
      )}
      
      {/* ✅ Contador total (opcional, para debugging) */}
      {process.env.NODE_ENV === 'development' && totalCommentCount > 0 && (
        <div className="mt-4 text-xs text-zinc-500 text-center">
          Total: {totalCommentCount} comentario{totalCommentCount > 1 ? 's' : ''} (raíz + respuestas)
        </div>
      )}
    </div>
  );
}
