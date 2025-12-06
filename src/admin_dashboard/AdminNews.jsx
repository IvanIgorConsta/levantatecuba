import React, { useState, useEffect, useRef } from "react";
import NewsForm from "./components/NewsForm";
import NewsListPanel from "./components/NewsListPanel";
import AIImageGenerator from "./components/AIImageGenerator";
import AdminCommentsManager from "./components/AdminCommentsManager";
import CommentsOverlay from "./components/CommentsOverlay";
import { fileFromUrl, generateAIImageFilename } from "../utils/fileFromUrl";

export default function AdminNews() {
  // Estado general
  const [newsList, setNewsList] = useState([]);
  const [comments, setComments] = useState({});
  const [expanded, setExpanded] = useState({});
  const fileInputRef = useRef();
  const optionalImageRef = useRef();

  const [editId, setEditId] = useState(null);
  const [autorVisible, setAutorVisible] = useState("");

  // Estado para modal de gestión de comentarios
  const [mgr, setMgr] = useState({ open: false, id: null, title: '' });
  const openMgr = (id, title) => setMgr({ open: true, id, title });
  const closeMgr = () => setMgr({ open: false, id: null, title: '' });

  // Estado para CommentsOverlay
  const [showComments, setShowComments] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [uiTotalPages, setUiTotalPages] = useState(1);

  // Loading states
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [isUploadingAIMain, setIsUploadingAIMain] = useState(false);
  const [isUploadingAIOptional, setIsUploadingAIOptional] = useState(false);

  // Contadores estables para tabs
  const [counts, setCounts] = useState({ all: 0, published: 0, scheduled: 0 });

  // Info del scheduler de Facebook para mostrar tiempos estimados
  const [fbSchedulerInfo, setFbSchedulerInfo] = useState(null);

  // Para evitar race conditions
  const requestIdRef = useRef(0);

  // Filtros
  const [filtros, setFiltros] = useState({
    categoria: "",
    search: "",
    fechaDesde: "",
    fechaHasta: "",
    statusFilter: "all", // "all" | "published" | "scheduled" | "fbPending"
    fbStatus: "all", // "all" | "pending"
  });

  // Formulario
  const [form, setForm] = useState({
    titulo: "",
    contenido: "",
    imagen: null,
    imagenPreview: null,
    imagenes: [],
    imagenesPreview: [],
    autor: "",
    categoria: "",
    destacada: false,
    imagenOpcional: null,
    programar: false,
    publicarEl: "",
  });

  const [imagenOpcionalPreview, setImagenOpcionalPreview] = useState(null);

  useEffect(() => {
    fetchNoticias();
    fetchPerfil();
  }, []);

  // Recalcular contadores cuando cambian filtros de consulta (no la pestaña)
  useEffect(() => {
    refreshCounts();
  }, [filtros.categoria, filtros.search, filtros.fechaDesde, filtros.fechaHasta]);

  // Actualizar uiTotalPages cuando cambian counts o pageSize
  useEffect(() => {
    const totalForActiveFilter =
      filtros.statusFilter === "published"
        ? counts.published
        : filtros.statusFilter === "scheduled"
        ? counts.scheduled
        : filtros.statusFilter === "fbPending"
        ? counts.fbPending
        : counts.all;

    const calculatedUiTotalPages = Math.max(1, Math.ceil(totalForActiveFilter / pageSize));
    setUiTotalPages(calculatedUiTotalPages);
  }, [counts, filtros.statusFilter, pageSize]);

  // Auto-attach de imágenes temporales cuando se obtiene editId
  useEffect(() => {
    if (!editId) return;
    
    // Buscar cualquier temp en sessionStorage
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith("ai-temp-"));
    if (!keys.length) return;
    
    const tempData = JSON.parse(sessionStorage.getItem(keys[0]) || "{}");
    const { tempId, coverUrl, secondaryUrl } = tempData;
    
    if (!tempId || (!coverUrl && !secondaryUrl)) return;

    (async () => {
      try {
        console.log(`[AI attach] Adjuntando ${tempId} a noticia ${editId}`);
        
        const response = await fetch("/api/ai/images/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newsId: editId, tempId, coverUrl, secondaryUrl })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Actualizar previews si procede
          if (data.coverUrl) {
            setForm(prev => ({ 
              ...prev, 
              imagenPreview: data.coverUrl, 
              imagen: null 
            }));
          }
          
          if (data.secondaryUrl && typeof setImagenOpcionalPreview === "function") {
            setImagenOpcionalPreview(data.secondaryUrl);
          }
          
          // Limpiar temp de sessionStorage
          sessionStorage.removeItem(keys[0]);
          
          console.log(`[AI attach] ✅ Imágenes adjuntadas exitosamente`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("[AI attach] Error:", errorData.error || "Error desconocido");
        }
      } catch (error) {
        console.error("[AI attach] Error:", error.message);
      }
    })();
  }, [editId, setImagenOpcionalPreview]);

  const fetchPerfil = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const autor = data.nickname?.trim()
        ? data.nickname
        : `${data.firstName || ""} ${data.lastName || ""}`.trim();
      setAutorVisible(autor || "Anónimo");
      setForm((prev) => ({ ...prev, autor: autor || "Anónimo" }));
    } catch (err) {
      console.error("❌ Error al cargar perfil", err);
    }
  };

  // ===== Contadores (ahora confiar en totalsByStatus del backend si está disponible) =====
  const buildBaseParams = (overrides = {}) => {
    const p = {
      ...(filtros.categoria && { categoria: filtros.categoria }),
      ...(filtros.search && { search: filtros.search, titulo: filtros.search }),
      ...(filtros.fechaDesde && { fechaDesde: filtros.fechaDesde }),
      ...(filtros.fechaHasta && { fechaHasta: filtros.fechaHasta }),
      ...(filtros.fbStatus && filtros.fbStatus !== "all" && { fbStatus: filtros.fbStatus }),
      ...overrides,
    };
    return new URLSearchParams(p).toString();
  };

  const fetchListForCount = async (overrides) => {
    // Traemos una lista amplia y contamos en cliente
    const qs = buildBaseParams({ ...overrides, limit: 1000 });
    const res = await fetch(`/api/news?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.noticias) ? data.noticias : [];
  };

  const refreshCounts = async () => {
    setLoadingCounts(true);
    try {
      // Intentar obtener contadores del backend primero
      const qs = buildBaseParams({ limit: 1 });
      const res = await fetch(`/api/news?${qs}`);
      
      if (res.ok) {
        const data = await res.json();
        
        // Si el backend devuelve totalsByStatus, usarlo directamente
        if (data.totalsByStatus) {
          setCounts(data.totalsByStatus);
          setLoadingCounts(false);
          return;
        }
      }
      
      // Fallback: calcular en cliente como antes
      const publishedList = await fetchListForCount({ status: "published" });
      const published = publishedList.filter((n) => n?.status === "published").length;

      const scheduledRaw = await fetchListForCount({
        status: "scheduled",
        includeScheduled: "true",
      });
      const scheduled = scheduledRaw.filter((n) => n?.status === "scheduled").length;

      // Calcular FB pendientes usando el mismo filtro que el backend
      const fbPendingList = await fetchListForCount({ fbStatus: "pending" });
      const fbPending = fbPendingList.length;

      setCounts({
        published,
        scheduled,
        all: published + scheduled,
        fbPending,
      });
    } catch (e) {
      console.error("❌ Error al refrescar contadores", e);
    } finally {
      setLoadingCounts(false);
    }
  };
  // =========================================================================================

  // =======================
  // Obtener info del scheduler de Facebook
  // =======================
  const fetchFbSchedulerInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/redactor-ia/facebook/scheduler-info", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setFbSchedulerInfo(data);
        }
      }
    } catch (error) {
      console.warn("[AdminNews] Error fetching FB scheduler info:", error);
    }
  };

  // =======================
  // Cargar noticias (robusto)
  // =======================
  const fetchNoticias = async ({
    page = 1,
    limit = pageSize,
    categoria = "",
    search = "",
    fechaDesde = "",
    fechaHasta = "",
    statusFilter = filtros.statusFilter,
    fbStatus = filtros.fbStatus,
  } = {}) => {
    // Generar un ID único para esta request
    const currentRequestId = ++requestIdRef.current;
    setLoadingList(true);
    
    try {
      const baseParams = new URLSearchParams({
        page,
        limit,
        ...(categoria && { categoria }),
        ...(search && { search, titulo: search }), // enviar ambos por compatibilidad
        ...(fechaDesde && { fechaDesde }),
        ...(fechaHasta && { fechaHasta }),
      });

      // Filtro de Facebook pendientes
      if (statusFilter === "fbPending" || fbStatus === "pending") {
        baseParams.set("fbStatus", "pending");
        // Obtener info del scheduler para mostrar tiempos estimados
        fetchFbSchedulerInfo();
      } else if (statusFilter === "published") {
        baseParams.set("status", "published");
      } else if (statusFilter === "scheduled") {
        baseParams.set("status", "scheduled");
        baseParams.set("includeScheduled", "true");
      } else if (statusFilter === "all") {
        baseParams.set("includeScheduled", "true");
      }

      const attempt = async (params) => {
        const res = await fetch(`/api/news?${params.toString()}`);
        if (!res.ok) throw new Error("Error al obtener noticias");
        return res.json();
      };

      let data = await attempt(baseParams);

      // Fallback defensivo solo para "scheduled"
      if (statusFilter === "scheduled" && (!data?.noticias || data.noticias.length === 0)) {
        const fallback = new URLSearchParams(baseParams.toString());
        fallback.delete("status");
        fallback.set("includeScheduled", "true");
        data = await attempt(fallback);
      }

      // Normaliza lista
      let news = Array.isArray(data?.noticias) ? data.noticias : [];

      // Refuerzo cliente de "search" si el backend no filtró
      const q = String(search || "").trim().toLowerCase();
      if (q) {
        news = news.filter((n) => String(n?.titulo || "").toLowerCase().includes(q));
      }

      // Refuerzo defensivo por estado (solo si el backend NO filtró correctamente)
      // El backend ya aplica estos filtros, esto es solo para casos edge
      if (statusFilter === "scheduled") {
        news = news.filter((n) => n?.status === "scheduled");
      } else if (statusFilter === "published") {
        news = news.filter((n) => n?.status === "published");
      }
      // Para FB pendientes, confiar COMPLETAMENTE en el backend (usa buildFacebookCandidatesFilter)
      // No aplicar filtro local para evitar discrepancias con candidatesCount

      // Totales (seguimos la lógica existente, solo para la tabla actual)
      const totalItemsRaw = +data.totalItems || +data.total || NaN;
      const apiTotalPagesRaw = +data.totalPages || NaN;

      let pages;
      let items;
      if (Number.isFinite(apiTotalPagesRaw)) {
        pages = Math.max(1, apiTotalPagesRaw);
        items = Number.isFinite(totalItemsRaw)
          ? totalItemsRaw
          : (pages - 1) * limit + news.length;
      } else if (Number.isFinite(totalItemsRaw)) {
        items = Math.max(0, totalItemsRaw);
        pages = Math.max(1, Math.ceil(items / limit));
      } else {
        pages = news.length === limit ? page + 1 : page;
        items = (pages - 1) * limit + news.length;
      }

      // Verificar si esta respuesta aún es relevante (evitar race conditions)
      if (currentRequestId !== requestIdRef.current) {
        return; // Ignorar respuesta vieja
      }

      // Calcular uiTotalPages basado en counts
      const totalForActiveFilter =
        statusFilter === "published"
          ? counts.published
          : statusFilter === "scheduled"
          ? counts.scheduled
          : statusFilter === "fbPending"
          ? counts.fbPending
          : counts.all;

      const calculatedUiTotalPages = Math.max(1, Math.ceil(totalForActiveFilter / limit));

      setNewsList(news);
      setTotalPages(pages);
      setTotalItems(items);
      setUiTotalPages(calculatedUiTotalPages);

      // Clamp página si está fuera de rango según uiTotalPages
      if (page > calculatedUiTotalPages) {
        setCurrentPage(calculatedUiTotalPages);
        return fetchNoticias({ page: calculatedUiTotalPages, limit, categoria, search, fechaDesde, fechaHasta, statusFilter, fbStatus });
      }
      setCurrentPage(page);

      // Conteo de comentarios
      if (news.length > 0) {
        for (const n of news) {
          try {
            const r = await fetch(`/api/comments/${n._id}`);
            if (!r.ok) continue;
            const c = await r.json();
            setComments((prev) => ({ ...prev, [n._id]: c }));
          } catch {
            /* noop */
          }
        }
      }
    } catch (err) {
      console.error("❌ Error al obtener noticias:", err?.message || err?.toString() || 'Error de conexión');
    } finally {
      // Solo quitar loading si esta es la request más reciente
      if (currentRequestId === requestIdRef.current) {
        setLoadingList(false);
      }
    }
  };

  // Handlers formulario
  const handleInputChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ===== Funciones puras de ingesta (expuestas para reutilización) =====
  
  /**
   * Procesa un archivo como imagen principal
   * @param {File} file - Archivo a procesar
   */
  const ingestMainFile = async (file) => {
    if (file) {
      setForm((prev) => ({
        ...prev,
        imagen: file,
        imagenPreview: URL.createObjectURL(file),
      }));
    }
  };

  /**
   * Procesa un archivo como imagen opcional
   * @param {File} file - Archivo a procesar
   */
  const ingestOptionalFile = async (file) => {
    if (file) {
      setForm((prev) => ({ ...prev, imagenOpcional: file }));
      setImagenOpcionalPreview(URL.createObjectURL(file));
    }
  };

  // ===== Handlers de onChange que usan las funciones puras =====
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    ingestMainFile(file);
  };

  const handleOptionalImageChange = (e) => {
    const file = e.target.files[0];
    ingestOptionalFile(file);
  };

  const handleRemoveOptionalImage = () => {
    setForm((prev) => ({ ...prev, imagenOpcional: "" }));
    setImagenOpcionalPreview(null);
    setTimeout(() => {
      const formElement = document.getElementById("form-news");
      if (formElement) formElement.requestSubmit();
    }, 100);
  };

  const handleContentChange = (html) => {
    setForm((prev) => ({ ...prev, contenido: html }));
  };

  // ===== Handlers para imágenes de IA =====
  
  /**
   * Convierte una imagen de IA en archivo y la procesa como imagen principal
   * Usa la función pura ingestMainFile sin manipular el DOM
   */
  const handleAIImageAsMain = async (url) => {
    if (!url || isUploadingAIMain) return;
    
    setIsUploadingAIMain(true);
    try {
      // Convertir URL a File usando la utilidad
      const filename = generateAIImageFilename('cover');
      const file = await fileFromUrl(url, filename);
      
      // Usar la función pura de ingesta
      await ingestMainFile(file);
      
      // Si hay un input file ref, disparar el evento para activar el recorte
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
        const event = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
      
      console.log('✅ Imagen de IA procesada como principal:', filename);
    } catch (error) {
      console.error('❌ Error al procesar imagen de IA como principal:', error);
      alert(`Error al usar imagen de IA: ${error.message}`);
    } finally {
      setIsUploadingAIMain(false);
    }
  };

  /**
   * Convierte una imagen de IA en archivo y la procesa como imagen opcional
   * Usa la función pura ingestOptionalFile sin manipular el DOM
   */
  const handleAIImageAsOptional = async (url) => {
    if (!url || isUploadingAIOptional) return;
    
    setIsUploadingAIOptional(true);
    try {
      // Convertir URL a File usando la utilidad
      const filename = generateAIImageFilename('secondary');
      const file = await fileFromUrl(url, filename);
      
      // Usar la función pura de ingesta
      await ingestOptionalFile(file);
      
      console.log('✅ Imagen de IA procesada como opcional:', filename);
    } catch (error) {
      console.error('❌ Error al procesar imagen de IA como opcional:', error);
      alert(`Error al usar imagen de IA: ${error.message}`);
    } finally {
      setIsUploadingAIOptional(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    // Esperar a que terminen las subidas de imágenes de IA
    if (isUploadingAIMain || isUploadingAIOptional) {
      alert("⏳ Por favor espera a que terminen de procesarse las imágenes de IA.");
      return;
    }

    const titulo = form.titulo.trim();
    const contenido = form.contenido.trim();

    if (!titulo) {
      alert("⚠️ El título no puede estar vacío.");
      return;
    }
    if (!contenido) {
      alert("⚠️ El contenido no puede estar vacío.");
      return;
    }

    // Validar que haya imagen principal (archivo o preview de edición)
    if (!form.imagen && !form.imagenPreview && !editId) {
      alert("⚠️ Debes agregar una imagen principal.");
      return;
    }

    const formData = new FormData();
    formData.append("titulo", titulo);
    formData.append("contenido", contenido);
    formData.append("categoria", form.categoria);
    formData.append("destacada", form.destacada ? "true" : "false");
    formData.append("autor", (form.autor || autorVisible || "Anónimo").trim());

    if (form.programar && form.publicarEl) {
      formData.append("status", "scheduled");
      formData.append("publishAt", new Date(form.publicarEl).toISOString());
    } else {
      formData.append("status", "published");
    }

    if (form.imagen) formData.append("imagen", form.imagen);
    if (form.imagenOpcional instanceof File) {
      formData.append("imagenOpcional", form.imagenOpcional);
    } else if (form.imagenOpcional === "") {
      formData.append("imagenOpcional", "");
    }

    try {
      const res = await fetch(editId ? `/api/news/${editId}` : "/api/news", {
        method: editId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("❌ Backend error:", errorData);
        throw new Error("Error al guardar noticia");
      }

      await fetchNoticias({ page: 1, limit: pageSize, ...filtros });
      await refreshCounts(); // actualizar contadores tras crear/editar

      const formElement = e.nativeEvent?.submitter;
      const esAccionUsuario = formElement?.tagName === "BUTTON";
      if (esAccionUsuario) resetForm();

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("❌ Error al enviar noticia", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta noticia?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/news/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Error ${res.status}`);
      }
      
      await fetchNoticias({ page: currentPage, limit: pageSize, ...filtros });
      await refreshCounts(); // actualizar contadores tras eliminar
    } catch (err) {
      console.error("Error al eliminar:", err?.message || err);
      alert(`Error al eliminar: ${err?.message || 'Error de conexión'}`);
    }
  };

  const handleEdit = (news) => {
    setForm({
      titulo: news.titulo,
      contenido: news.contenido,
      imagen: null,
      imagenPreview: news.imagen || null,
      imagenes: [],
      imagenesPreview: [],
      autor: news.autor,
      categoria: news.categoria,
      destacada: news.destacada,
      imagenOpcional: null,
      programar: news.status === "scheduled",
      publicarEl: news.publishAt ? new Date(news.publishAt).toISOString().slice(0, 16) : "",
    });
    setImagenOpcionalPreview(news.imagenOpcional || null);
    setEditId(news._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const shareToFacebook = async (newsId) => {
    const noticia = newsList.find(n => n._id === newsId);
    if (!noticia) return;

    if (noticia.status !== "published") {
      alert("⚠️ Solo se pueden compartir noticias publicadas.");
      return;
    }

    const token = localStorage.getItem("token");
    
    try {
      // Actualizar estado local a "sharing"
      setNewsList(prev => prev.map(n => 
        n._id === newsId 
          ? { ...n, facebook_status: "sharing" }
          : n
      ));

      // Construir mensaje para Facebook
      const resumen = noticia.contenido
        .replace(/<[^>]*>/g, '') // Eliminar HTML
        .substring(0, 180)
        .trim();
      
      const hashtags = ["#LevantateCuba", "#NoticiasCuba", "#Cuba"];
      const message = `${noticia.titulo}\n\n${resumen}...\n\n🔗 Lee más en nuestra web\n\n${hashtags.join(" ")}`;
      const link = `${window.location.origin}/noticias/${noticia.slug || noticia._id}`;

      // Llamar al nuevo endpoint
      const response = await fetch("/api/social/facebook/share", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          postId: noticia._id,
          message,
          link
        })
      });

      const data = await response.json();

      if (response.ok && data.status === "ok") {
        // Actualizar estado local a "published"
        setNewsList(prev => prev.map(n => 
          n._id === newsId 
            ? { 
                ...n, 
                facebook_status: "published",
                facebook_post_id: data.fbPostId,
                facebook_permalink_url: data.permalink,
                // También actualizar el campo legacy para compatibilidad
                share: {
                  ...n.share,
                  fb: {
                    status: "posted",
                    postId: data.fbPostId,
                    permalink: data.permalink
                  }
                }
              }
            : n
        ));

        // Mostrar éxito
        alert(`✅ Publicado en Facebook exitosamente\n\nPuedes ver la publicación en:\n${data.permalink}`);
        
      } else {
        // Manejar error
        const errorMessage = data.message || "Error desconocido";
        
        // Actualizar estado local a "error"
        setNewsList(prev => prev.map(n => 
          n._id === newsId 
            ? { 
                ...n, 
                facebook_status: "error",
                facebook_last_error: errorMessage,
                // También actualizar el campo legacy
                share: {
                  ...n.share,
                  fb: {
                    status: "error",
                    error: errorMessage
                  }
                }
              }
            : n
        ));

        // Mostrar mensaje de error basado en el código
        let userMessage = errorMessage;
        if (data.code === "INVALID_TOKEN") {
          userMessage = "❌ El token de Facebook ha expirado. Por favor, contacta al administrador para renovarlo.";
        } else if (data.code === "PERMISSION_ERROR") {
          userMessage = "❌ Sin permisos para publicar. Verifica la configuración en Meta Business Suite.";
        } else if (data.code === "RATE_LIMIT") {
          userMessage = "❌ Límite de publicaciones alcanzado. Intenta más tarde.";
        }
        
        alert(userMessage);
      }

    } catch (error) {
      console.error("❌ Error al compartir:", error);
      
      // Actualizar estado local a "error"
      setNewsList(prev => prev.map(n => 
        n._id === newsId 
          ? { 
              ...n, 
              facebook_status: "error",
              facebook_last_error: error.message
            }
          : n
      ));
      
      alert(`❌ Error de conexión: ${error.message}`);
    }
  };

  // Función para re-scrapear URL en Facebook
  const handleRescrape = async (newsId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
      // Construir URL pública de la noticia
      // Buscar la noticia para obtener su slug
      const newsToRescrape = noticias.find(n => n._id === newsId);
      const publicUrl = `${window.location.origin}/noticias/${newsToRescrape?.slug || newsId}`;
      
      const response = await fetch(`/api/social/facebook/rescrape?url=${encodeURIComponent(publicUrl)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(`✅ Re-scrape exitoso\n\nTítulo detectado: ${data.title}\nImagen: ${data.image ? 'Sí' : 'No'}\n\nFacebook ha actualizado su caché.`);
      } else {
        alert(`❌ Error al re-scrapear: ${data.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error("Error al re-scrapear:", error);
      alert("❌ Error al conectar con el servidor");
    }
  };
  
  // Mantener handleShare para compatibilidad con NewsListPanel
  const handleShare = shareToFacebook;

  const countTotalComments = (commentsList) => {
    if (!commentsList || !Array.isArray(commentsList)) return 0;
    let total = commentsList.length;
    commentsList.forEach(comment => {
      if (comment.respuestas && comment.respuestas.length > 0) {
        total += countTotalComments(comment.respuestas);
      }
    });
    return total;
  };

  const handleOpenCommentsOverlay = (newsId) => {
    setSelectedNewsId(newsId);
    setShowComments(true);
  };

  const handleCloseCommentsOverlay = () => {
    setShowComments(false);
    setSelectedNewsId(null);
  };

  const handleDeleteComment = async (commentId, noticiaId) => {
    const token = localStorage.getItem("token");
    await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await fetch(`/api/comments/${noticiaId}`);
    const comentarios = await res.json();
    setComments((prev) => ({ ...prev, [noticiaId]: comentarios }));
  };

  const handleCancelEdit = () => {
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setForm({
      titulo: "",
      contenido: "",
      imagen: null,
      imagenPreview: null,
      imagenes: [],
      imagenesPreview: [],
      autor: autorVisible || "",
      categoria: "",
      destacada: false,
      imagenOpcional: null,
      programar: false,
      publicarEl: "",
    });
    setImagenOpcionalPreview(null);
    setEditId(null);
  };

  return (
    <div className="p-4 sm:p-6 text-white text-sm md:text-base min-h-screen">
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <h2 className="text-xl font-semibold text-white">
          {editId ? "Editando noticia" : "Crear nueva noticia"}
        </h2>
      </div>

      <NewsForm
        form={form}
        setForm={setForm}
        editId={editId}
        autorVisible={autorVisible}
        fileInputRef={fileInputRef}
        optionalImageRef={optionalImageRef}
        imagenOpcionalPreview={imagenOpcionalPreview}
        handleInputChange={handleInputChange}
        handleImageChange={handleImageChange}
        handleOptionalImageChange={handleOptionalImageChange}
        handleRemoveOptionalImage={handleRemoveOptionalImage}
        handleContentChange={handleContentChange}
        handleSubmit={handleSubmit}
        handleCancelEdit={handleCancelEdit}
        isUploadingAIMain={isUploadingAIMain}
        isUploadingAIOptional={isUploadingAIOptional}
      />

      {/* === Generación de imágenes por IA (Portada 16:9 + Secundaria 1:1) === */}
      <AIImageGenerator
        newsId={editId}
        title={form.titulo}
        content={form.contenido}
        disabled={false}
        onPickCover={handleAIImageAsMain}
        onPickSecondary={handleAIImageAsOptional}
        onTempChange={(tempData) => {
          // Opcional: logging de cambios temporales
          console.log('[AI] Cambio temporal:', tempData);
        }}
      />
      {/* === Fin Generación IA === */}

      <NewsListPanel
        newsList={newsList}
        comments={comments}
        expanded={expanded}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onShare={handleShare}
        onRescrape={handleRescrape}
        onViewComments={handleOpenCommentsOverlay}
        onDeleteComment={handleDeleteComment}
        onManageComments={openMgr}
        countTotalComments={countTotalComments}
        filtros={filtros}
        setFiltros={setFiltros}
        onFilter={(opts) => fetchNoticias({ page: 1, limit: pageSize, ...filtros, ...opts })}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        uiTotalPages={uiTotalPages}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        counts={counts}
        loadingList={loadingList}
        loadingCounts={loadingCounts}
        fbSchedulerInfo={fbSchedulerInfo}
      />

      {mgr.open && (
        <AdminCommentsManager 
          newsId={mgr.id} 
          newsTitle={mgr.title} 
          onClose={closeMgr} 
        />
      )}

      {showComments && selectedNewsId && (
        <CommentsOverlay
          newsId={selectedNewsId}
          onClose={handleCloseCommentsOverlay}
        />
      )}
    </div>
  );
}
