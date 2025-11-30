import { useTranslation } from "react-i18next";
import { useEffect, useState, useRef } from "react";
import DOMPurify from "dompurify";
import { jwtDecode } from "jwt-decode";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Dot, 
  Link2, 
  Star,
  TrendingUp,
  AlertCircle,
  Send,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Megaphone
} from "lucide-react";
import { FaWhatsapp, FaTwitter, FaFacebook, FaLink } from "react-icons/fa";
import PageHeader from "../components/PageHeader";

export default function Denuncias() {
  const { t } = useTranslation();
  const [denuncias, setDenuncias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState({});
  const [comentariosVisibles, setComentariosVisibles] = useState({});
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [nuevoComentario, setNuevoComentario] = useState({});
  const [respuestasVisibles, setRespuestasVisibles] = useState({});
  const [shareBox, setShareBox] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [expandedContent, setExpandedContent] = useState({});

  // Animaciones
  const [animLikes, setAnimLikes] = useState({});
  const [animComments, setAnimComments] = useState({});

  const boxRef = useRef();

  const token = localStorage.getItem("token");
  const isLoggedIn = !!token;
  let nombreUsuario = "";
  try {
    if (token) {
      const decoded = jwtDecode(token);
      nombreUsuario = decoded?.name || "";
    }
  } catch {}

  useEffect(() => {
    fetchDenuncias();
  }, []);

  const fetchDenuncias = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      
      // Manejar tanto el formato antiguo como el nuevo
      const denunciasList = data.denuncias || data;
      setDenuncias(Array.isArray(denunciasList) ? denunciasList : []);
      
      const likesIniciales = {};
      denunciasList.forEach((d) => (likesIniciales[d._id] = d.likes || 0));
      setLikes(likesIniciales);
    } catch (err) {
      console.error("Error al cargar denuncias:", err);
      setDenuncias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShareBox(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Helpers
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

  const extractFirstUrl = (htmlOrText) => {
    const text = htmlOrText || "";
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    return match ? match[0] : null;
  };

  const getShareLinks = (texto, url) => {
    const content = `${texto.slice(0, 100)}... ${url}`.trim();
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    
    if (isMobile) {
      return {
        wa: `whatsapp://send?text=${encodeURIComponent(content)}`,
        tw: `twitter://post?message=${encodeURIComponent(content)}`,
        fb: `fb://facewebmodal/f?href=${encodeURIComponent(url)}`
      };
    }
    return {
      wa: `https://wa.me/?text=${encodeURIComponent(content)}`,
      tw: `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto.slice(0, 100))}&url=${encodeURIComponent(url)}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    };
  };

  // Acciones
  const actualizarComentarios = async (denunciaId) => {
    try {
      const res = await fetch(`/api/reports/${denunciaId}/comentarios`);
      const comentariosActualizados = await res.json();
      setDenuncias((prev) =>
        prev.map((d) => (d._id === denunciaId ? { ...d, comentarios: comentariosActualizados } : d))
      );
    } catch (err) {
      console.error("Error al actualizar comentarios:", err);
    }
  };

  const toggleLike = async (id) => {
    try {
      const res = await fetch(`/api/reports/${id}/like`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });
      if (!res.ok) throw new Error("Error al dar like");
      const { likes: nuevosLikes } = await res.json();
      setLikes((prev) => ({ ...prev, [id]: nuevosLikes }));
      setAnimLikes((p) => ({ ...p, [id]: true }));
      setTimeout(() => setAnimLikes((p) => ({ ...p, [id]: false })), 250);
    } catch (err) {
      console.error("❌ Error al actualizar like:", err);
    }
  };

  const enviarComentario = async (idDenuncia, idPadre = null) => {
    if (!token) {
      alert("⚠ Debes iniciar sesión para comentar.");
      return;
    }
    
    const clave = respondiendoA?.id || idDenuncia;
    if (!nuevoComentario[clave]?.trim()) return;

    let url = `/api/reports/${idDenuncia}/comentarios`;
    if (idPadre) url = `/api/reports/${idDenuncia}/comentarios/${idPadre}/responder`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ mensaje: nuevoComentario[clave] })
      });

      if (res.ok) {
        await actualizarComentarios(idDenuncia);
        setNuevoComentario((prev) => ({ ...prev, [clave]: "" }));
        setRespondiendoA(null);
        setAnimComments((p) => ({ ...p, [idDenuncia]: true }));
        setTimeout(() => setAnimComments((p) => ({ ...p, [idDenuncia]: false })), 250);
      }
    } catch (err) {
      console.error("Error al enviar comentario:", err);
    }
  };

  const cancelarRespuesta = () => setRespondiendoA(null);

  const copiarEnlace = async (contenido) => {
    try {
      if (!navigator.clipboard) {
        alert("⚠ Tu navegador no permite copiar automáticamente.");
        return;
      }
      await navigator.clipboard.writeText(`${contenido.slice(0, 100)}...\n${window.location.href}`);
      alert("✅ Enlace copiado al portapapeles");
    } catch (err) {
      console.error("Error al copiar enlace:", err);
      alert("⚠ No se pudo copiar el enlace.");
    }
  };

  const toggleContent = (id) => {
    setExpandedContent(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Componente de vista previa de enlaces
  const LinkPreview = ({ url }) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const favicon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:bg-zinc-900 transition"
        >
          <div className="flex items-center gap-3">
            <img src={favicon} alt="" className="w-5 h-5 rounded" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-100 truncate flex items-center gap-2">
                <Link2 className="w-4 h-4 opacity-70" />
                {host}
              </div>
              <div className="text-xs text-zinc-500 truncate">{url}</div>
            </div>
          </div>
        </a>
      );
    } catch {
      return null;
    }
  };

  // Componente de comentarios mejorado
  const CommentThread = ({ comentario, denunciaId, nivel = 0 }) => {
    const isReplyingToThis = respondiendoA?.id === comentario._id;
    
    return (
      <div className={`${nivel > 0 ? 'ml-12 mt-2' : 'mt-3'}`}>
        <div className={`group ${nivel === 0 ? 'border-l-2 border-zinc-800 pl-4' : ''}`}>
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              nivel === 0 ? 'bg-zinc-800' : 'bg-zinc-900'
            }`}>
              <User className="w-4 h-4 text-zinc-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white text-sm">
                  {comentario.usuario || "Anónimo"}
                </span>
                <span className="text-xs text-zinc-500">
                  · {timeAgo(comentario.fecha)}
                </span>
              </div>
              
              <p className="text-sm text-zinc-300 break-words"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario.mensaje) }}
              />
              
              <div className="flex items-center gap-4 mt-2">
                {isLoggedIn && (
                  <button
                    onClick={() => setRespondiendoA({ id: comentario._id, denunciaId })}
                    className="text-xs text-zinc-500 hover:text-blue-400 transition"
                  >
                    Responder
                  </button>
                )}
                
                {comentario.respuestas?.length > 0 && (
                  <button
                    onClick={() => setRespuestasVisibles(prev => ({
                      ...prev,
                      [comentario._id]: !prev[comentario._id]
                    }))}
                    className="text-xs text-zinc-500 hover:text-white transition flex items-center gap-1"
                  >
                    {respuestasVisibles[comentario._id] ? (
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
              
              {/* Formulario de respuesta */}
              {isReplyingToThis && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Responder a ${comentario.usuario || "Anónimo"}...`}
                    value={nuevoComentario[comentario._id] || ""}
                    onChange={(e) =>
                      setNuevoComentario((prev) => ({ ...prev, [comentario._id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => enviarComentario(denunciaId, comentario._id)}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelarRespuesta}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {/* Respuestas anidadas */}
              {respuestasVisibles[comentario._id] && comentario.respuestas?.map((respuesta) => (
                <CommentThread
                  key={respuesta._id}
                  comentario={respuesta}
                  denunciaId={denunciaId}
                  nivel={nivel + 1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDenuncia = (d, isDestacada = false) => {
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    const share = getShareLinks(d.contenido, pageUrl);
    const url = extractFirstUrl(d.contenido);
    const isExpanded = expandedContent[d._id];
    const maxChars = 280;
    const needsExpansion = (d.contenido || "").length > maxChars;

    return (
      <article
        key={d._id}
        className={`border rounded-2xl transition-all duration-200 p-4 ${
          isDestacada 
            ? 'border-purple-500/20 bg-purple-950/20 hover:bg-purple-950/30' 
            : 'border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/60'
        }`}
      >
        {/* Tag de tipo */}
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${
            isDestacada 
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' 
              : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40'
          }`}>
            Denuncia ciudadana
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Avatar limpio */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
            isDestacada 
              ? 'bg-purple-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {d.nombre?.charAt(0).toUpperCase() || "A"}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white">
                {d.nombre || "Anónimo"}
              </span>
              {isDestacada && (
                <Star className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
              )}
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-zinc-500">{timeAgo(d.createdAt)}</span>
            </div>
              
              {/* Contenido */}
              <div className="mt-2">
                <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(
                      isExpanded || !needsExpansion 
                        ? d.contenido 
                        : `${d.contenido.slice(0, maxChars)}...`
                    )
                  }}
                />
                {needsExpansion && (
                  <button
                    onClick={() => toggleContent(d._id)}
                    className="mt-1 text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    {isExpanded ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </div>

              {/* Link preview */}
              {url && <LinkPreview url={url} />}

              {/* Media */}
              {d.media && (
                <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                  {/\.(mp4|mov|webm)$/i.test(d.media) ? (
                    <video
                      src={d.media}
                      controls
                      className="w-full max-h-96"
                    />
                  ) : (
                    <img
                      src={d.media}
                      alt="Evidencia"
                      className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition"
                      onClick={() => setSelectedMedia(d.media)}
                    />
                  )}
                </div>
              )}

              {/* Acciones - diseño limpio */}
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-800/40">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleLike(d._id)}
                    className={`flex items-center gap-1.5 text-zinc-400 hover:text-red-400 transition ${
                      animLikes[d._id] ? 'scale-110' : 'scale-100'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">{likes[d._id] || 0}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setComentariosVisibles((prev) => ({ ...prev, [d._id]: !prev[d._id] }));
                      setAnimComments((p) => ({ ...p, [d._id]: true }));
                      setTimeout(() => setAnimComments((p) => ({ ...p, [d._id]: false })), 250);
                    }}
                    className={`flex items-center gap-1.5 text-zinc-400 hover:text-blue-400 transition ${
                      animComments[d._id] ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">{d.comentarios?.length || 0}</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareBox((prev) => (prev === d._id ? null : d._id));
                    }}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-green-400 transition"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
                
                {(d.likes > 0 || d.comentarios?.length > 0) && (
                  <span className="text-xs text-zinc-600 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {(d.likes || 0) + (d.comentarios?.length || 0)} interacciones
                  </span>
                )}
              </div>

              {/* Caja de compartir */}
              {shareBox === d._id && (
                <div
                  ref={boxRef}
                  className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={share.wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition"
                  >
                    <FaWhatsapp className="w-5 h-5 text-green-400" />
                  </a>
                  <a
                    href={share.tw}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition"
                  >
                    <FaTwitter className="w-5 h-5 text-blue-400" />
                  </a>
                  <a
                    href={share.fb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-blue-700/20 hover:bg-blue-700/30 rounded-lg transition"
                  >
                    <FaFacebook className="w-5 h-5 text-blue-500" />
                  </a>
                  <button
                    onClick={() => copiarEnlace(d.contenido)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                  >
                    <FaLink className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              )}

              {/* Sección de comentarios */}
              {comentariosVisibles[d._id] && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  {/* Formulario de nuevo comentario */}
                  {isLoggedIn && (
                    <div className="flex gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Escribe un comentario..."
                        value={nuevoComentario[d._id] || ""}
                        onChange={(e) => setNuevoComentario((prev) => ({ ...prev, [d._id]: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && nuevoComentario[d._id]?.trim()) {
                            enviarComentario(d._id);
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                      />
                      <button
                        onClick={() => enviarComentario(d._id)}
                        disabled={!nuevoComentario[d._id]?.trim()}
                        className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-lg transition"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {/* Lista de comentarios */}
                  {d.comentarios?.length > 0 ? (
                    <div className="space-y-3">
                      {d.comentarios.map((comentario) => (
                        <CommentThread
                          key={comentario._id}
                          comentario={comentario}
                          denunciaId={d._id}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-zinc-500 py-4">
                      {isLoggedIn 
                        ? "Sé el primero en comentar"
                        : "Inicia sesión para comentar"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
      </article>
    );
  };

  const destacadas = denuncias.filter((d) => d.destacada);
  const normales = denuncias.filter((d) => !d.destacada);

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent">
      {/* Cabecera unificada */}
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Denuncias' }
        ]}
        icon={Megaphone}
        title="Denuncias"
        titleHighlight="Ciudadanas"
        subtitle="Voces que exigen justicia y cambio. Aquí cada historia cuenta."
        bannerEmoji=""
        bannerTitle="Tu voz importa"
        bannerText="Haz tu denuncia de forma segura y anónima si lo deseas."
        ctaLabel="Hacer denuncia"
        ctaHref={isLoggedIn ? "/romper" : "/login?redirect=/romper"}
        ctaIcon={TrendingUp}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* Stats bar - diseño limpio */}
        {denuncias.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{denuncias.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Total denuncias</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{destacadas.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Destacadas</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {denuncias.reduce((acc, d) => acc + (d.comentarios?.length || 0), 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Comentarios</p>
            </div>
          </div>
        )}

        {/* Contenido */}
        {denuncias.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] border border-white/5 rounded-xl">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg font-medium">
              {t("general.no_data", "Aún no hay denuncias aprobadas")}
            </p>
            <p className="text-sm text-zinc-500 mt-2 mb-6">
              Sé el primero en alzar tu voz contra la injusticia
            </p>
            <a
              href={isLoggedIn ? "/romper" : "/login?redirect=/romper"}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition"
            >
              <TrendingUp className="w-4 h-4" />
              Hacer la primera denuncia
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Destacadas */}
            {destacadas.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-purple-400 fill-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Denuncias Destacadas</h2>
                </div>
                <div className="space-y-3">
                  {destacadas.map((d) => renderDenuncia(d, true))}
                </div>
              </section>
            )}

            {/* Normales */}
            {normales.length > 0 && (
              <section>
                {destacadas.length > 0 && (
                  <h2 className="text-lg font-semibold text-white mb-3">Más denuncias</h2>
                )}
                <div className="space-y-3">
                  {normales.map((d) => renderDenuncia(d, false))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Modal de imagen ampliada */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-red-400 transition"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedMedia} 
            alt="Vista ampliada" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}