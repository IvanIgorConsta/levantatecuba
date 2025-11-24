// src/admin_dashboard/components/CommentThread.jsx
import React, { useState } from "react";
import { Trash2, MessageCircle, ChevronDown, ChevronRight, User, Calendar } from "lucide-react";

export default function CommentThread({ comentarios, noticiaId, onDeleteComment, nivel = 0 }) {
  // ✅ Inicializar con respuestas expandidas por defecto para mantener UX
  const [expandedReplies, setExpandedReplies] = useState(() => {
    const initial = {};
    comentarios?.forEach(com => {
      if (com.respuestas && com.respuestas.length > 0) {
        initial[com._id] = true; // Por defecto expandidas
      }
    });
    return initial;
  });

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = (commentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      onDeleteComment(commentId, noticiaId);
    }
  };

  return (
    <>
      {(comentarios || []).map((com) => (
        <div key={com._id} className="relative">
          {/* Línea de conexión para respuestas anidadas */}
          {nivel > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500/30"
              style={{ marginLeft: `${(nivel - 1) * 1.5 + 0.75}rem` }}
            />
          )}
          
          <div
            className={`
              bg-zinc-800/80 border border-zinc-700/50 rounded-lg mb-3 p-4 
              hover:bg-zinc-800 transition-all duration-200
              ${nivel > 0 ? 'ml-6 border-l-2 border-l-blue-500/50' : ''}
            `}
            style={{ marginLeft: nivel > 0 ? `${nivel * 1.5}rem` : '0' }}
          >
            {/* Header del comentario */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <User size={12} />
                  <span className="font-medium text-white/80">{com.usuario?.name || 'Usuario anónimo'}</span>
                  <span>•</span>
                  <Calendar size={12} />
                  <span>{formatDate(com.createdAt)}</span>
                  {nivel > 0 && (
                    <>
                      <span>•</span>
                      <MessageCircle size={12} />
                      <span className="text-blue-400">Respuesta</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Botón de eliminar - más compacto y a la derecha */}
              <button
                onClick={() => handleDelete(com._id)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all duration-200 group"
                title="Eliminar comentario"
              >
                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Contenido del comentario */}
            <div className="mb-3">
              <p className="text-white/90 text-sm leading-relaxed">{com.texto}</p>
            </div>

            {/* Indicador de respuestas */}
            {com.respuestas && com.respuestas.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleReplies(com._id)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-full"
                >
                  {expandedReplies[com._id] ? (
                    <>
                      <ChevronDown size={12} />
                      Ocultar {com.respuestas.length} respuesta{com.respuestas.length > 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      <ChevronRight size={12} />
                      Ver {com.respuestas.length} respuesta{com.respuestas.length > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Respuestas anidadas */}
          {com.respuestas && com.respuestas.length > 0 && expandedReplies[com._id] && (
            <div className="relative">
              <CommentThread
                comentarios={com.respuestas}
                noticiaId={noticiaId}
                onDeleteComment={onDeleteComment}
                nivel={nivel + 1}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
