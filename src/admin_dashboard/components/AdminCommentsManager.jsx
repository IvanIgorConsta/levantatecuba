import { useState, useEffect } from 'react';
import { X, Trash2, MessageCircle, User, AlertCircle } from 'lucide-react';

export default function AdminCommentsManager({ newsId, newsTitle, onClose }) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (newsId) {
      loadComments();
    }
  }, [newsId]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/news/${newsId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Error al cargar comentarios');
      
      const data = await res.json();
      setComments(data.comentarios || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId, hardDelete = false) => {
    const confirmMsg = hardDelete 
      ? '¿Eliminar permanentemente este comentario y todas sus respuestas?'
      : '¿Marcar este comentario como eliminado?';
    
    if (!window.confirm(confirmMsg)) return;
    
    setDeleting(commentId);
    try {
      const token = localStorage.getItem('token');
      const endpoint = hardDelete 
        ? `/api/admin/comments/${commentId}/hard`
        : `/api/admin/comments/${commentId}`;
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Error al eliminar');
      
      await loadComments();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'hace unos segundos';
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
    return `hace ${Math.floor(seconds / 86400)} días`;
  };

  const CommentItem = ({ comment, level = 0 }) => {
    const isDeleted = comment.deletedAt || 
      comment.contenido?.includes('[Comentario eliminado') ||
      comment.texto?.includes('[Comentario eliminado');
    
    return (
      <div className={`${level > 0 ? 'ml-8 mt-2' : 'mt-3'}`}>
        <div className={`bg-zinc-800 rounded-lg p-4 border ${
          isDeleted ? 'border-red-900 bg-red-950/20' : 'border-zinc-700'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-white">
                  {comment.usuario || comment.userId?.name || 'Anónimo'}
                </span>
                <span className="text-xs text-zinc-500">
                  · {timeAgo(comment.createdAt)}
                </span>
                {level > 0 && (
                  <span className="text-xs text-blue-400">Respuesta</span>
                )}
              </div>
              
              <p className={`text-sm ${
                isDeleted ? 'text-red-400 italic' : 'text-zinc-300'
              }`}>
                {comment.contenido || comment.texto || comment.mensaje}
              </p>
              
              {comment.userId?.email && (
                <p className="text-xs text-zinc-500 mt-1">
                  {comment.userId.email}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              {!isDeleted && (
                <>
                  <button
                    onClick={() => handleDelete(comment._id, false)}
                    disabled={deleting === comment._id}
                    className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition disabled:opacity-50"
                    title="Soft delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(comment._id, true)}
                    disabled={deleting === comment._id}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition disabled:opacity-50"
                    title="Eliminar permanentemente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {comment.respuestas?.length > 0 && (
            <div className="mt-3 space-y-2">
              {comment.respuestas.map(reply => (
                <CommentItem 
                  key={reply._id} 
                  comment={reply} 
                  level={level + 1} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">
                Gestión de Comentarios
              </h2>
              <p className="text-sm text-zinc-400 mt-1">{newsTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Error: {error}</span>
              </div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No hay comentarios en esta noticia</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 text-sm text-zinc-400">
                Total: {total} comentario{total !== 1 ? 's' : ''}
              </div>
              <div className="space-y-3">
                {comments.map(comment => (
                  <CommentItem key={comment._id} comment={comment} />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-700 flex justify-between items-center">
          <div className="text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1 mr-4">
              <Trash2 className="w-3 h-3 text-yellow-400" />
              Soft delete
            </span>
            <span className="inline-flex items-center gap-1">
              <X className="w-3 h-3 text-red-400" />
              Hard delete
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
