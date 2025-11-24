import React, { useState, useEffect } from "react";
import { X, Trash2, MessageCircle, ChevronDown, ChevronRight, User, Calendar } from "lucide-react";

export default function CommentsOverlay({ newsId, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReplies, setExpandedReplies] = useState({});

  useEffect(() => {
    fetchComments();
  }, [newsId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/comments/${newsId}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
        const initial = {};
        data?.forEach(com => {
          if (com.respuestas && com.respuestas.length > 0) {
            initial[com._id] = true;
          }
        });
        setExpandedReplies(initial);
      }
    } catch (error) {
      console.error("Error al cargar comentarios:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este comentario?")) return;

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error("Error al eliminar comentario:", error);
    }
  };

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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderComment = (com, nivel = 0) => (
    <div key={com._id} className="relative">
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
          
          <button
            onClick={() => handleDelete(com._id)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all duration-200 group"
            title="Eliminar comentario"
          >
            <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="mb-3">
          <p className="text-white/90 text-sm leading-relaxed">{com.texto}</p>
        </div>

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

      {com.respuestas && com.respuestas.length > 0 && expandedReplies[com._id] && (
        <div className="relative">
          {com.respuestas.map(reply => renderComment(reply, nivel + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
          <h3 className="text-lg font-semibold text-white">Comentarios</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white/70 hover:text-white transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-white/60">Cargando comentarios...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-white/60">No hay comentarios aún</div>
            </div>
          ) : (
            <div>
              {comments.map(com => renderComment(com, 0))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
