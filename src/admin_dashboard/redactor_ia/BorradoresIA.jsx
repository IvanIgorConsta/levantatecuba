// src/admin_dashboard/redactor_ia/BorradoresIA.jsx
import { useState, useEffect } from 'react';
import { 
  FileText, Eye, Edit3, Trash2, Image as ImageIcon,
  CheckCircle, XCircle, Clock, Sparkles, ExternalLink, AlertCircle, Calendar, ChevronDown, Upload
} from 'lucide-react';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import DraftPreviewModal from '../components/DraftPreviewModal';
import ReviewNotesModal from '../components/ReviewNotesModal';
import PublishDraftModal from '../components/PublishDraftModal';

export default function BorradoresIA() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewModalDraft, setPreviewModalDraft] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState({});
  const [isReviewing, setIsReviewing] = useState({});
  const [isPublishing, setIsPublishing] = useState({});
  const [reviewNotesModal, setReviewNotesModal] = useState(null);
  const [publishModal, setPublishModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [filters, setFilters] = useState({
    status: 'draft',
    mode: 'all',
    reviewStatus: 'all'
  });
  const [revisionPolling, setRevisionPolling] = useState({});
  const [changesDropdown, setChangesDropdown] = useState({});
  const [imageGenDropdown, setImageGenDropdown] = useState({});
  const [uploadingDraftId, setUploadingDraftId] = useState(null);
  const [editModal, setEditModal] = useState(null); // { draft, titulo, bajada, contenidoHTML }
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const fileInputRef = useRef(null);

  // Función para notificar cambios en estadísticas (evento custom)
  const notifyStatsChange = () => {
    window.dispatchEvent(new CustomEvent('redactor-ia:stats-changed'));
  };
  
  // Categorías permitidas
  const allowedCategories = ['General', 'Política', 'Economía', 'Internacional', 'Socio político', 'Tecnología'];

  useEffect(() => {
    fetchDrafts();
  }, [filters]);

  // Cleanup de polling al desmontar
  useEffect(() => {
    return () => {
      Object.values(revisionPolling).forEach(intervalId => clearInterval(intervalId));
    };
  }, [revisionPolling]);

  // Cleanup general al desmontar: resetear estados de generación
  useEffect(() => {
    return () => {
      // Limpiar estados de generación de imágenes
      setIsGeneratingImage({});
      setIsReviewing({});
      setIsPublishing({});
      
      // Limpiar polling de revisiones
      Object.values(revisionPolling).forEach(intervalId => clearInterval(intervalId));
    };
  }, []);

  // Cerrar dropdown "Cambios" e "Imagen" al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Si hay algún dropdown abierto
      const hasOpenChangesDropdown = Object.values(changesDropdown).some(isOpen => isOpen);
      const hasOpenImageDropdown = Object.values(imageGenDropdown).some(isOpen => isOpen);
      if (!hasOpenChangesDropdown && !hasOpenImageDropdown) return;
      
      // Si el clic no es dentro de ningún contenedor de dropdown, cerrar todos
      if (!event.target.closest('.changes-dropdown-container') && !event.target.closest('.image-gen-dropdown-container')) {
        setChangesDropdown({});
        setImageGenDropdown({});
      }
    };

    // Solo agregar listener si hay dropdown abierto
    const hasOpenDropdown = Object.values(changesDropdown).some(isOpen => isOpen) || Object.values(imageGenDropdown).some(isOpen => isOpen);
    if (hasOpenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [changesDropdown, imageGenDropdown]);


  const fetchDrafts = async () => {
    try {
      // Asegurar valores explícitos y coherentes
      const queryParams = {
        status: filters.status || 'draft',
        mode: filters.mode || 'all',
        reviewStatus: filters.reviewStatus || 'all',
        page: '1',
        limit: '20'
      };
      
      console.log('[BorradoresIA] Fetching drafts con filtros:', queryParams);
      
      const params = new URLSearchParams(queryParams);
      const res = await fetch(`/api/redactor-ia/drafts?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await res.json();
      
      console.log('[BorradoresIA] Respuesta del servidor:', {
        total: data.total,
        count: data.drafts?.length || 0,
        page: data.page,
        pages: data.pages
      });
      
      setDrafts(data.drafts || []);
    } catch (error) {
      console.error('[BorradoresIA] Error fetching drafts:', error);
      toast.error('Error al cargar borradores');
    } finally {
      setLoading(false);
    }
  };

  /** @fix: Generar IA encadenado (extraer→referenciar→DALL-E) — 2025-10 */
  // Extraer y procesar de fuente (imagen local)
  const handleExtractFromSource = async (draftId) => {
    setIsGeneratingImage(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Generando imagen...', { id: `img-${draftId}` });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/generate-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({}) // Sin parámetros - usa config automática
      });
      
      const data = await res.json();
      
      console.log('[BorradoresIA] Respuesta del servidor:', { 
        status: res.status,
        ok: res.ok,
        data 
      });
      
      if (data.success || data.ok) {
        toast.success('Imagen generada exitosamente', { id: `img-${draftId}` });
        
        console.log('[BorradoresIA] Actualizando estado con:', {
          coverUrl: data.cover || data.draft?.coverUrl,
          coverHash: data.coverHash || data.draft?.coverHash,
          imageKind: data.draft?.imageKind
        });
        
        // Actualizar el borrador en el estado local sin refetch global
        setDrafts(prev => prev.map(d => 
          d._id === draftId 
            ? { 
                ...d, 
                coverUrl: data.imageUrl || data.cover || data.draft?.coverUrl,
                coverFallbackUrl: data.draft?.coverFallbackUrl,
                coverHash: data.hash || data.coverHash || data.draft?.coverHash,
                imageKind: data.imageKind || data.draft?.imageKind || 'processed',
                imageProvider: data.provider || data.draft?.imageProvider || 'internal',
                coverImageUrl: data.draft?.coverImageUrl,
                generatedImages: data.draft?.generatedImages,
                aiMetadata: {
                  ...d.aiMetadata,
                  imageProvider: data.provider || data.draft?.aiMetadata?.imageProvider
                }
              } 
            : d
        ));
        
        // Actualizar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
      } else {
        console.error('[BorradoresIA] Error en respuesta:', data);
        toast.error(data.error || 'No se pudo generar la imagen', { id: `img-${draftId}` });
      }
    } catch (error) {
      console.error('Error generando cover:', error);
      toast.error('Error de conexión al generar imagen', { id: `img-${draftId}` });
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [draftId]: false }));
    }
  };
  
  // Capturar imagen desde el sitio original de la noticia
  const handleCaptureFromSource = async (draftId) => {
    console.log('[BorradoresIA:Capture] 🚀 INICIANDO captura para draft:', draftId);
    setIsGeneratingImage(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Capturando imagen del sitio...', { id: `img-${draftId}` });
    
    // 🐛 FIX: Limpiar imagen ANTES de la captura para forzar re-mount del componente
    // Esto evita que el navegador muestre la imagen cacheada mientras carga la nueva
    setDrafts(prev => prev.map(d => 
      d._id === draftId 
        ? { ...d, coverUrl: '', coverHash: '', generatedImages: { principal: '', opcional: '' } }
        : d
    ));
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/capture-cover-from-source`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      
      console.log('[BorradoresIA:Capture] Respuesta del servidor:', { 
        status: res.status,
        ok: res.ok,
        data 
      });
      
      if (data.success || data.ok) {
        toast.success('Imagen capturada exitosamente', { id: `img-${draftId}` });
        
        // 🔍 DEBUG: Ver qué valores se van a usar
        const newCoverUrl = data.imageUrl || data.cover || data.draft?.coverUrl;
        const newCoverHash = data.hash || data.coverHash || data.draft?.coverHash;
        console.log('[BorradoresIA:Capture] 📸 Actualizando estado con:', {
          newCoverUrl,
          newCoverHash,
          imageKind: data.imageKind || data.draft?.imageKind || 'processed',
          draftFromServer: data.draft
        });
        
        // 🐛 FIX: Usar timestamp único para forzar cache-busting agresivo
        const cacheBuster = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        console.log('[BorradoresIA:Capture] 🔄 Cache buster generado:', cacheBuster);
        
        // 🐛 FIX: Pequeño delay antes de actualizar para asegurar que el DOM se limpió
        await new Promise(resolve => setTimeout(resolve, 50));
        
        setDrafts(prev => prev.map(d => 
          d._id === draftId 
            ? { 
                ...d, 
                coverUrl: newCoverUrl,
                coverFallbackUrl: data.draft?.coverFallbackUrl,
                coverHash: cacheBuster,
                imageKind: data.imageKind || data.draft?.imageKind || 'processed',
                imageProvider: data.provider || data.draft?.imageProvider || 'internal',
                coverImageUrl: data.draft?.coverImageUrl,
                generatedImages: { principal: '', opcional: '' },
                aiMetadata: {
                  ...d.aiMetadata,
                  imageProvider: 'internal',
                  capturedFromSource: true
                }
              } 
            : d
        ));
        
        // Actualizar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          // 🐛 FIX: También actualizar el hash en el modal para forzar re-render
          setPreviewModalDraft({
            ...data.draft,
            coverHash: cacheBuster
          });
        }
      } else {
        // 🐛 FIX: Restaurar estado previo en caso de error
        fetchDrafts();
        console.error('[BorradoresIA:Capture] Error en respuesta:', data);
        toast.error(data.error || 'No se pudo capturar la imagen', { id: `img-${draftId}` });
      }
    } catch (error) {
      // 🐛 FIX: Restaurar estado previo en caso de error
      fetchDrafts();
      console.error('Error capturando imagen:', error);
      toast.error('Error de conexión al capturar imagen', { id: `img-${draftId}` });
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [draftId]: false }));
    }
  };

  // Subir imagen manual
  const handleUploadImage = (draftId) => {
    setUploadingDraftId(draftId);
    setImageGenDropdown({});
    // Abrir el selector de archivos
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Manejar archivo seleccionado
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDraftId) {
      setUploadingDraftId(null);
      return;
    }

    const draftId = uploadingDraftId;
    setIsGeneratingImage(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Subiendo imagen...', { id: `img-${draftId}` });

    try {
      const formData = new FormData();
      formData.append('cover', file);

      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/upload-cover`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();

      console.log('[BorradoresIA:Upload] Respuesta del servidor:', {
        status: res.status,
        ok: res.ok,
        data
      });

      if (data.success || data.ok) {
        toast.success('Imagen subida exitosamente', { id: `img-${draftId}` });

        // Actualizar el borrador en el estado local
        setDrafts(prev => prev.map(d =>
          d._id === draftId
            ? {
                ...d,
                coverUrl: data.imageUrl || data.cover || data.draft?.coverUrl,
                coverFallbackUrl: data.draft?.coverFallbackUrl,
                coverHash: data.hash || data.coverHash || data.draft?.coverHash,
                imageKind: data.imageKind || data.draft?.imageKind || 'uploaded',
                imageProvider: 'manual',
                coverImageUrl: data.draft?.coverImageUrl,
                // 🐛 FIX: Limpiar generatedImages explícitamente para evitar mostrar imagen anterior
                generatedImages: { principal: '', opcional: '' },
                aiMetadata: {
                  ...d.aiMetadata,
                  imageProvider: 'manual',
                  uploadedAt: new Date().toISOString()
                }
              }
            : d
        ));

        // Actualizar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
      } else {
        console.error('[BorradoresIA:Upload] Error en respuesta:', data);
        toast.error(data.error || 'No se pudo subir la imagen', { id: `img-${draftId}` });
      }
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      toast.error('Error de conexión al subir imagen', { id: `img-${draftId}` });
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [draftId]: false }));
      setUploadingDraftId(null);
      // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Generar con IA usando config automática
  const handleGenerateWithAI = async (draftId) => {
    setIsGeneratingImage(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Generando imagen con IA...', { id: `img-${draftId}` });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/generate-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({}) // Sin parámetros - usa config automática
      });
      
      const data = await res.json();
      
      console.log('[BorradoresIA] Respuesta IA del servidor:', { 
        status: res.status,
        ok: res.ok,
        data 
      });
      
      if (data.success || data.ok) {
        toast.success('Imagen generada con IA', { id: `img-${draftId}` });
        
        // Actualizar el borrador en el estado local
        setDrafts(prev => prev.map(d => 
          d._id === draftId 
            ? { 
                ...d, 
                coverUrl: data.imageUrl || data.cover || data.draft?.coverUrl,
                coverFallbackUrl: data.draft?.coverFallbackUrl,
                coverHash: data.hash || data.coverHash || data.draft?.coverHash,
                imageKind: data.imageKind || data.draft?.imageKind || 'ai',
                imageProvider: data.provider || data.draft?.imageProvider || 'dall-e-3',
                coverImageUrl: data.draft?.coverImageUrl,
                generatedImages: data.draft?.generatedImages,
                aiMetadata: {
                  ...d.aiMetadata,
                  imageProvider: data.provider || data.draft?.aiMetadata?.imageProvider || 'dall-e-3'
                }
              } 
            : d
        ));
        
        // Actualizar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
      } else {
        console.error('[BorradoresIA] Error en respuesta IA:', data);
        toast.error(data.error || 'No se pudo generar con IA', { id: `img-${draftId}` });
      }
    } catch (error) {
      console.error('Error generando con IA:', error);
      toast.error('Error de conexión', { id: `img-${draftId}` });
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [draftId]: false }));
    }
  };
  
  const handleCategoryChange = async (draft, newCategory) => {
    if (newCategory === draft.categoria) return;
    
    const originalCategory = draft.categoria;
    const originalConfidence = draft.aiMetadata?.categoryConfidence || 0.5;
    
    try {
      // Actualizar categoría del borrador
      const updateRes = await fetch(`/api/redactor-ia/drafts/${draft._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ categoria: newCategory })
      });
      
      if (!updateRes.ok) throw new Error('Error al actualizar categoría');
      
      // Enviar feedback para aprendizaje
      await fetch('/api/redactor-ia/category-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          draftId: draft._id,
          title: draft.titulo,
          summary: draft.bajada,
          originalCategory,
          chosenCategory: newCategory,
          originalConfidence,
          tags: draft.etiquetas,
          wasLowConfidence: draft.aiMetadata?.categoryLowConfidence || false
        })
      });
      
      toast.success(`Categoría actualizada: ${newCategory}`);
      fetchDrafts();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar categoría');
    }
  };
  
  const doReview = async (draftId, status, notes) => {
    setIsReviewing(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Procesando revisión...', { id: `review-${draftId}` });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status, notes: notes || '' })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success(data.message, { id: `review-${draftId}` });
        
        // Refrescar estadísticas si se aprobó o rechazó
        if (status === 'approved' || status === 'changes_requested') {
          notifyStatsChange();
        }
        
        // Refrescar lista desde servidor para aplicar filtros actuales
        // Esto hace que los borradores aprobados/rechazados desaparezcan inmediatamente
        fetchDrafts();
        
        // Actualizar modal de preview si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
      } else {
        toast.error(data.error || 'Error al procesar revisión', { id: `review-${draftId}` });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: `review-${draftId}` });
    } finally {
      setIsReviewing(prev => ({ ...prev, [draftId]: false }));
    }
  };

  // Función para iniciar polling de estado de revisión
  const startRevisionPolling = (draftId) => {
    // Limpiar polling anterior si existe
    if (revisionPolling[draftId]) {
      clearInterval(revisionPolling[draftId]);
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/redactor-ia/drafts/${draftId}/revision`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await res.json();
        
        if (data.status === 'ready') {
          // Revisión completada
          clearInterval(intervalId);
          setRevisionPolling(prev => {
            const newState = { ...prev };
            delete newState[draftId];
            return newState;
          });
          
          toast.success('Revisión completada. Abre el borrador para ver los cambios.');
          fetchDrafts(); // Refrescar lista
        } else if (data.status === 'error') {
          // Error en revisión
          clearInterval(intervalId);
          setRevisionPolling(prev => {
            const newState = { ...prev };
            delete newState[draftId];
            return newState;
          });
          
          toast.error(`Error en revisión: ${data.errorMsg || 'Error desconocido'}`);
        }
      } catch (error) {
        console.error('Error polling revision:', error);
      }
    }, 3000); // Polling cada 3 segundos

    setRevisionPolling(prev => ({ ...prev, [draftId]: intervalId }));
  };

  const handleReview = (draftId, status) => {
    // Prevenir acción redundante si ya tiene ese estado
    const currentDraft = drafts.find(d => d._id === draftId);
    if (currentDraft?.reviewStatus === status) {
      toast.error('El borrador ya tiene ese estado');
      return;
    }
    
    // Si se solicitan cambios, abrir modal para ingresar notas de revisión
    if (status === 'changes_requested') {
      setReviewNotesModal({
        draftId,
        status,
        title: 'Solicitar cambios específicos (revisión con IA)',
        initialNotes: '', // Siempre iniciar vacío, no cargar notas previas
        required: true,
        mode: 'ai-revision'
      });
    } else {
      // Para aprobar o resetear a pending, enviar directo sin modal
      doReview(draftId, status, '');
    }
  };

  // Manejar solicitud de nueva portada con prompt manual
  const handleCustomCoverPrompt = (draftId) => {
    setReviewNotesModal({
      draftId,
      status: 'custom_cover',
      title: 'Generar nueva portada IA (prompt manual)',
      initialNotes: '',
      required: true,
      mode: 'custom-cover-prompt'
    });
  };

  // Generar portada con prompt manual en background
  const generateCustomCover = async (draftId, prompt) => {
    setIsGeneratingImage(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Generando nueva portada con IA...', { id: `cover-${draftId}` });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          mode: 'custom_prompt',
          prompt
        })
      });
      
      const result = await res.json();
      
      console.log('[BorradoresIA:CustomCover] Respuesta del servidor:', {
        success: result.success,
        ok: result.ok,
        imageUrl: result.imageUrl,
        cover: result.cover,
        imageKind: result.imageKind,
        provider: result.provider,
        draft_coverUrl: result.draft?.coverUrl,
        draft_generatedImages: result.draft?.generatedImages,
        draft_imageKind: result.draft?.imageKind
      });
      
      if (result.success || result.ok) {
        toast.success('Nueva portada generada exitosamente', { id: `cover-${draftId}` });
        
        // Actualizar el borrador en el estado local
        const updatedDraft = {
          coverUrl: result.imageUrl || result.cover || result.draft?.coverUrl,
          coverFallbackUrl: result.draft?.coverFallbackUrl,
          coverHash: result.hash || result.coverHash || result.draft?.coverHash,
          imageKind: result.imageKind || result.draft?.imageKind || 'ai',
          imageProvider: result.provider || result.draft?.imageProvider || 'dall-e-3',
          coverImageUrl: result.draft?.coverImageUrl,
          generatedImages: result.draft?.generatedImages
        };
        
        console.log('[BorradoresIA:CustomCover] Estado actualizado:', updatedDraft);
        
        setDrafts(prev => prev.map(d => 
          d._id === draftId 
            ? { 
                ...d,
                ...updatedDraft,
                aiMetadata: {
                  ...d.aiMetadata,
                  imageProvider: result.provider || result.draft?.aiMetadata?.imageProvider || 'dall-e-3',
                  customPrompt: true
                }
              } 
            : d
        ));
        
        // Actualizar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(result.draft);
        }
      } else {
        toast.error(result.error || 'Error al generar portada', { id: `cover-${draftId}` });
      }
    } catch (error) {
      console.error('Error generando portada:', error);
      toast.error('Error de conexión', { id: `cover-${draftId}` });
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [draftId]: false }));
    }
  };

  const doPublish = async (draftId, { scheduleAt, categoryOverride, tagsOverride }) => {
    setIsPublishing(prev => ({ ...prev, [draftId]: true }));
    toast.loading('Publicando borrador...', { id: `publish-${draftId}` });
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ scheduleAt, categoryOverride, tagsOverride })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success(data.message || 'Noticia publicada correctamente', { id: `publish-${draftId}` });
        
        // Actualizar el borrador en el estado
        setDrafts(prev => prev.map(d => d._id === draftId ? data.draft : d));
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
        
        // Refrescar estadísticas al publicar
        notifyStatsChange();
        
        // Opcional: abrir la noticia en nueva pestaña para edición
        if (data.news && !data.alreadyPublished) {
          // window.open(`/admin/news/edit/${data.news._id}`, '_blank');
        }
      } else {
        toast.error(data.error || 'Error al publicar', { id: `publish-${draftId}` });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: `publish-${draftId}` });
    } finally {
      setIsPublishing(prev => ({ ...prev, [draftId]: false }));
    }
  };

  const handleDelete = async (draftId) => {
    if (!confirm('¿Rechazar este borrador?')) return;
    
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        // Cerrar modal si está abierto
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(null);
        }
        
        toast.success('Borrador rechazado');
        fetchDrafts();
        notifyStatsChange();
      } else {
        toast.error('Error al rechazar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleSchedule = async (draftId, scheduledAt) => {
    try {
      const res = await fetch(`/api/redactor-ia/programar/${draftId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ scheduledAt })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success(data.message);
        // Actualizar el borrador en el estado local
        setDrafts(prev => prev.map(d => d._id === draftId ? data.draft : d));
        if (previewModalDraft?._id === draftId) {
          setPreviewModalDraft(data.draft);
        }
      } else {
        toast.error(data.error || 'Error al programar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  // Handler para guardar edición manual
  const handleSaveManualEdit = async () => {
    if (!editModal) return;
    
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/redactor-ia/drafts/${editModal.draft._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          titulo: editModal.titulo,
          bajada: editModal.bajada,
          contenidoHTML: editModal.contenidoHTML
        })
      });
      
      const data = await res.json();
      
      if (data.ok || res.ok) {
        toast.success('Borrador actualizado');
        // Actualizar en la lista
        const updatedDraft = data.draft || { ...editModal.draft, titulo: editModal.titulo, bajada: editModal.bajada, contenidoHTML: editModal.contenidoHTML };
        setDrafts(prev => prev.map(d => d._id === editModal.draft._id ? updatedDraft : d));
        if (previewModalDraft?._id === editModal.draft._id) {
          setPreviewModalDraft(updatedDraft);
        }
        setEditModal(null);
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      reviewed: 'bg-green-500/20 text-green-400 border-green-500/30',
      published: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    
    const labels = {
      draft: 'Borrador',
      reviewed: 'Revisado',
      published: 'Publicado',
      rejected: 'Rechazado'
    };
    
    return (
      <span className={`px-2 py-1 border rounded text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getModeBadge = (mode) => {
    return mode === 'opinion' ? (
      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-medium">
        Opinión
      </span>
    ) : (
      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-medium">
        Factual
      </span>
    );
  };

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
    // 🐛 FIX: No mostrar default incorrecto, mostrar "IA" genérico si no hay proveedor
    return providerMap[provider] || provider || 'IA';
  };


  const getReviewBadge = (reviewStatus) => {
    const styles = {
      pending: 'bg-zinc-600/40 text-zinc-300',
      approved: 'bg-emerald-600/25 text-emerald-200 border border-emerald-600/40',
      changes_requested: 'bg-amber-600/25 text-amber-200 border border-amber-600/40',
      changes_in_progress: 'bg-sky-600/25 text-sky-200 border border-sky-600/40',
      changes_completed: 'bg-green-600/25 text-green-200 border border-green-600/40',
      rejected: 'bg-red-600/25 text-red-200 border border-red-600/40'
    };
    
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      changes_requested: 'Cambios solicitados',
      changes_in_progress: 'En revisión por IA',
      changes_completed: 'Cambios aplicados',
      rejected: 'Rechazado'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${styles[reviewStatus] || styles.pending}`}>
        {labels[reviewStatus] || reviewStatus}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* Lista de borradores */}
      <div>
        {/* Filters */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 sm:p-4 lg:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="min-w-0">
              <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                aria-label="Filtro de estado"
                className="w-full h-11 xl:h-12 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="draft">Borradores</option>
                <option value="reviewed">Revisados</option>
                <option value="published">Publicados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Modo</label>
              <select
                value={filters.mode}
                onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
                aria-label="Filtro de modo"
                className="w-full h-11 xl:h-12 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">Todos</option>
                <option value="factual">Factual</option>
                <option value="opinion">Opinión</option>
              </select>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs lg:text-sm text-zinc-400 mb-2">Revisión</label>
              <select
                value={filters.reviewStatus}
                onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value })}
                aria-label="Filtro de revisión"
                className="w-full h-11 xl:h-12 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="approved">Aprobados</option>
                <option value="changes_requested">Cambios solicitados</option>
                <option value="changes_in_progress">En revisión por IA</option>
                <option value="changes_completed">Cambios aplicados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Cargando borradores...</div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-12 bg-zinc-800/30 border border-zinc-700 rounded-xl">
            <FileText size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">No hay borradores</p>
            <p className="text-sm text-zinc-500 mt-2">
              Ve a "Cola de Temas" y selecciona temas para generar
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div
                key={draft._id}
                className={`relative rounded-2xl border bg-zinc-900/60 backdrop-blur p-4 md:p-5 transition-all duration-200 ${
                  previewModalDraft?._id === draft._id
                    ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 bg-zinc-900/80'
                    : 'border-zinc-800 hover:bg-zinc-900/80 hover:border-zinc-600'
                } ${
                  changesDropdown[draft._id] || changesDropdown[`mobile-${draft._id}`]
                    ? 'z-50'
                    : 'z-0'
                }`}
              >
                {/* Layout móvil: título a todo el ancho por debajo de la miniatura */}
                <div className="md:hidden grid grid-cols-[96px,1fr] gap-3 cursor-pointer" onClick={() => setPreviewModalDraft(draft)}>
                  {/* Miniatura (columna izquierda) */}
                  <div className="col-span-1">
                    <div className="w-24 h-16 rounded-md overflow-hidden border border-zinc-800/60 bg-zinc-800/60 relative">
                      {/* Mostrar coverUrl si existe (processed, uploaded, ai, etc.) */}
                      {draft.coverUrl && (
                        <img
                          key={`img-${draft._id}-${draft.coverHash}`}
                          src={`${draft.coverUrl}?v=${draft.coverHash || Date.now()}`}
                          alt={draft.titulo}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      
                      {/* Fallback a generatedImages.principal solo si no hay coverUrl */}
                      {!draft.coverUrl && draft.generatedImages?.principal && (
                        <img
                          key={draft.coverHash || draft._id}
                          src={`${draft.generatedImages.principal}?v=${draft.coverHash || Date.now()}`}
                          alt={draft.titulo}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      
                      {/* Badge según tipo de imagen */}
                      {draft.imageKind === 'placeholder' && (
                        <div 
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-zinc-800/90 backdrop-blur text-zinc-400 text-[10px] rounded"
                          title="Imagen temporal"
                        >
                          Placeholder
                        </div>
                      )}
                      {draft.imageKind === 'processed' && (
                        <div 
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-600/80 backdrop-blur text-white text-[10px] rounded"
                          title="Imagen procesada y almacenada localmente desde fuente"
                        >
                          ✓ Procesada
                        </div>
                      )}
                      {draft.imageKind === 'uploaded' && (
                        <div 
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-blue-600/80 backdrop-blur text-white text-[10px] rounded"
                          title="Imagen subida manualmente"
                        >
                          📤 Manual
                        </div>
                      )}
                      {/** @feature: opción "Generar desde contexto" (sin referencia, solo DALL-E) — Oct 2025 **/}
                      {(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
                        <div 
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur text-white text-[10px] rounded font-medium"
                          title={draft.aiMetadata?.usedSource ? "Generada con IA usando referencia de fuente" : "Generada con IA desde contexto (sin referencia)"}
                        >
                          {draft.aiMetadata?.usedSource === false 
                            ? '✨ IA - sin ref'
                            : `✨ IA (${getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})`
                          }
                        </div>
                      )}
                      
                      {/* Loader mientras genera */}
                      {isGeneratingImage[draft._id] && (
                        <div className="absolute inset-0 grid place-items-center bg-zinc-900/80 backdrop-blur-sm">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                        </div>
                      )}
                      
                      {/* Placeholder cuando no hay imagen */}
                      {!draft.coverUrl && !draft.generatedImages?.principal && !isGeneratingImage[draft._id] && (
                        <div className="absolute inset-0 grid place-items-center bg-zinc-800/70 text-zinc-500">
                          <FileText size={24} className="opacity-70" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Espaciador opcional en la derecha de la miniatura (misma fila) */}
                  <div />

                  {/* Bloque de texto a ANCHO COMPLETO debajo de la miniatura */}
                  <div className="col-span-2">
                    {/* Badges arriba */}
                    <div className="flex flex-wrap items-center gap-1 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-bold shrink-0">
                        <Sparkles size={12} />
                        IA
                      </span>
                      {getReviewBadge(draft.reviewStatus || 'pending')}
                      {getModeBadge(draft.mode)}
                      {getStatusBadge(draft.status)}
                    </div>

                    {/* Título a todo el ancho */}
                    <h3 className="mt-1 font-semibold text-white text-base leading-snug w-full line-clamp-3">
                      {draft.titulo ?? 'Sin título'}
                    </h3>
                    
                    {/* Indicador de programación */}
                    {draft.scheduledAt && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {draft.publishStatus === 'programado' ? (
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Clock size={12} />
                            Programada: {new Date(draft.scheduledAt).toLocaleString('es-ES', { 
                              day: 'numeric', 
                              month: 'short', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        ) : draft.publishStatus === 'publicado' ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle size={12} />
                            Publicada
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Bajada a todo el ancho */}
                    {draft.bajada && (
                      <p className="text-zinc-400 text-sm mt-1 w-full line-clamp-2">
                        {draft.bajada}
                      </p>
                    )}

                    {/* Metadatos compactos */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock size={14} />
                        <span className="hidden sm:inline">{new Date(draft.createdAt || draft.generatedAt).toLocaleString('es-ES')}</span>
                        <span className="sm:hidden">{new Date(draft.createdAt || draft.generatedAt).toLocaleDateString('es-ES')}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-zinc-900 rounded shrink-0">
                        {draft.categoria}
                      </span>
                      {draft.etiquetas?.length > 0 && (
                        <span className="shrink-0">{draft.etiquetas.length} tags</span>
                      )}
                      {draft.generatedBy && (
                        <span className="hidden md:inline shrink-0">Por: {draft.generatedBy.nombre || draft.generatedBy.email}</span>
                      )}
                      {draft.aiMetadata?.originalityScore !== undefined && (
                        <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${
                          draft.aiMetadata.contentOrigin === 'ai_synthesized'
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {draft.aiMetadata.contentOrigin === 'ai_synthesized' 
                            ? `Orig ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                            : `Der ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                          }
                        </span>
                      )}
                      {draft.aiMetadata?.categoryConfidence !== undefined && (
                        <span className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 shrink-0 ${
                          draft.aiMetadata.categoryLowConfidence
                            ? 'bg-orange-500/15 text-orange-400'
                            : draft.aiMetadata.categoryConfidence >= 0.7
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-blue-500/15 text-blue-400'
                        }`} title="Confianza de clasificación ensemble">
                          {draft.aiMetadata.categoryLowConfidence && <AlertCircle size={12} />}
                          Cat: {Math.round(draft.aiMetadata.categoryConfidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Layout desktop: grid 3 columnas */}
                <div className="hidden md:grid md:grid-cols-[auto,1fr,auto] md:gap-4 items-start cursor-pointer" onClick={() => setPreviewModalDraft(draft)}>
                  {/* Col 1: Miniatura SOLAMENTE (desktop) */}
                  <div className="w-40 h-24 rounded-md overflow-hidden bg-zinc-800/60 border border-zinc-800/60 relative shrink-0 z-0">
                  {/* Mostrar coverUrl si existe (processed, uploaded, ai, etc.) */}
                  {draft.coverUrl && (
                    <img
                      key={`img-desktop-${draft._id}-${draft.coverHash}`}
                      src={`${draft.coverUrl}?v=${draft.coverHash || Date.now()}`}
                      alt={draft.titulo}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  
                  {/* Fallback a generatedImages.principal solo si no hay coverUrl */}
                  {!draft.coverUrl && draft.generatedImages?.principal && (
                    <img
                      key={draft.coverHash || draft._id}
                      src={`${draft.generatedImages.principal}?v=${draft.coverHash || Date.now()}`}
                      alt={draft.titulo}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  
                  {/* Badge según tipo de imagen */}
                  {draft.imageKind === 'placeholder' && (
                    <div 
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-zinc-800/90 backdrop-blur text-zinc-400 text-[10px] rounded z-10"
                      title="Imagen temporal"
                    >
                      Placeholder
                    </div>
                  )}
                  {draft.imageKind === 'processed' && (
                    <div 
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-600/80 backdrop-blur text-white text-[10px] rounded z-10"
                      title="Imagen procesada y almacenada localmente desde fuente"
                    >
                      ✓ Procesada
                    </div>
                  )}
                  {draft.imageKind === 'uploaded' && (
                    <div 
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-blue-600/80 backdrop-blur text-white text-[10px] rounded z-10"
                      title="Imagen subida manualmente"
                    >
                      📤 Manual
                    </div>
                  )}
                  {(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
                    <div 
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur text-white text-[10px] rounded font-medium z-10"
                      title={draft.aiMetadata?.usedSource ? "Generada con IA usando referencia de fuente" : `Generada por IA (${getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})`}
                    >
                      ✨ IA ({getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})
                    </div>
                  )}
                  
                  {/* Loader mientras genera */}
                  {isGeneratingImage[draft._id] && (
                    <div className="absolute inset-0 grid place-items-center bg-zinc-900/80 backdrop-blur-sm z-20">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    </div>
                  )}
                  
                  {/* Placeholder cuando no hay imagen */}
                  {!draft.coverUrl && !draft.generatedImages?.principal && !isGeneratingImage[draft._id] && (
                    <div className="absolute inset-0 grid place-items-center bg-zinc-800/70 text-zinc-500">
                      <FileText size={24} className="opacity-70" />
                    </div>
                  )}
                  </div>

                  {/* Contenido (desktop) */}
                  <div className="min-w-0">
                    {/* Badges superiores */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-bold shrink-0">
                        <Sparkles size={12} />
                        IA
                      </span>
                      {getReviewBadge(draft.reviewStatus || 'pending')}
                      {getModeBadge(draft.mode)}
                      {getStatusBadge(draft.status)}
                    </div>
                    
                    {/* Título */}
                    <h3 className="text-lg font-semibold text-white line-clamp-2 mb-2 break-words">
                      {draft.titulo}
                    </h3>
                    
                    {/* Indicador de programación */}
                    {draft.scheduledAt && (
                      <div className="mb-2 flex items-center gap-1.5 text-sm">
                        {draft.publishStatus === 'programado' ? (
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Clock size={14} />
                            Programada: {new Date(draft.scheduledAt).toLocaleString('es-ES', { 
                              day: 'numeric', 
                              month: 'short', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        ) : draft.publishStatus === 'publicado' ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle size={14} />
                            Publicada
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Bajada */}
                    {draft.bajada && (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3 break-words">
                        {draft.bajada}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 break-words">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock size={14} />
                        <span className="hidden sm:inline">{new Date(draft.createdAt || draft.generatedAt).toLocaleString('es-ES')}</span>
                        <span className="sm:hidden">{new Date(draft.createdAt || draft.generatedAt).toLocaleDateString('es-ES')}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-zinc-900 rounded shrink-0">
                        {draft.categoria}
                      </span>
                      {draft.etiquetas?.length > 0 && (
                        <span className="shrink-0">{draft.etiquetas.length} tags</span>
                      )}
                      {draft.generatedBy && (
                        <span className="hidden md:inline shrink-0">Por: {draft.generatedBy.nombre || draft.generatedBy.email}</span>
                      )}
                      {draft.aiMetadata?.originalityScore !== undefined && (
                        <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${
                          draft.aiMetadata.contentOrigin === 'ai_synthesized'
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {draft.aiMetadata.contentOrigin === 'ai_synthesized' 
                            ? `Orig ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                            : `Der ${Math.round(draft.aiMetadata.originalityScore * 100)}%`
                          }
                        </span>
                      )}
                      {draft.aiMetadata?.categoryConfidence !== undefined && (
                        <span className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 shrink-0 ${
                          draft.aiMetadata.categoryLowConfidence
                            ? 'bg-orange-500/15 text-orange-400'
                            : draft.aiMetadata.categoryConfidence >= 0.7
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-blue-500/15 text-blue-400'
                        }`} title="Confianza de clasificación ensemble">
                          {draft.aiMetadata.categoryLowConfidence && <AlertCircle size={12} />}
                          Cat: {Math.round(draft.aiMetadata.categoryConfidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Col 3: Acciones (desktop) - columna derecha */}
                  <div className="flex flex-col gap-2 shrink-0 items-stretch justify-start">
                  {/* Mostrar Programar si: pendiente O sin publishStatus (antiguos) Y sin fecha programada */}
                  {(!draft.publishStatus || draft.publishStatus === 'pendiente') && !draft.scheduledAt ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleModal(draft);
                      }}
                      aria-label="Programar publicación"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <Calendar size={16} />
                      <span>Programar</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewModalDraft(draft);
                      }}
                      aria-label="Ver borrador"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <Eye size={16} />
                      <span>Ver</span>
                    </button>
                  )}
                  
                  {/* Split button para imagen */}
                  <div className="relative image-gen-dropdown-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isCurrentlyOpen = imageGenDropdown[draft._id];
                        setImageGenDropdown({ [draft._id]: !isCurrentlyOpen });
                      }}
                      disabled={isGeneratingImage[draft._id]}
                      aria-label="Opciones de imagen"
                      className="h-10 min-w-[140px] flex items-center justify-center gap-1.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <ImageIcon size={16} />
                      <span>{isGeneratingImage[draft._id] ? 'Generando...' : 'Imagen'}</span>
                      <ChevronDown size={14} className={`transition-transform ${imageGenDropdown[draft._id] ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {imageGenDropdown[draft._id] && (
                      <div className="absolute bottom-full right-0 mb-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageGenDropdown({});
                            handleGenerateWithAI(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Generar portada IA</span>
                          <span className="text-xs text-zinc-400">Crear portada con modelos de IA</span>
                        </button>
                        <div className="border-t border-zinc-800" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageGenDropdown({});
                            handleCaptureFromSource(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Capturar imagen del sitio</span>
                          <span className="text-xs text-zinc-400">Usar imagen de la noticia original</span>
                        </button>
                        <div className="border-t border-zinc-800" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadImage(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Subir imagen</span>
                          <span className="text-xs text-zinc-400">Seleccionar imagen desde tu dispositivo</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {draft.status === 'draft' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft._id);
                      }}
                      aria-label="Rechazar borrador"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <Trash2 size={16} />
                      <span>Rechazar</span>
                    </button>
                  )}
                  
                  {(() => {
                    const reviewStatus = draft.reviewStatus || 'pending';
                    const canApprove = draft.status === 'draft' && reviewStatus !== 'approved';
                    const canRequestChanges = draft.status === 'draft' && reviewStatus !== 'changes_requested';
                    const canReset = draft.status === 'draft' && reviewStatus !== 'pending';
                    const canPublish = reviewStatus === 'approved' && !draft.publishedAs;
                    
                    return (
                      <>
                        {canApprove && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(draft._id, 'approved');
                            }}
                            disabled={isReviewing[draft._id]}
                            aria-label="Aprobar borrador"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <CheckCircle size={16} />
                            <span>Aprobar</span>
                          </button>
                        )}
                        
                        {canPublish && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPublishModal(draft);
                            }}
                            disabled={isPublishing[draft._id]}
                            aria-label="Publicar borrador"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <ExternalLink size={16} />
                            <span>{isPublishing[draft._id] ? 'Publicando...' : 'Publicar'}</span>
                          </button>
                        )}
                        
                        {canRequestChanges && (
                          <div className="relative changes-dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const isCurrentlyOpen = changesDropdown[draft._id];
                                setChangesDropdown({ [draft._id]: !isCurrentlyOpen });
                              }}
                              disabled={isReviewing[draft._id]}
                              aria-label="Opciones de cambios"
                              className="h-10 min-w-[140px] flex items-center justify-center gap-1.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <XCircle size={16} />
                              <span>Cambios</span>
                              <ChevronDown size={14} className={`transition-transform ${changesDropdown[draft._id] ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {changesDropdown[draft._id] && (
                              <div className="absolute bottom-full right-0 mb-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    setEditModal({
                                      draft,
                                      titulo: draft.titulo || '',
                                      bajada: draft.bajada || '',
                                      contenidoHTML: draft.contenidoHTML || ''
                                    });
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Editar manualmente</span>
                                  <span className="text-xs text-zinc-400">Modificar título, bajada y contenido</span>
                                </button>
                                <div className="border-t border-zinc-800" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    handleReview(draft._id, 'changes_requested');
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Solicitar cambios con IA</span>
                                  <span className="text-xs text-zinc-400">Revisar texto con inteligencia artificial</span>
                                </button>
                                <div className="border-t border-zinc-800" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    handleCustomCoverPrompt(draft._id);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Generar nueva portada</span>
                                  <span className="text-xs text-zinc-400">Crear imagen con IA usando prompt</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {canReset && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(draft._id, 'pending');
                            }}
                            disabled={isReviewing[draft._id]}
                            aria-label="Volver a pendiente"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <Clock size={16} />
                            <span>Pendiente</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                  </div>
                </div>

                {/* Acciones móvil - debajo del contenido flotante */}
                <div className="md:hidden flex flex-wrap gap-2 mt-3">
                  {/* Mostrar Programar si: pendiente O sin publishStatus (antiguos) Y sin fecha programada */}
                  {(!draft.publishStatus || draft.publishStatus === 'pendiente') && !draft.scheduledAt ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleModal(draft);
                      }}
                      aria-label="Programar publicación"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <Calendar size={16} />
                      <span>Programar</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewModalDraft(draft);
                      }}
                      aria-label="Ver borrador"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <Eye size={16} />
                      <span>Ver</span>
                    </button>
                  )}
                  
                  {/* Split button para imagen (móvil) */}
                  <div className="relative image-gen-dropdown-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isCurrentlyOpen = imageGenDropdown[`mobile-${draft._id}`];
                        setImageGenDropdown({ [`mobile-${draft._id}`]: !isCurrentlyOpen });
                      }}
                      disabled={isGeneratingImage[draft._id]}
                      aria-label="Opciones de imagen"
                      className="h-10 min-w-[140px] flex items-center justify-center gap-1.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <ImageIcon size={16} />
                      <span>{isGeneratingImage[draft._id] ? 'Generando...' : 'Imagen'}</span>
                      <ChevronDown size={14} className={`transition-transform ${imageGenDropdown[`mobile-${draft._id}`] ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {imageGenDropdown[`mobile-${draft._id}`] && (
                      <div className="absolute bottom-full right-0 mb-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageGenDropdown({});
                            handleGenerateWithAI(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Generar portada IA</span>
                          <span className="text-xs text-zinc-400">Crear portada con modelos de IA</span>
                        </button>
                        <div className="border-t border-zinc-800" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageGenDropdown({});
                            handleCaptureFromSource(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Capturar imagen del sitio</span>
                          <span className="text-xs text-zinc-400">Usar imagen de la noticia original</span>
                        </button>
                        <div className="border-t border-zinc-800" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadImage(draft._id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                        >
                          <span className="font-medium text-white">Subir imagen</span>
                          <span className="text-xs text-zinc-400">Seleccionar imagen desde tu dispositivo</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {draft.status === 'draft' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft._id);
                      }}
                      aria-label="Rechazar borrador"
                      className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <Trash2 size={16} />
                      <span>Rechazar</span>
                    </button>
                  )}
                  
                  {(() => {
                    const reviewStatus = draft.reviewStatus || 'pending';
                    const canApprove = draft.status === 'draft' && reviewStatus !== 'approved';
                    const canRequestChanges = draft.status === 'draft' && reviewStatus !== 'changes_requested';
                    const canReset = draft.status === 'draft' && reviewStatus !== 'pending';
                    const canPublish = reviewStatus === 'approved' && !draft.publishedAs;
                    
                    return (
                      <>
                        {canApprove && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(draft._id, 'approved');
                            }}
                            disabled={isReviewing[draft._id]}
                            aria-label="Aprobar borrador"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <CheckCircle size={16} />
                            <span>Aprobar</span>
                          </button>
                        )}
                        
                        {canPublish && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPublishModal(draft);
                            }}
                            disabled={isPublishing[draft._id]}
                            aria-label="Publicar borrador"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <ExternalLink size={16} />
                            <span>{isPublishing[draft._id] ? 'Publicando...' : 'Publicar'}</span>
                          </button>
                        )}
                        
                        {canRequestChanges && (
                          <div className="relative changes-dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const isCurrentlyOpen = changesDropdown[`mobile-${draft._id}`];
                                setChangesDropdown({ [`mobile-${draft._id}`]: !isCurrentlyOpen });
                              }}
                              disabled={isReviewing[draft._id]}
                              aria-label="Opciones de cambios"
                              className="h-10 min-w-[140px] flex items-center justify-center gap-1.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <XCircle size={16} />
                              <span>Cambios</span>
                              <ChevronDown size={14} className={`transition-transform ${changesDropdown[`mobile-${draft._id}`] ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {changesDropdown[`mobile-${draft._id}`] && (
                              <div className="absolute bottom-full left-0 mb-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    setEditModal({
                                      draft,
                                      titulo: draft.titulo || '',
                                      bajada: draft.bajada || '',
                                      contenidoHTML: draft.contenidoHTML || ''
                                    });
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Editar manualmente</span>
                                  <span className="text-xs text-zinc-400">Modificar título, bajada y contenido</span>
                                </button>
                                <div className="border-t border-zinc-800" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    handleReview(draft._id, 'changes_requested');
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Solicitar cambios con IA</span>
                                  <span className="text-xs text-zinc-400">Revisar texto con inteligencia artificial</span>
                                </button>
                                <div className="border-t border-zinc-800" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChangesDropdown({});
                                    handleCustomCoverPrompt(draft._id);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                                >
                                  <span className="font-medium text-white">Generar nueva portada</span>
                                  <span className="text-xs text-zinc-400">Crear imagen con IA usando prompt</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {canReset && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(draft._id, 'pending');
                            }}
                            disabled={isReviewing[draft._id]}
                            aria-label="Volver a pendiente"
                            className="h-10 min-w-[44px] flex items-center justify-center gap-1.5 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <Clock size={16} />
                            <span>Pendiente</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de vista previa (mismo estilo que Comentarios) */}
      {previewModalDraft && (
        <DraftPreviewModal
          draft={previewModalDraft}
          onClose={() => setPreviewModalDraft(null)}
          onApprove={(draftId) => {
            handleReview(draftId, 'approved');
          }}
          onResetToPending={(draftId) => {
            handleReview(draftId, 'pending');
          }}
          onPublish={(draft) => {
            setPublishModal(draft);
          }}
          onRefresh={fetchDrafts}
        />
      )}

      {/* Modal de notas de revisión */}
      {reviewNotesModal && (
        <ReviewNotesModal
          title={reviewNotesModal.title}
          initialNotes={reviewNotesModal.initialNotes}
          required={reviewNotesModal.required}
          maxLength={500}
          mode={reviewNotesModal.mode || 'notes'}
          onSubmit={async (data) => {
            // Si es modo revisión IA, solicitar revisión asistida
            if (reviewNotesModal.mode === 'ai-revision') {
              setIsReviewing(prev => ({ ...prev, [reviewNotesModal.draftId]: true }));
              toast.loading('Iniciando revisión con IA...', { id: `ai-rev-${reviewNotesModal.draftId}` });
              
              try {
                const res = await fetch(`/api/redactor-ia/drafts/${reviewNotesModal.draftId}/request-changes`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ notes: data })
                });
                
                const result = await res.json();
                
                if (result.ok) {
                  toast.success('Revisión iniciada. Procesando en segundo plano...', { id: `ai-rev-${reviewNotesModal.draftId}` });
                  // Iniciar polling para verificar el estado
                  startRevisionPolling(reviewNotesModal.draftId);
                } else {
                  toast.error(result.error || 'Error al solicitar revisión', { id: `ai-rev-${reviewNotesModal.draftId}` });
                }
              } catch (error) {
                toast.error('Error de conexión', { id: `ai-rev-${reviewNotesModal.draftId}` });
              } finally {
                setIsReviewing(prev => ({ ...prev, [reviewNotesModal.draftId]: false }));
              }
            } else if (reviewNotesModal.mode === 'custom-cover-prompt') {
              // Lanzar generación de portada en background (sin await)
              // El modal se cerrará automáticamente por su propia lógica
              generateCustomCover(reviewNotesModal.draftId, data);
              // NO ejecutar setReviewNotesModal(null) aquí - el modal lo hará por sí mismo
              return; // Salir temprano sin cerrar desde el padre
            } else if (reviewNotesModal.mode === 'changes-list' && Array.isArray(data)) {
              // Si es modo lista de cambios (data es array), usar endpoint específico
              setIsReviewing(prev => ({ ...prev, [reviewNotesModal.draftId]: true }));
              toast.loading('Registrando cambios...', { id: `changes-${reviewNotesModal.draftId}` });
              
              try {
                const res = await fetch(`/api/redactor-ia/drafts/${reviewNotesModal.draftId}/request-changes`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ items: data })
                });
                
                const result = await res.json();
                
                if (result.ok) {
                  toast.success('Cambios solicitados registrados', { id: `changes-${reviewNotesModal.draftId}` });
                  setDrafts(prev => prev.map(d => d._id === reviewNotesModal.draftId ? result.draft : d));
                  if (previewModalDraft?._id === reviewNotesModal.draftId) {
                    setPreviewModalDraft(result.draft);
                  }
                  notifyStatsChange();
                } else {
                  toast.error(result.error || 'Error al solicitar cambios', { id: `changes-${reviewNotesModal.draftId}` });
                }
              } catch (error) {
                toast.error('Error de conexión', { id: `changes-${reviewNotesModal.draftId}` });
              } finally {
                setIsReviewing(prev => ({ ...prev, [reviewNotesModal.draftId]: false }));
              }
            } else {
              // Modo normal: notas simples
              await doReview(reviewNotesModal.draftId, reviewNotesModal.status, data);
            }
            setReviewNotesModal(null);
          }}
          onClose={() => setReviewNotesModal(null)}
        />
      )}

      {/* Modal de publicación */}
      {publishModal && (
        <PublishDraftModal
          draft={publishModal}
          onSubmit={async (options) => {
            await doPublish(publishModal._id, options);
            setPublishModal(null);
          }}
          onClose={() => setPublishModal(null)}
        />
      )}

      {/* Modal de programación */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={24} className="text-indigo-400" />
              Programar Publicación
            </h3>
            
            <p className="text-sm text-zinc-400 mb-4">
              Selecciona la fecha y hora para publicar automáticamente:
            </p>
            
            <p className="text-sm font-medium text-white mb-2 line-clamp-2">
              {scheduleModal.titulo}
            </p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const scheduledAt = e.target.scheduledAt.value;
              if (!scheduledAt) {
                toast.error('Selecciona una fecha y hora');
                return;
              }
              handleSchedule(scheduleModal._id, scheduledAt);
              setScheduleModal(null);
            }}>
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">
                  Fecha y hora de publicación
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  className="w-full h-11 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setScheduleModal(null)}
                  className="h-11 px-6 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Guardar programación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edición manual */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 size={24} className="text-amber-400" />
                Editar borrador manualmente
              </h3>
              <p className="text-sm text-zinc-400 mt-1">Modifica el título, bajada y contenido del borrador</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Título</label>
                <input
                  type="text"
                  value={editModal.titulo}
                  onChange={(e) => setEditModal({ ...editModal, titulo: e.target.value })}
                  className="w-full h-11 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Título del borrador"
                />
              </div>
              
              {/* Bajada */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Bajada / Entradilla</label>
                <textarea
                  value={editModal.bajada}
                  onChange={(e) => setEditModal({ ...editModal, bajada: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Resumen breve del artículo"
                />
              </div>
              
              {/* Contenido HTML */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Contenido (HTML)
                  <span className="text-xs text-zinc-500 ml-2">Puedes usar etiquetas HTML como &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt;, etc.</span>
                </label>
                <textarea
                  value={editModal.contenidoHTML}
                  onChange={(e) => setEditModal({ ...editModal, contenidoHTML: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                  placeholder="<p>Contenido del artículo...</p>"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-zinc-800 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                disabled={isSavingEdit}
                className="h-11 px-6 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveManualEdit}
                disabled={isSavingEdit || !editModal.titulo.trim()}
                className="h-11 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input file hidden para subir imagen */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />
    </div>
  );
}
