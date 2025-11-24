// src/hooks/useThreadedComments.js
// ✅ Hook reutilizable para comentarios anidados
// ✅ Incluye: envío optimista, paginación, conteo recursivo

import { useState, useCallback, useRef, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";

/**
 * ✅ Función auxiliar para contar todos los comentarios recursivamente
 * Útil para mostrar contadores en UI (panel de control, stats, etc.)
 * 
 * IMPORTANTE: Cuenta raíz + TODAS las respuestas anidadas (recursivo)
 * 
 * @param {Array} comments - Array de comentarios
 * @returns {number} Total de comentarios incluyendo respuestas anidadas
 * 
 * @example
 * const total = countAllComments(noticia.comentarios);
 * // Si tiene: 2 raíz + 3 respuestas + 1 sub-respuesta = 6 total
 */
export function countAllComments(comments) {
  if (!Array.isArray(comments)) return 0;
  
  let count = 0;
  
  // Función recursiva interna
  const countRecursive = (commentList) => {
    commentList.forEach(comment => {
      count++; // Cuenta el comentario actual
      
      // Si tiene respuestas, contarlas recursivamente
      if (comment.respuestas && Array.isArray(comment.respuestas) && comment.respuestas.length > 0) {
        countRecursive(comment.respuestas);
      }
    });
  };
  
  countRecursive(comments);
  return count;
}

/**
 * Hook reutilizable para manejar comentarios anidados
 * 
 * CARACTERÍSTICAS:
 * - Envío optimista (comentario aparece inmediatamente, rollback si falla)
 * - Paginación cursor-based (carga más respuestas bajo demanda)
 * - Conteo recursivo correcto (raíz + anidados)
 * - Soporte para news y reports (extensible)
 * 
 * @param {Object} config - Configuración del hook
 * @param {'news' | 'report'} config.contextType - Tipo de contexto (noticias o denuncias)
 * @param {string} config.targetId - ID del elemento objetivo (newsId o reportId)
 * @returns {Object} Estado y funciones para manejar comentarios
 */
export function useThreadedComments({ contextType, targetId }) {
  const [rootComments, setRootComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [optimisticComments, setOptimisticComments] = useState(new Map());
  const [cursors, setCursors] = useState(new Map()); // Para paginación por nivel
  const [hasMore, setHasMore] = useState(new Map()); // Si hay más comentarios por cargar
  const tempIdCounter = useRef(0);

  // ✅ Obtener info del usuario actual desde JWT
  const token = localStorage.getItem("token");
  const currentUser = token ? (() => {
    try {
      const decoded = jwtDecode(token);
      return {
        id: decoded.sub || decoded.id,
        name: decoded.name || decoded.username || decoded.nickname || 'Anónimo',
        email: decoded.email,
        role: decoded.role
      };
    } catch {
      return null;
    }
  })() : null;

  // ✅ Determinar la URL base según el contexto (news o report)
  const getApiUrl = useCallback(() => {
    switch (contextType) {
      case 'news':
        return `/api/comments/${targetId}`;
      case 'report':
        return `/api/reports/${targetId}/comentarios`;
      default:
        throw new Error(`Contexto desconocido: ${contextType}`);
    }
  }, [contextType, targetId]);

  // ✅ Cargar comentarios raíz
  const loadRootComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl());
      if (!res.ok) throw new Error('Error al cargar comentarios');
      
      const data = await res.json();
      
      // Normalizar respuesta según contexto
      let comments = data;
      if (contextType === 'news') {
        // Para noticias, los comentarios vienen directamente
        comments = Array.isArray(data) ? data : [];
      } else if (contextType === 'report') {
        // Para denuncias, puede venir en un formato diferente
        comments = Array.isArray(data) ? data : data.comentarios || [];
      }

      setRootComments(comments);
      
      // Inicializar cursores para paginación futura
      comments.forEach(comment => {
        if (comment.respuestas?.length > 0) {
          setHasMore(prev => new Map(prev).set(comment._id, comment.respuestas.length > 10));
        }
      });
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      setError(err.message);
      setRootComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [getApiUrl, contextType]);

  // ✅ Cargar más respuestas (paginación)
  const loadMore = useCallback(async (parentId) => {
    const cursor = cursors.get(parentId);
    const url = `${getApiUrl()}?parentId=${parentId}${cursor ? `&cursor=${cursor}` : ''}&limit=10`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al cargar más respuestas');
      
      const data = await res.json();
      const newComments = data.comments || [];
      const nextCursor = data.nextCursor;

      // Actualizar comentarios anidados
      const updateNestedComments = (comments) => {
        return comments.map(comment => {
          if (comment._id === parentId) {
            return {
              ...comment,
              respuestas: [...(comment.respuestas || []), ...newComments]
            };
          }
          if (comment.respuestas) {
            return {
              ...comment,
              respuestas: updateNestedComments(comment.respuestas)
            };
          }
          return comment;
        });
      };

      setRootComments(prev => updateNestedComments(prev));
      
      // Actualizar cursor y estado de "hay más"
      if (nextCursor) {
        setCursors(prev => new Map(prev).set(parentId, nextCursor));
        setHasMore(prev => new Map(prev).set(parentId, true));
      } else {
        setHasMore(prev => new Map(prev).set(parentId, false));
      }
    } catch (err) {
      console.error('Error al cargar más respuestas:', err);
    }
  }, [cursors, getApiUrl]);

  // ✅ Agregar comentario con envío optimista
  // IMPORTANTE: El comentario aparece inmediatamente, se envía al backend,
  // y si falla se elimina (rollback)
  const addComment = useCallback(async ({ contenido, parentId = null }) => {
    if (!contenido?.trim()) return { success: false, error: 'Contenido vacío' };
    if (!currentUser) return { success: false, error: 'No autenticado' };

    // ✅ 1. Crear comentario temporal para envío optimista
    const tempId = `temp_${Date.now()}_${tempIdCounter.current++}`;
    const optimisticComment = {
      _id: tempId,
      contenido: contenido.trim(),
      texto: contenido.trim(),
      usuario: currentUser.name,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
      padre: parentId,
      parentId: parentId,
      respuestas: [],
      isOptimistic: true // Marca para mostrar estado "Enviando..."
    };

    // ✅ 2. Agregar comentario optimista inmediatamente a la UI
    if (parentId) {
      // Es una respuesta - insertarla en el árbol
      const insertInTree = (comments) => {
        return comments.map(comment => {
          if (comment._id === parentId) {
            return {
              ...comment,
              respuestas: [...(comment.respuestas || []), optimisticComment]
            };
          }
          if (comment.respuestas) {
            return {
              ...comment,
              respuestas: insertInTree(comment.respuestas)
            };
          }
          return comment;
        });
      };
      setRootComments(prev => insertInTree(prev));
    } else {
      // Es un comentario raíz
      setRootComments(prev => [optimisticComment, ...prev]);
    }

    // Guardar referencia del comentario optimista
    setOptimisticComments(prev => new Map(prev).set(tempId, optimisticComment));

    try {
      // ✅ 3. Enviar al backend
      let url, body;
      
      if (contextType === 'news') {
        url = `/api/comments/${targetId}`;
        body = JSON.stringify({ 
          contenido: contenido.trim(),
          parentId: parentId 
        });
      } else if (contextType === 'report') {
        url = parentId 
          ? `/api/reports/${targetId}/comentarios/${parentId}/responder`
          : `/api/reports/${targetId}/comentarios`;
        body = JSON.stringify({ 
          mensaje: contenido.trim() 
        });
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      if (!res.ok) {
        throw new Error('Error al enviar comentario');
      }

      const savedComment = await res.json();

      // ✅ 4. Reemplazar comentario optimista con el real del servidor
      const replaceOptimistic = (comments) => {
        return comments.map(comment => {
          if (comment._id === tempId) {
            return { ...savedComment, isOptimistic: false };
          }
          if (comment.respuestas) {
            return {
              ...comment,
              respuestas: replaceOptimistic(comment.respuestas)
            };
          }
          return comment;
        });
      };

      setRootComments(prev => {
        if (parentId) {
          // Reemplazar en el árbol
          return replaceOptimistic(prev);
        } else {
          // Reemplazar en la raíz
          return prev.map(c => c._id === tempId ? { ...savedComment, isOptimistic: false } : c);
        }
      });

      // Limpiar comentario optimista del Map
      setOptimisticComments(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });

      return { success: true, comment: savedComment };
      
    } catch (err) {
      console.error('Error al enviar comentario:', err);
      
      // ✅ 5. ROLLBACK: eliminar comentario optimista si falló
      const removeOptimistic = (comments) => {
        return comments
          .filter(comment => comment._id !== tempId)
          .map(comment => ({
            ...comment,
            respuestas: comment.respuestas ? removeOptimistic(comment.respuestas) : []
          }));
      };

      setRootComments(prev => removeOptimistic(prev));
      setOptimisticComments(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });

      return { success: false, error: err.message };
    }
  }, [contextType, targetId, currentUser, token]);

  // ✅ Eliminar comentario (con confirmación)
  const deleteComment = useCallback(async (commentId) => {
    if (!currentUser) return { success: false, error: 'No autenticado' };

    // Confirmar eliminación
    if (!window.confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      return { success: false, error: 'Cancelado por usuario' };
    }

    try {
      let url;
      if (contextType === 'news') {
        url = `/api/comments/${commentId}`;
      } else if (contextType === 'report') {
        url = `/api/reports/comentarios/${commentId}`;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Error al eliminar comentario');
      }

      // Eliminar del estado local
      const removeFromTree = (comments) => {
        return comments
          .filter(comment => comment._id !== commentId)
          .map(comment => ({
            ...comment,
            respuestas: comment.respuestas ? removeFromTree(comment.respuestas) : []
          }));
      };

      setRootComments(prev => removeFromTree(prev));
      return { success: true };
      
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
      return { success: false, error: err.message };
    }
  }, [contextType, currentUser, token]);

  // ✅ Cargar comentarios iniciales cuando el componente monta
  useEffect(() => {
    if (targetId) {
      loadRootComments();
    }
  }, [targetId, loadRootComments]);

  // ✅ Retornar estado y funciones
  return {
    // Estado
    rootComments,
    isLoading,
    error,
    currentUser,
    isAuthenticated: !!currentUser,
    
    // Funciones
    loadMore,
    addComment,
    deleteComment,
    refresh: loadRootComments,
    
    // Utilidades para UI
    hasMoreReplies: (parentId) => hasMore.get(parentId) || false,
    isOptimistic: (commentId) => optimisticComments.has(commentId),
    
    // ✅ Contador total recursivo (raíz + respuestas anidadas)
    // USO: <div>Total: {totalCommentCount} comentarios</div>
    totalCommentCount: countAllComments(rootComments)
  };
}