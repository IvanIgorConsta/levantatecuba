// src/pages/NoticiaDetalle.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import DOMPurify from "dompurify";
import { FaFacebook, FaTelegram, FaTwitter, FaWhatsapp } from "react-icons/fa";
import { MessageSquareText, Newspaper, Clock, FileText } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ShopCTA from "../components/ShopCTA";
import DebugShopCTA from "../components/DebugShopCTA";
import CommentThread from "../components/CommentThread";
import { extractLeadFromHtml } from "../utils/extractLead";
import { normalizeCoverData, buildCoverSrc } from "../utils/imageUtils";
import { 
  generateFacebookPostText, 
  generateFirstCommentSuggestion, 
  buildFacebookShareUrl,
  copyToClipboard 
} from "../utils/shareUtils";

export default function NoticiaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [noticia, setNoticia] = useState(null);
  const [relacionadas, setRelacionadas] = useState([]);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showCommentCopied, setShowCommentCopied] = useState(false);

  // Siempre arriba al cambiar de noticia
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Barra de progreso de lectura con throttling (requestAnimationFrame)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const article = document.querySelector('article');
          if (!article) {
            ticking = false;
            return;
          }
          
          const articleTop = article.offsetTop;
          const articleHeight = article.offsetHeight;
          const windowHeight = window.innerHeight;
          const scrollTop = window.scrollY;
          
          const calc = (scrollTop - articleTop + windowHeight * 0.3) / articleHeight;
          const progress = Math.max(0, Math.min(1, calc));
          
          setReadingProgress(progress * 100);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [noticia]);

  useEffect(() => {
    fetch(`/api/news/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Noticia no encontrada');
        }
        return res.json();
      })
      .then((data) => {
        // Si no hay datos o no hay título, redirigir a 404
        if (!data || !data.titulo) {
          navigate('/404', { replace: true });
          return;
        }
        
        const contenidoSanitizado = DOMPurify.sanitize(data.contenido, {
          ALLOWED_TAGS: ["p","strong","em","u","a","br","ul","ol","li","blockquote","h1","h2","h3","figure","figcaption","img","span"],
          ALLOWED_ATTR: ["href","target","rel","src","alt","title","class","style","loading"],
          RETURN_DOM: true,
          WHOLE_DOCUMENT: false
        });

        // ===== Procesado limpio: seccionado + imagen opcional sin drop-cap/quotes/divisores =====
        const cont = contenidoSanitizado.nodeType === 1 ? contenidoSanitizado : (() => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(`<div>${contenidoSanitizado}</div>`, "text/html");
          return doc.body.firstElementChild;
        })();

        // Promoción de párrafos a h3: detectar "texto:" seguido de lista
        const allNodes = Array.from(cont.querySelectorAll("p"));
        allNodes.forEach((p) => {
          const text = (p.textContent || "").trim();
          // Caso 1: termina en ":" y el siguiente hermano es ul/ol
          if (text.endsWith(":") && p.nextElementSibling && p.nextElementSibling.matches("ul,ol")) {
            const h3 = document.createElement("h3");
            h3.innerHTML = p.innerHTML;
            p.replaceWith(h3);
          }
          // Caso 2: pregunta corta (termina en "?" y ≤120 chars)
          else if (text.endsWith("?") && text.length <= 120) {
            const h3 = document.createElement("h3");
            h3.innerHTML = p.innerHTML;
            p.replaceWith(h3);
          }
        });

        // Asegurar rel="noopener noreferrer" en enlaces externos
        Array.from(cont.querySelectorAll('a[target="_blank"]')).forEach(link => {
          const currentRel = link.getAttribute('rel') || '';
          if (!currentRel.includes('noopener')) {
            link.setAttribute('rel', (currentRel + ' noopener noreferrer').trim());
          }
        });

        // Seleccionar bloques (no solo párrafos)
        const blocks = Array.from(cont.querySelectorAll("h2,h3,p,ul,ol,blockquote"));

        // Helper para extraer texto plano de cualquier bloque (incluyendo listas)
        const plain = (node) => {
          if (node.matches("ul,ol")) {
            return Array.from(node.querySelectorAll("li"))
              .map(li => li.textContent || "")
              .join(" ");
          }
          return (node.textContent || "").replace(/\s+/g, " ").trim();
        };
        const isSubstantial = (txt) => txt.split(/\s+/).filter(Boolean).length >= 8;

        // Agrupar en secciones por longitud y cantidad de bloques sustanciales
        // Forzar corte antes de h2/h3 si ya hay contenido en bucket
        const sections = [];
        let bucket = [];
        let charSum = 0, substCount = 0;

        blocks.forEach((node, idx) => {
          const t = plain(node);
          
          // Forzar corte antes de encabezados si ya hay contenido
          if (node.matches("h2,h3") && bucket.length > 0) {
            sections.push({ html: bucket.join(""), charSum, substCount });
            bucket = []; charSum = 0; substCount = 0;
          }
          
          bucket.push(node.outerHTML);
          if (isSubstantial(t)) { substCount++; charSum += t.length; }
          
          const shouldCut =
            (charSum >= 1400 && substCount >= 3) ||
            (substCount >= 5) ||
            (idx === blocks.length - 1);
          
          if (shouldCut) {
            sections.push({ html: bucket.join(""), charSum, substCount });
            bucket = []; charSum = 0; substCount = 0;
          }
        });

        // Inserción “natural” de imagen opcional entre 45–65% del total
        const totalChars = sections.reduce((a, s) => a + s.charSum, 0) || 1;
        let contenidoConImagen = "";
        let injectedImage = false;
        let acc = 0;

        sections.forEach((sec, secIdx) => {
          // Verificar si la sección termina con una lista activa (ul/ol)
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = sec.html;
          const lastChild = tempDiv.lastElementChild;
          const endsWithList = lastChild && lastChild.matches('ul,ol');
          
          acc += sec.charSum;
          const pct = acc / totalChars;
          
          // Insertar imagen ANTES de la sección si cae en el rango Y la sección termina con lista
          if (!injectedImage && pct >= 0.45 && pct <= 0.65 && data.imagenOpcional && endsWithList) {
            contenidoConImagen += `
              <figure class="w-full my-10">
                <img src="${data.imagenOpcional}" alt="Imagen adicional" class="w-full h-auto rounded-lg shadow-none mx-auto border border-white/10" loading="lazy" decoding="async" fetchpriority="low"/>
              </figure>`;
            injectedImage = true;
          }
          
          contenidoConImagen += sec.html;
          
          // Insertar imagen DESPUÉS de la sección si no termina con lista
          if (!injectedImage && pct >= 0.45 && pct <= 0.65 && data.imagenOpcional && !endsWithList) {
            contenidoConImagen += `
              <figure class="w-full my-10">
                <img src="${data.imagenOpcional}" alt="Imagen adicional" class="w-full h-auto rounded-lg shadow-none mx-auto border border-white/10" loading="lazy" decoding="async" fetchpriority="low"/>
              </figure>`;
            injectedImage = true;
          }
        });

        // Fallback: si no se inyectó la imagen y existe, insertarla
        if (!injectedImage && data.imagenOpcional) {
          if (sections.length >= 2) {
            // Insertar después de la primera sección sustancial
            const firstSection = sections[0].html;
            const rest = sections.slice(1).map(s => s.html).join('');
            contenidoConImagen = firstSection + `
              <figure class="w-full my-10">
                <img src="${data.imagenOpcional}" alt="Imagen adicional" class="w-full h-auto rounded-lg shadow-none mx-auto border border-white/10" loading="lazy" decoding="async" fetchpriority="low"/>
              </figure>` + rest;
          } else {
            // Solo 1 sección: agregar al final
            contenidoConImagen += `
              <figure class="w-full my-10">
                <img src="${data.imagenOpcional}" alt="Imagen adicional" class="w-full h-auto rounded-lg shadow-none mx-auto border border-white/10" loading="lazy" decoding="async" fetchpriority="low"/>
              </figure>`;
          }
          injectedImage = true;
        }

        // Detección de preguntas y ajuste de estilos tipográficos
        contenidoConImagen = contenidoConImagen
          .replace(/<h2([^>]*)>/gi, '<h2$1 class="text-xl md:text-2xl font-semibold tracking-tight mt-10 mb-4 pl-3 border-l-4 border-blue-500/60">')
          .replace(/<h3([^>]*)>/gi, '<h3$1 class="text-lg md:text-xl font-semibold mt-8 mb-3 pl-3 border-l-2 border-blue-500/50">');

        // Detectar párrafos con preguntas (¿...? o Pregunta:)
        contenidoConImagen = contenidoConImagen.replace(
          /<p>([^<]*(?:¿[^?]+\?|Pregunta:[^<]+))<\/p>/gi,
          '<div class="my-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 md:p-5 shadow-sm"><p class="font-medium"><span class="inline-flex items-center text-xs px-2 py-0.5 rounded-md border border-blue-500/40 bg-blue-500/10 mr-2">Pregunta</span>$1</p></div>'
        );
        // ===== Fin procesado limpio =====

        const normalized = normalizeCoverData({
          ...data,
          titulo: DOMPurify.sanitize(data.titulo),
          contenido: contenidoConImagen,
          autor: DOMPurify.sanitize(data.autor || "Autor verificado"),
        });
        setNoticia(normalized);

        fetch(`/api/news/${data._id}/relacionadas`)
          .then((res) => res.json())
          .then((rel) => {
            // Normalizar cada noticia relacionada con campos unificados
            const normalized = rel.map(r => normalizeCoverData(r));
            setRelacionadas(normalized);
          })
          .catch(() => setRelacionadas([]));
      })
      .catch((err) => {
        console.error('Error cargando noticia:', err);
        navigate('/404', { replace: true });
      });
  }, [id]);


  const renderCompartir = () => {
    // URL canónica de la noticia
    const canonicalUrl = `${window.location.origin}/noticias/${id}`;
    const url = encodeURIComponent(canonicalUrl);
    const text = encodeURIComponent(noticia?.titulo || "");

    // Generar texto del post para Facebook con quote
    const facebookPostText = generateFacebookPostText(noticia, canonicalUrl);
    const facebookShareUrl = buildFacebookShareUrl(canonicalUrl, facebookPostText);

    const handleNativeShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: noticia?.titulo || "Levántate Cuba",
            text: noticia?.titulo || "Levántate Cuba",
            url: canonicalUrl,
          });
        } catch (err) {
          // Usuario canceló o error - no hacer nada
        }
      }
    };

    // Handler para Facebook: copiar comentario sugerido al portapapeles
    const handleFacebookClick = async (e) => {
      // Generar comentario sugerido (con URL)
      const commentSuggestion = generateFirstCommentSuggestion(noticia?.categoria, canonicalUrl);
      
      // Intentar copiar al portapapeles
      const copied = await copyToClipboard(commentSuggestion);
      
      if (copied) {
        // Mostrar notificación discreta
        setShowCommentCopied(true);
        setTimeout(() => setShowCommentCopied(false), 4000);
      }
      
      // Continuar con el compartir (el navegador abrirá la ventana)
    };

    return (
      <div className="mt-10 mb-14">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-4 bg-yellow-400 rounded-sm" />
          <span className="text-white text-sm font-semibold tracking-wide uppercase">Compartir</span>
        </div>
        
        {/* Notificación de comentario copiado */}
        {showCommentCopied && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs sm:text-sm animate-fade-in">
            ✅ <strong>Comentario sugerido copiado</strong> - Pégalo como tu primer comentario en Facebook para mayor engagement
          </div>
        )}
        
        <div className="flex items-center gap-4">
          {/* Botón nativo (solo móviles con soporte) */}
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors duration-200"
              aria-label="Compartir noticia"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir
            </button>
          )}
          
          {/* Íconos tradicionales */}
          <div className="flex gap-4 text-white text-xl">
            <a href={`https://wa.me/?text=${url}`} target="_blank" rel="noreferrer" className="hover:text-green-400" aria-label="Compartir en WhatsApp">
              <FaWhatsapp />
            </a>
            {/* Facebook con quote y comentario sugerido copiado */}
            <a 
              href={facebookShareUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-blue-500" 
              onClick={handleFacebookClick}
              aria-label="Compartir en Facebook"
              title="Compartir en Facebook (se copiará un comentario sugerido)"
            >
              <FaFacebook />
            </a>
            <a href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`} target="_blank" rel="noreferrer" className="hover:text-sky-400" aria-label="Compartir en Twitter">
              <FaTwitter />
            </a>
            <a href={`https://t.me/share/url?url=${url}&text=${text}`} target="_blank" rel="noreferrer" className="hover:text-blue-300" aria-label="Compartir en Telegram">
              <FaTelegram />
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderRelacionadas = () => {
    if (!relacionadas.length) return null;
    const noticiasAMostrar = relacionadas.slice(0, 3);

    return (
      <div className="mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-white/90" />
          <h3 className="text-xl font-semibold text-white/90">Te puede interesar</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {noticiasAMostrar.map((n) => {
            const coverSrc = buildCoverSrc(n._cover, n._coverHash);
            return (
              <article 
                key={n._id}
                className="w-full max-w-full sm:max-w-none rounded-2xl overflow-hidden bg-zinc-900/60 border border-zinc-800/60 hover:bg-zinc-900/80 transition group"
              >
                <Link to={`/noticias/${n._id}`} className="block">
                  {/* Cover con key para bust de caché visual */}
                  <div 
                    key={n._coverHash || n._id} 
                    className="w-full overflow-hidden relative"
                  >
                    {coverSrc ? (
                      <img 
                        src={coverSrc}
                        alt={n.titulo} 
                        className="block w-full aspect-[16/9] object-cover sm:h-36 sm:aspect-auto group-hover:scale-[1.03] transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full aspect-[16/9] sm:h-36 sm:aspect-auto bg-zinc-800/70 flex items-center justify-center">
                        <Newspaper className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                    {/* Gradiente sutil en la parte inferior */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  </div>
                  
                  <div className="p-3 sm:p-4">
                    <h4 className="font-semibold text-base mb-2 line-clamp-2 text-white">{n.titulo}</h4>
                    <div className="text-xs text-gray-400">
                      <p className="italic">
                        {new Date(n.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    );
  };

  if (!noticia) return <div className="text-white text-center p-10">Cargando noticia...</div>;

  // Lead text con fallback
  const leadText = noticia?.bajada?.trim()
    ? noticia.bajada.trim()
    : extractLeadFromHtml(noticia?.contenido || '', 260);

  // Meta description limpia
  const getCleanDescription = (htmlContent) => {
    if (!htmlContent) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const cleanText = tempDiv.textContent || tempDiv.innerText || "";
    return cleanText.slice(0, 150).replace(/\s+/g, " ").trim();
  };

  return (
    <>
      <Helmet>
        <title>{noticia?.titulo ? `${noticia.titulo} - Levántate Cuba` : "Levántate Cuba - Noticias"}</title>
        {/* Los meta tags Open Graph son renderizados del lado del servidor por el middleware */}
        {/* Solo mantenemos tags básicos que no afectan a Facebook */}
        <meta name="description" content={getCleanDescription(noticia?.contenido)} />
        {noticia?.autor && <meta name="author" content={noticia.autor} />}

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": noticia?.titulo || "LevántateCuba",
            "image": [noticia?._cover ? 
              (noticia._cover.startsWith('http') ? noticia._cover : `https://levantatecuba.com${noticia._cover}`) : 
              "https://levantatecuba.com/img/og-default.jpg"],
            "datePublished": noticia?.createdAt ? new Date(noticia.createdAt).toISOString() : new Date().toISOString(),
            "dateModified": noticia?.updatedAt ? new Date(noticia.updatedAt).toISOString() : (noticia?.createdAt ? new Date(noticia.createdAt).toISOString() : new Date().toISOString()),
            "author": { "@type": "Person", "name": noticia?.autor || "Autor verificado" },
            "publisher": { "@type": "Organization", "name": "LevántateCuba", "logo": { "@type": "ImageObject", "url": "https://levantatecuba.com/logo.png" } },
            "description": noticia?.contenido ? noticia.contenido.replace(/<[^>]+>/g, "").slice(0, 160) : "",
            "url": `https://levantatecuba.com/noticias/${noticia?._id}`,
            "mainEntityOfPage": { "@type": "WebPage", "@id": `https://levantatecuba.com/noticias/${noticia?._id}` },
            "articleSection": noticia?.categoria || "General",
            "inLanguage": "es-ES"
          })}
        </script>
      </Helmet>

      {/* Barra de progreso de lectura */}
      <div 
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 z-50 transition-all duration-150 ease-out"
        style={{ width: `${readingProgress}%` }}
      />

      <div className="min-h-screen bg-transparent text-white">
        {/* PageHeader con breadcrumb */}
        <PageHeader
          breadcrumb={[
            { label: 'Inicio', href: '/' },
            { label: 'Noticias', href: '/noticias' },
            { label: noticia?.categoria || 'Artículo' }
          ]}
          icon={FileText}
          title={noticia?.categoria || 'Noticia'}
        />

        <main className="max-w-3xl mx-auto px-4 md:px-6 space-y-6">
          {noticia._cover && (
            <div 
              key={noticia._coverHash || noticia._id} 
              className="w-full mb-6 sm:mb-8 aspect-video bg-zinc-900 rounded-lg sm:rounded-xl overflow-hidden"
            >
              {noticia._cover.match(/\.(avif|webp|jpg|jpeg|png)$/i) ? (
                // Cover con extensión explícita
                <img
                  src={buildCoverSrc(noticia._cover, noticia._coverHash)}
                  alt={noticia.titulo}
                  className="w-full h-full rounded-lg sm:rounded-xl border border-zinc-800/60 shadow-lg object-cover"
                  loading="eager"
                  decoding="async"
                  fetchpriority="high"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-500 rounded-lg sm:rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
                  }}
                />
              ) : (
                // Cover sin extensión (formato antiguo) - usar picture
                <picture>
                  <source 
                    type="image/avif" 
                    srcSet={buildCoverSrc(noticia._cover + '.avif', noticia._coverHash)} 
                  />
                  <source 
                    type="image/webp" 
                    srcSet={buildCoverSrc(noticia._cover + '.webp', noticia._coverHash)} 
                  />
                  <img
                    src={buildCoverSrc(noticia._cover + '.jpg', noticia._coverHash)}
                    alt={noticia.titulo}
                    className="w-full h-full rounded-lg sm:rounded-xl border border-zinc-800/60 shadow-lg object-cover"
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      if (e.target.parentElement?.parentElement) {
                        e.target.parentElement.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-500 rounded-lg sm:rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
                      }
                    }}
                  />
                </picture>
              )}
            </div>
          )}

          {/* Header con línea azul lateral */}
          <div className="relative">
            {/* Acento lateral azul */}
            <div className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-sky-500 via-sky-400 to-sky-600" aria-hidden="true" />
            
            <div className="pl-5">
              {/* Badge de categoría */}
              {noticia?.categoria && (
                <div className="mb-3">
                  <span className={`inline-flex items-center rounded-full text-white text-xs font-medium px-3 py-1 ${
                    noticia.categoria === 'Política' ? 'bg-red-600/90' :
                    noticia.categoria === 'Economía' ? 'bg-green-600/90' :
                    noticia.categoria === 'Internacional' ? 'bg-blue-600/90' :
                    noticia.categoria === 'Socio político' ? 'bg-rose-700/90' :
                    noticia.categoria === 'Tecnología' ? 'bg-cyan-600/90' :
                    noticia.categoria === 'Tendencia' ? 'bg-orange-600/90' :
                    'bg-zinc-600/90'
                  }`}>
                    {noticia.categoria}
                  </span>
                </div>
              )}

              {/* Título */}
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-100 leading-tight mb-4">
                {noticia.titulo}
              </h1>

              {/* Meta (fecha + tiempo de lectura) */}
              <div className="flex items-center gap-4 text-sm text-zinc-400 mb-4">
                {(() => {
                  const displayDateISO = noticia?.publishedAt || noticia?.createdAt;
                  return displayDateISO ? (
                    <time dateTime={displayDateISO}>
                      {new Date(displayDateISO).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
                    </time>
                  ) : null;
                })()}
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{Math.max(Math.ceil((noticia?.contenido?.replace(/<[^>]+>/g, '').length || 0) / 200), 1)} min de lectura</span>
                </div>
              </div>

              {/* Chips de etiquetas */}
              {!!noticia?.etiquetas?.length && (
                <div className="flex flex-wrap gap-2">
                  {noticia.etiquetas.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-0.5 text-xs"
                      title={`Etiqueta: ${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bajada/lead debajo del header */}
          {leadText && (
            <div className="border-l-4 border-zinc-700 pl-4 text-zinc-300 italic text-lg md:text-xl leading-relaxed mb-6">
              {leadText}
            </div>
          )}


          <article
            className="prose prose-invert prose-lg max-w-none
              prose-p:text-zinc-200 prose-p:text-base md:prose-p:text-[17px] prose-p:leading-8 prose-p:tracking-[0.005em]
              prose-p:first-of-type:md:first-letter:text-6xl prose-p:first-of-type:md:first-letter:font-bold prose-p:first-of-type:md:first-letter:text-yellow-400 prose-p:first-of-type:md:first-letter:float-left prose-p:first-of-type:md:first-letter:leading-[0.8] prose-p:first-of-type:md:first-letter:mr-2 prose-p:first-of-type:md:first-letter:mt-1
              prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-l-4 prose-h2:border-yellow-400 prose-h2:pl-4
              prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-zinc-100
              prose-strong:text-white prose-strong:font-semibold
              prose-a:text-blue-400 prose-a:underline prose-a:decoration-blue-400/40 hover:prose-a:decoration-blue-400 prose-a:transition-all prose-a:break-words hover:prose-a:text-blue-300
              prose-blockquote:border-l-4 prose-blockquote:border-yellow-400 prose-blockquote:pl-8 prose-blockquote:pr-8 prose-blockquote:py-6 prose-blockquote:italic prose-blockquote:bg-zinc-900/40 prose-blockquote:rounded-r-lg prose-blockquote:my-8 prose-blockquote:text-zinc-300 prose-blockquote:text-lg prose-blockquote:font-light
              prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-2 prose-ol:list-decimal prose-ol:pl-6 prose-ol:space-y-2
              prose-li:text-zinc-200 prose-li:leading-relaxed
              prose-img:rounded-lg prose-img:shadow-lg prose-img:border prose-img:border-zinc-800/60 prose-img:my-8
              prose-figure:my-10
              break-words"
          >
            <div 
              className="space-y-4 leading-relaxed
                [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                [&_li]:my-1
                [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-zinc-100
                [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-100
                [&_h3]:border-l-4 [&_h3]:border-blue-500 [&_h3]:pl-3
                [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-4 [&_blockquote]:italic
                [&_a]:text-blue-400 [&_a]:no-underline hover:[&_a]:underline
                [&_a[target='_blank']]:after:content-['_↗'] [&_a[target='_blank']]:after:text-xs"
              dangerouslySetInnerHTML={{ __html: noticia.contenido }} 
            />
          </article>

          {/* CTA de tienda: Apoya la causa */}
          <ShopCTA variant="compact" />

          {renderCompartir()}
          <div className="my-10 h-px bg-zinc-800/60" />
          
          {renderRelacionadas()}

          {/* Sección de comentarios con el componente reutilizable */}
          <section id="comentarios" className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareText className="w-5 h-5 text-white/90" />
              <h3 className="text-xl font-semibold text-white/90">Comentarios</h3>
            </div>
            
            <CommentThread 
              contextType="news" 
              targetId={id} 
              className="mt-4"
            />
          </section>
        </main>
      </div>
      
      {/* Debug banner solo en desarrollo */}
      <DebugShopCTA />
    </>
  );
}
