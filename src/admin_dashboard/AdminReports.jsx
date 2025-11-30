import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmModal from "../components/ConfirmModal";
import {
  CheckCircle2,
  Star,
  StarOff,
  Trash2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  User,
  Image as ImageIcon,
  Film,
  Filter,
  Search,
  Calendar,
  AlertCircle,
  Heart,
  Eye,
  X,
  FileText,
  TrendingUp,
  Download,
  Paperclip,
  Play,
  Maximize2
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || '/api';

export default function AdminReports() {
  const { t } = useTranslation();
  const [denuncias, setDenuncias] = useState([]);
  const [comentariosVisibles, setComentariosVisibles] = useState({});
  const [modal, setModal] = useState({ visible: false, onConfirm: null });
  const [expandedContenido, setExpandedContenido] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    destacadas: 0
  });
  
  // Filtros
  const [filtros, setFiltros] = useState({
    estado: 'todos',
    buscar: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ visible: false, onConfirm: null, message: "" });

  const fetchDenuncias = async (page = 1) => {
    setLoading(true);
    const token = localStorage.getItem("token");
    
    // Construir query string con filtros
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      ...(filtros.estado !== 'todos' && { estado: filtros.estado }),
      ...(filtros.buscar && { buscar: filtros.buscar }),
      ...(filtros.fechaDesde && { fechaDesde: filtros.fechaDesde }),
      ...(filtros.fechaHasta && { fechaHasta: filtros.fechaHasta })
    });

    try {
      const res = await fetch(`${API}/reports/admin?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error("Error al obtener denuncias");
      const data = await res.json();
      
      setDenuncias(data.denuncias || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setStats(data.stats || {
        total: 0,
        pendientes: 0,
        aprobadas: 0,
        destacadas: 0
      });
    } catch (err) {
      console.error("Error al cargar denuncias:", err);
      alert("❌ No se pudieron cargar las denuncias del servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDenuncias(currentPage);
  }, [currentPage, filtros]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleComentarios = (id) => {
    setComentariosVisibles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleContenido = (id) => {
    setExpandedContenido((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const eliminarDenuncia = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error("Error al eliminar");
      
      fetchDenuncias(currentPage);
      setModal({ visible: false, onConfirm: null });
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo eliminar la denuncia.");
      setModal({ visible: false, onConfirm: null });
    }
  };

  const eliminarAdjunto = async (denunciaId, attachmentIndex, attachmentName) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${denunciaId}/attachments/${attachmentIndex}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error("Error al eliminar adjunto");
      
      fetchDenuncias(currentPage);
      setDeleteModal({ visible: false, onConfirm: null, message: "" });
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo eliminar el adjunto.");
      setDeleteModal({ visible: false, onConfirm: null, message: "" });
    }
  };

  const handleCancelar = () => setModal({ visible: false, onConfirm: null });
  const handleCancelarDelete = () => setDeleteModal({ visible: false, onConfirm: null, message: "" });

  const aprobarDenuncia = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/aprobar/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error("Error al aprobar");
      fetchDenuncias(currentPage);
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo aprobar la denuncia.");
    }
  };

  const marcarDestacada = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/destacar/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error("Error al destacar");
      fetchDenuncias(currentPage);
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo marcar como destacada.");
    }
  };

  const eliminarComentario = async (idDenuncia, idComentario) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${idDenuncia}/comentarios/${idComentario}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Error al eliminar comentario");
      fetchDenuncias(currentPage);
    } catch (err) {
      console.error("Error al eliminar comentario:", err);
    }
  };

  const renderComentariosRecursivos = (arr, nivel = 0, idDenuncia) => {
    if (!arr || arr.length === 0) return null;
    return (
      <div className={nivel > 0 ? "ml-4 mt-2 space-y-1" : "space-y-2"}>
        {arr.map((c) => (
          <div
            key={c._id}
            className={`rounded-lg border ${
              nivel === 0 
                ? "border-zinc-800 bg-zinc-900/50" 
                : "border-zinc-800/50 bg-zinc-900/30"
            } p-3`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">
                    {c.usuario || "Anónimo"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(c.fecha).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{c.mensaje}</p>
              </div>
              <button
                className="ml-2 text-red-400 hover:text-red-300 transition p-1"
                onClick={() => eliminarComentario(idDenuncia, c._id)}
                title="Eliminar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {c.respuestas?.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => toggleComentarios(c._id)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {comentariosVisibles[c._id]
                    ? `Ocultar ${c.respuestas.length} respuestas`
                    : `Ver ${c.respuestas.length} respuestas`}
                </button>
                {comentariosVisibles[c._id] &&
                  renderComentariosRecursivos(c.respuestas, nivel + 1, idDenuncia)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

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
        return `hace ${interval} ${name}${interval > 1 ? (name === 'mes' ? 'es' : 's') : ''}`;
      }
    }
    return "justo ahora";
  };

  // Función para descargar archivo
  const handleDownload = async (url, originalName) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = originalName || 'archivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      alert('❌ No se pudo descargar el archivo');
    }
  };

  // Función para renderizar los adjuntos
  const renderAttachments = (denuncia) => {
    // Combinar attachments nuevos con media legacy si existe
    const allAttachments = [];
    
    // Agregar attachments nuevos
    if (denuncia.attachments && denuncia.attachments.length > 0) {
      denuncia.attachments.forEach((att, index) => {
        allAttachments.push({
          ...att,
          index,
          isNew: true
        });
      });
    }
    
    // Si hay media legacy y no está ya en attachments, agregarlo
    if (denuncia.media && (!denuncia.attachments || denuncia.attachments.length === 0)) {
      const isVideo = /\.(mp4|mov|webm)$/i.test(denuncia.media);
      allAttachments.push({
        url: denuncia.media,
        type: isVideo ? 'video' : 'image',
        originalName: 'Archivo multimedia',
        isLegacy: true
      });
    }
    
    if (allAttachments.length === 0) return null;
    
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Paperclip className="w-4 h-4" />
          <span>Adjuntos ({allAttachments.length})</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allAttachments.map((attachment, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
              {attachment.type === 'image' ? (
                <>
                  <img
                    src={attachment.url}
                    alt={attachment.originalName}
                    className="w-full h-32 object-cover cursor-pointer"
                    onClick={() => setSelectedMedia(attachment.url)}
                  />
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur text-white text-xs rounded">
                      <ImageIcon className="w-3 h-3" />
                      Imagen
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative h-32 bg-zinc-900 flex items-center justify-center">
                    <video
                      src={attachment.url}
                      className="w-full h-full"
                      controls
                      muted
                    />
                    <div className="absolute top-2 left-2 pointer-events-none">
                      <span className="flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur text-white text-xs rounded">
                        <Film className="w-3 h-3" />
                        Video
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              {/* Overlay con acciones */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {attachment.type === 'image' && (
                  <button
                    onClick={() => setSelectedMedia(attachment.url)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition"
                    title="Ver imagen completa"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => handleDownload(attachment.url, attachment.originalName)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition"
                  title="Descargar"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                {attachment.isNew && (
                  <button
                    onClick={() => {
                      setDeleteModal({
                        visible: true,
                        onConfirm: () => eliminarAdjunto(denuncia._id, attachment.index, attachment.originalName),
                        message: `¿Estás seguro de eliminar el archivo "${attachment.originalName}"?`
                      });
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition"
                    title="Eliminar adjunto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Info del archivo */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white truncate" title={attachment.originalName}>
                  {attachment.originalName}
                </p>
                {attachment.size && (
                  <p className="text-xs text-zinc-400">
                    {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header con estadísticas */}
      <div className="border-b border-zinc-800 bg-[#0d0d0d]/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Panel de Denuncias</h1>
                <p className="text-sm text-zinc-400 mt-1">Gestiona y modera las denuncias ciudadanas</p>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                  showFilters 
                    ? 'border-red-500 bg-red-500/10 text-red-400' 
                    : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Total</p>
                    <p className="text-xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-zinc-600" />
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-yellow-400/80">Pendientes</p>
                    <p className="text-xl font-bold text-yellow-400 mt-1">{stats.pendientes}</p>
                  </div>
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-400/80">Aprobadas</p>
                    <p className="text-xl font-bold text-green-400 mt-1">{stats.aprobadas}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              </div>
              
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-400/80">Destacadas</p>
                    <p className="text-xl font-bold text-purple-400 mt-1">{stats.destacadas}</p>
                  </div>
                  <Star className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="border-b border-zinc-800 bg-zinc-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Estado</label>
                <select
                  value={filtros.estado}
                  onChange={(e) => {
                    setFiltros({...filtros, estado: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="pendientes">Pendientes</option>
                  <option value="aprobadas">Aprobadas</option>
                  <option value="destacadas">Destacadas</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={filtros.buscar}
                    onChange={(e) => {
                      setFiltros({...filtros, buscar: e.target.value});
                      setCurrentPage(1);
                    }}
                    placeholder="Nombre o contenido..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Desde</label>
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(e) => {
                    setFiltros({...filtros, fechaDesde: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(e) => {
                    setFiltros({...filtros, fechaHasta: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
            
            {(filtros.estado !== 'todos' || filtros.buscar || filtros.fechaDesde || filtros.fechaHasta) && (
              <button
                onClick={() => {
                  setFiltros({
                    estado: 'todos',
                    buscar: '',
                    fechaDesde: '',
                    fechaHasta: ''
                  });
                  setCurrentPage(1);
                }}
                className="mt-3 text-xs text-zinc-400 hover:text-white transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de denuncias */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
          </div>
        ) : denuncias.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No hay denuncias que mostrar</p>
            <p className="text-sm text-zinc-500 mt-2">Ajusta los filtros o espera nuevas denuncias</p>
          </div>
        ) : (
          <div className="space-y-4">
            {denuncias.map((d) => {
              const isExpanded = expandedContenido[d._id];
              const maxChars = 280;
              const esLargo = (d.contenido || "").length > maxChars;

              return (
                <article
                  key={d._id}
                  className={`border rounded-xl transition-all hover:border-zinc-700 ${
                    d.destacada 
                      ? 'border-purple-500/30 bg-purple-500/5' 
                      : d.aprobada 
                        ? 'border-zinc-800 bg-zinc-900/30'
                        : 'border-yellow-500/20 bg-yellow-500/5'
                  }`}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-zinc-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          d.destacada 
                            ? 'bg-purple-500 text-black'
                            : d.aprobada
                              ? 'bg-green-500 text-black'
                              : 'bg-yellow-500 text-black'
                        }`}>
                          {d.nombre?.charAt(0).toUpperCase() || "A"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {d.nombre || "Anónimo"}
                            </span>
                            {d.destacada && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                Destacada
                              </span>
                            )}
                            {!d.aprobada && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                Pendiente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{timeAgo(d.createdAt)}</p>
                        </div>
                      </div>
                      
                      {/* Quick actions */}
                      <div className="flex items-center gap-2">
                        {(d.attachments?.length > 0 || d.media) && (
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <Paperclip className="w-3 h-3" />
                            {d.attachments?.length || 1}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Heart className="w-3 h-3" />
                          {d.likes || 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <MessageSquare className="w-3 h-3" />
                          {d.comentarios?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-3">
                    <div className="text-white text-sm leading-relaxed">
                      {isExpanded || !esLargo
                        ? d.contenido
                        : `${d.contenido.slice(0, maxChars)}...`}
                      {esLargo && (
                        <button
                          onClick={() => toggleContenido(d._id)}
                          className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
                        >
                          {isExpanded ? "Ver menos" : "Ver más"}
                        </button>
                      )}
                    </div>

                    {/* Sección de Adjuntos Mejorada */}
                    {renderAttachments(d)}

                    {/* Comments section */}
                    {d.comentarios?.length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleComentarios(d._id)}
                          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {comentariosVisibles[d._id]
                            ? `Ocultar ${d.comentarios.length} comentarios`
                            : `Ver ${d.comentarios.length} comentarios`}
                        </button>
                        
                        {comentariosVisibles[d._id] && (
                          <div className="mt-3">
                            {renderComentariosRecursivos(d.comentarios, 0, d._id)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-zinc-800/50 flex flex-wrap gap-2">
                    {!d.aprobada && (
                      <button
                        onClick={() => aprobarDenuncia(d._id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium rounded-lg border border-green-500/30 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprobar
                      </button>
                    )}
                    
                    <button
                      onClick={() => marcarDestacada(d._id)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                        d.destacada
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {d.destacada ? (
                        <>
                          <Star className="w-4 h-4 fill-current" />
                          Destacada
                        </>
                      ) : (
                        <>
                          <StarOff className="w-4 h-4" />
                          Destacar
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setModal({
                        visible: true,
                        onConfirm: () => eliminarDenuncia(d._id),
                      })}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg border border-red-500/30 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={i}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                      pageNum === currentPage
                        ? 'bg-red-500 text-black'
                        : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Media viewer modal (Lightbox mejorado) */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-red-400 transition p-2 bg-white/10 hover:bg-white/20 rounded-lg"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedMedia} 
            alt="Vista ampliada" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirm modal para eliminar denuncia */}
      {modal.visible && (
        <ConfirmModal
          visible={modal.visible}
          mensaje="¿Estás seguro de que deseas eliminar esta denuncia? Esta acción eliminará también todos los archivos adjuntos y no se puede deshacer."
          onConfirm={modal.onConfirm}
          onCancel={handleCancelar}
        />
      )}

      {/* Confirm modal para eliminar adjunto */}
      {deleteModal.visible && (
        <ConfirmModal
          visible={deleteModal.visible}
          mensaje={deleteModal.message}
          onConfirm={deleteModal.onConfirm}
          onCancel={handleCancelarDelete}
        />
      )}
    </main>
  );
}