// src/pages/Noticias.jsx
import { Link } from "react-router-dom";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { Helmet } from "react-helmet-async";
import DOMPurify from "dompurify";
import { normalizeNewsArray, buildCoverSrc } from "../utils/imageUtils";
import {
  FaFacebook,
  FaTelegram,
  FaTwitter,
  FaWhatsapp,
} from "react-icons/fa";
import {
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineArchive,
} from "react-icons/hi";
import { Newspaper, ChevronRight, ArrowLeft } from "lucide-react";
import BackLink from "../components/BackLink";
import Carousel from "../components/Carousel";

export default function Noticias() {
  const [noticias, setNoticias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [visibleCount, setVisibleCount] = useState(9);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const sentinelRef = useRef(null);

  // Evita parpadeos: asegura scroll al top antes del primer paint
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, []);

  // Detectar si estamos en móvil
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const updateIsMobile = () => setIsMobile(mq.matches);
    updateIsMobile();
    mq.addEventListener("change", updateIsMobile);
    return () => mq.removeEventListener("change", updateIsMobile);
  }, []);

  const esReciente = (createdAt) => {
    if (!createdAt) return false;
    const ahora = new Date();
    const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    return new Date(createdAt) >= inicioDelDia;
  };

  useEffect(() => {
    const fetchNoticias = async () => {
      try {
        // Traer TODAS las noticias (límite alto para página de listado)
        const res = await fetch("/api/news?limit=1000");
        if (!res.ok) throw new Error("Error al obtener noticias");
        const data = await res.json();
        const lista = normalizeNewsArray(data.noticias || []);

        const limpias = lista
          .filter((n) => n._id && n.titulo && n.contenido)
          .map((n) => {
            const _titulo = DOMPurify.sanitize(n.titulo);
            const _contenidoHTML = DOMPurify.sanitize(n.contenido, {
              ALLOWED_TAGS: [
                "b",
                "i",
                "em",
                "strong",
                "p",
                "h1",
                "h2",
                "h3",
                "ul",
                "ol",
                "li",
                "a",
                "blockquote",
                "br",
              ],
              ALLOWED_ATTR: ["href", "target", "rel"],
            });

            // Texto plano para que line-clamp funcione de forma estable
            let _extractoPlanoFuente = _contenidoHTML
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            // Eliminar "Contexto del hecho" y fechas del inicio del extracto
            _extractoPlanoFuente = _extractoPlanoFuente
              .replace(/^Contexto del hecho\s*/i, "")
              .replace(/^(El\s+)?\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}[,.\s]*/gi, "")
              .trim();

            const _extractoPlano =
              _extractoPlanoFuente.length > 120
                ? _extractoPlanoFuente.slice(0, 117) + "…"
                : _extractoPlanoFuente;

            return {
              ...n,
              titulo: _titulo,
              contenido: _contenidoHTML, // HTML completo para la vista de detalle
              extractoPlano: _extractoPlano, // usado en la tarjeta
              imagen: DOMPurify.sanitize(n.imagen || ""),
              autor: DOMPurify.sanitize(n.autor || "Autor verificado"),
              categoria: DOMPurify.sanitize(n.categoria || "General"),
              destacada: n.destacada === true || n.destacada === "true",
              fecha: new Date(n.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              createdAt: n.createdAt,
            };
          });

        setNoticias(limpias);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNoticias();
  }, []);

  // Scroll infinito activado SOLO en móvil
  useEffect(() => {
    if (!isMobile) return; // Solo ejecutar en móvil

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 6);
        }
      },
      { threshold: 1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile]);

  const categorias = [
    "Todas",
    "General",
    "Política",
    "Economía",
    "Internacional",
    "Socio político",
    "Tecnología",
    "Tendencia",
    "Deporte",
  ];

  const filtrarNoticias = noticias.filter((n) => {
    const categoriaNoticia = n.categoria?.toLowerCase() || "";
    const categoriaFiltro = categoriaSeleccionada.toLowerCase();
    const titulo = n.titulo.toLowerCase();
    const contenido = n.contenido.toLowerCase();
    const matchCategoria =
      categoriaSeleccionada === "Todas" || categoriaNoticia === categoriaFiltro;
    const matchBusqueda =
      titulo.includes(busqueda.toLowerCase()) ||
      contenido.includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  // Paso 1: Ordenar las noticias filtradas
  const noticiasOrdenadas = filtrarNoticias
    .sort((a, b) => {
      if (isMobile) {
        // MÓVIL: Solo por fecha (más recientes primero)
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      // DESKTOP: Destacadas primero, luego por fecha
      const byFeatured = (b.destacada === true) - (a.destacada === true);
      if (byFeatured !== 0) return byFeatured;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Paso 2: Aplicar slice SOLO en móvil para scroll infinito
  const mostrarNoticias = isMobile
    ? noticiasOrdenadas.slice(0, visibleCount)
    : noticiasOrdenadas;

  const agruparNoticiasPorFecha = (arr) => {
    const ahora = new Date();
    // Inicio del día actual (medianoche 00:00:00)
    const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    // Inicio de la semana (7 días atrás a medianoche)
    const inicioSemana = new Date(inicioDelDia);
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    // Inicio del mes (30 días atrás a medianoche)
    const inicioMes = new Date(inicioDelDia);
    inicioMes.setDate(inicioMes.getDate() - 30);
    
    const out = { Hoy: [], "Esta semana": [], "Este mes": [], Anteriores: [] };
    arr.forEach((n) => {
      const f = new Date(n.createdAt);
      if (f >= inicioDelDia) out["Hoy"].push(n);
      else if (f >= inicioSemana) out["Esta semana"].push(n);
      else if (f >= inicioMes) out["Este mes"].push(n);
      else out["Anteriores"].push(n);
    });
    return out;
  };

  const noticiasAgrupadas = agruparNoticiasPorFecha(mostrarNoticias);

  // Renderiza una tarjeta de noticia (reutilizable para carrusel y grilla)
  const renderNewsCard = (n) => (
    <div className="news-card w-full max-w-full bg-zinc-800/80 hover:bg-zinc-700/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-1 hover:scale-[1.00] hover:z-10 transition-all duration-200 touch-action-manipulation will-change-transform origin-center relative z-0">
      <div className="flex flex-col h-full">
        {/* Zona clicable: NO estira (evita huecos) */}
        <Link to={`/noticias/${n.slug || n._id}`} draggable={false} className="flex flex-col flex-none">
          {/* Imagen: altura fija derivada de la tarjeta */}
          <div 
            key={n._coverHash || n._id} 
            className="news-card__media relative overflow-hidden aspect-video bg-zinc-900 rounded-t-2xl"
          >
            {n._cover ? (
              n._cover.match(/\.(avif|webp|jpg|jpeg|png)$/i) ? (
                // Cover con extensión explícita
                <img
                  src={buildCoverSrc(n._cover, n._coverHash)}
                  alt={n.titulo}
                  draggable={false}
                  className="block w-full aspect-[16/9] object-cover sm:aspect-auto sm:h-full"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-400 text-xs">Imagen no disponible</div>';
                  }}
                />
              ) : (
                // Cover sin extensión (formato antiguo) - usar picture
                <picture>
                  <source 
                    type="image/avif" 
                    srcSet={buildCoverSrc(n._cover + '.avif', n._coverHash)} 
                  />
                  <source 
                    type="image/webp" 
                    srcSet={buildCoverSrc(n._cover + '.webp', n._coverHash)} 
                  />
                  <img
                    src={buildCoverSrc(n._cover + '.jpg', n._coverHash)}
                    alt={n.titulo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      if (e.target.parentElement?.parentElement) {
                        e.target.parentElement.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-400 text-xs">Imagen no disponible</div>';
                      }
                    }}
                  />
                </picture>
              )
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-400 text-xs">
                Sin imagen
              </div>
            )}
          </div>

          {/* Contenido compacto */}
          <div className="news-card__body p-4 md:p-5 relative flex flex-col">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 min-h-[22px] md:min-h-[24px] mb-1">
              {n.categoria && (
                <span
                  className={`text-white text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-medium shadow-sm ${
                    n.categoria === "Socio político"
                      ? "bg-red-600"
                      : n.categoria === "Tecnología"
                      ? "bg-cyan-500"
                      : n.categoria === "Tendencia"
                      ? "bg-orange-500"
                      : n.categoria === "Deporte"
                      ? "bg-green-600"
                      : "bg-red-600"
                  }`}
                >
                  {n.categoria}
                </span>
              )}
              {n.destacada && (
                <span className="bg-yellow-400 text-black text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-bold shadow-sm">
                  🌟 Destacada
                </span>
              )}
              {esReciente(n.createdAt) && (
                <span className="bg-blue-600 text-white text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-bold shadow-sm">
                  New
                </span>
              )}
            </div>

            {/* Título */}
            <h2 className="text-base md:text-lg font-bold mt-0.5 leading-snug text-white transition-colors duration-200">
              {n.titulo}
            </h2>
            {/* Mini resumen - altura fija 2 líneas */}
            <p className="excerpt mt-2 text-sm text-zinc-400 leading-snug">
              {n.extractoPlano}
            </p>
          </div>
        </Link>

        {/* Pie: meta + redes (fuera del Link) */}
        <div className="news-card__footer px-4 md:px-5 pb-4 md:pb-5 flex-shrink-0 md:border-t md:border-zinc-700/30">
          <div className="pt-1 sm:pt-1 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            {/* Meta */}
            <div>
              {/* Móvil */}
              <div className="block md:hidden text-[11px] text-zinc-400">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="whitespace-nowrap">
                    {n.fecha.split(" a las ")[0]}
                  </span>
                  {n.fecha.includes(" a las ") && (
                    <span className="whitespace-nowrap">
                      • {n.fecha.split(" a las ")[1]}
                    </span>
                  )}
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden md:block text-xs text-zinc-400">
                {n.fecha}
              </div>
            </div>

            {/* Redes */}
            {renderCompartir(n.slug || n._id, n.titulo)}
          </div>
        </div>
      </div>
    </div>
  );

  const getIconForGroup = (g) => {
    switch (g) {
      case "Hoy":
        return <HiOutlineClock className="text-white/70" size="1.5rem" />;
      case "Esta semana":
        return <HiOutlineCalendar className="text-white/70" size="1.5rem" />;
      case "Este mes":
        return <HiOutlineClock className="text-white/70" size="1.5rem" />;
      case "Anteriores":
        return <HiOutlineArchive className="text-white/70" size="1.5rem" />;
      default:
        return null;
    }
  };

  // Íconos de compartir (sin título “Compartir”)
  const renderCompartir = (slugOrId, titulo) => {
    const url = encodeURIComponent(`${window.location.origin}/noticias/${slugOrId}`);
    const text = encodeURIComponent(titulo);
    return (
      <div className="flex gap-4 text-white text-xl">
        <a href={`https://wa.me/?text=${url}`} target="_blank" rel="noreferrer" className="hover:text-green-400">
          <FaWhatsapp />
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noreferrer" className="hover:text-blue-500">
          <FaFacebook />
        </a>
        <a href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`} target="_blank" rel="noreferrer" className="hover:text-sky-400">
          <FaTwitter />
        </a>
        <a href={`https://t.me/share/url?url=${url}&text=${text}`} target="_blank" rel="noreferrer" className="hover:text-blue-300">
          <FaTelegram />
        </a>
      </div>
    );
  };

  const SkeletonCard = () => (
    <div
      className="animate-pulse bg-zinc-800/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/40 w-full p-4 flex flex-col justify-between"
      style={{ height: "var(--card-h)" }}
    >
      <div className="bg-zinc-700/60 h-[45%] rounded-t-2xl mb-3" />
      <div className="bg-zinc-700/60 h-4 rounded w-3/4 mb-2" />
      <div className="bg-zinc-700/60 h-3 rounded w-2/3" />
    </div>
  );

  // Generar JSON-LD para SEO (primeros 10 artículos de "Hoy")
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Noticias de LevántateCuba",
    "description": "Noticias de LevántateCuba: actualidad en Cuba, política internacional, economía, sociedad, tecnología, deporte y reportajes independientes con análisis sin censura.",
    "url": "https://levantatecuba.com/noticias",
    "hasPart": {
      "@type": "ItemList",
      "itemListElement": noticiasAgrupadas?.["Hoy"]?.slice(0, 10).map((n, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": `https://levantatecuba.com/noticias/${n.slug || n._id}`,
        "name": n.titulo,
        ...(n._cover && { "image": n._cover.startsWith('http') ? n._cover : `https://levantatecuba.com${n._cover}` }),
        ...(n.createdAt && { "datePublished": new Date(n.createdAt).toISOString() })
      })) || []
    }
  };

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Noticias de LevántateCuba — Actualidad, política, economía, tecnología y más</title>
        <meta name="description" content="Noticias de LevántateCuba: actualidad en Cuba, política internacional, economía, sociedad, tecnología, deporte y reportajes independientes con análisis sin censura." />
        <link rel="canonical" href="https://levantatecuba.com/noticias" />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <meta property="og:title" content="Noticias de LevántateCuba — Actualidad, política, economía, tecnología y más" />
        <meta property="og:description" content="Noticias de LevántateCuba: actualidad en Cuba, política internacional, economía, sociedad, tecnología, deporte y reportajes independientes con análisis sin censura." />
        <meta property="og:url" content="https://levantatecuba.com/noticias" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://levantatecuba.com/img/og-default.jpg" />
        <script type="application/ld+json">
          {JSON.stringify(jsonLdData)}
        </script>
      </Helmet>

      <style>{`
/* ===== Altura fija + proporción de imagen (más espacio para títulos) ===== */
:root { --card-h: 480px; --img-ratio: 0.42; }                  /* móvil / base */
@media (min-width: 1024px)  { :root { --card-h: 500px; --img-ratio: 0.40; } }
@media (min-width: 1280px)  { :root { --card-h: 520px; --img-ratio: 0.38; } }
@media (min-width: 1536px)  { :root { --card-h: 540px; --img-ratio: 0.36; } }

  /* Flechas del carrusel nativo - fuera del viewport, área táctil segura */
  .custom-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
    min-width: 40px;
    min-height: 40px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 20;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .custom-arrow:hover { 
    color: #ff4444; 
    background: rgba(0, 0, 0, 0.85);
    border-color: rgba(255, 68, 68, 0.4);
    transform: translateY(-50%) scale(1.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
  .custom-arrow:focus-visible {
    outline: 2px solid #ff4444;
    outline-offset: 3px;
  }
  .left-arrow { left: -8px; }
  .right-arrow { right: -8px; }

  /* Desktop ≥1024px: offsets ±16px (flechas compactas) */
  @media (min-width: 1024px) {
    .left-arrow { left: -16px; }
    .right-arrow { right: -16px; }
  }

  /* Ocultar scrollbar en scroller móvil */
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Evitar arrastre/selección en carrusel móvil (iOS Safari fix) */
  .carousel-touch-safe,
  .carousel-touch-safe * {
    -webkit-user-drag: none;
    user-drag: none;
    -webkit-touch-callout: none;
    user-select: none;
  }

  /* Ocultar scrollbar nativo pero mantener funcionalidad */
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* === Tarjeta: altura FIJA uniforme === */
  .news-card { display:flex; flex-direction:column; height:var(--card-h); overflow:hidden; }
  .news-card__media { width:100%; height: calc(var(--card-h) * var(--img-ratio)); overflow:hidden; flex-shrink:0; }
  .news-card__media img { width:100%; height:100%; object-fit:cover; }
  .news-card__body { flex: 1 1 auto; overflow:hidden; display:flex; flex-direction:column; }
  .news-card__footer { margin-top:auto; flex-shrink:0; } /* pie SIEMPRE fijo al fondo */

  /* Título: altura fija máximo 4 líneas */
  .news-card h2{ display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; word-wrap:break-word; flex:1 1 auto; max-height:5.5em; }
  /* Extracto: altura fija 3 líneas */
  .news-card .excerpt{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; min-height:3.9em; max-height:3.9em; flex-shrink:0; margin-top:auto; }

  /* Ajustes mobile */
  @media (max-width: 767px) {
    * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
    .touch-action-manipulation { touch-action: manipulation !important; }
    .custom-arrow { background: rgba(0, 0, 0, 0.85); }
    .left-arrow { left: 8px; }
    .right-arrow { right: 8px; }
  }
`}</style>

      <div className="min-h-screen bg-transparent text-white">
        {/* Header moderno */}
        <header className="max-w-6xl mx-auto px-4 md:px-6 pt-[calc(var(--nav-h,64px)+12px)] mb-4 md:mb-6">
          {/* Botón Volver (solo móvil) */}
          <div className="flex sm:hidden items-center justify-between mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Volver al inicio
            </Link>
          </div>

          {/* Breadcrumb simple (solo desktop) */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <Link to="/" className="hover:text-zinc-300 transition-colors">Inicio</Link>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
            <span className="text-zinc-300">Noticias</span>
          </nav>

          {/* Title row */}
          <div className="flex items-center gap-3">
            {/* Ícono moderno */}
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <Newspaper className="w-5 h-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
            </span>

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
              Noticias <span className="text-zinc-400">de LevántateCuba</span>
            </h1>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 md:px-6">

          {/* Banner de apoyo a la causa */}
          <div className="mb-8 rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white font-semibold mb-1">
                  ❤️ Apoya la causa
                </p>
                <p className="text-zinc-400 text-sm">
                  Visita nuestra tienda y ayuda a sostener esta plataforma independiente.
                </p>
              </div>
              <Link
                to="/tienda"
                className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-red-600/20 whitespace-nowrap"
              >
                Ver productos
              </Link>
            </div>
          </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {categorias.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-1 rounded-full text-sm border transition ${
                categoriaSeleccionada === cat
                  ? "bg-red-600 border-red-600 text-white"
                  : "border-white/30 text-white/80 hover:bg-white/10"
              }`}
              onClick={() => {
                setCategoriaSeleccionada(cat);
                setVisibleCount(9);
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex justify-center mb-8">
          <input
            type="text"
            placeholder="Buscar noticias..."
            className="px-4 py-2 w-full max-w-md rounded-lg bg-white/10 text-white border border-white/20"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibleCount(9);
            }}
          />
        </div>

        {/* Noticias */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : isMobile ? (
          /* MÓVIL: Lista plana continua (sin agrupación) para scroll infinito sin repeticiones */
          <div className="flex flex-col gap-6 px-2 pb-8">
            {mostrarNoticias.map((item) => (
              <div key={item._id || item.id}>
                {renderNewsCard(item)}
              </div>
            ))}
            
            {/* Indicador de carga al final */}
            {visibleCount < noticiasOrdenadas.length && (
              <div className="flex justify-center items-center py-4 gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-red-500 rounded-full animate-spin" />
                <span className="text-white/70 text-sm">Cargando más...</span>
              </div>
            )}
          </div>
        ) : (
          /* DESKTOP/TABLET: Vista agrupada por fecha con carruseles */
          Object.entries(noticiasAgrupadas).map(([grupo, arr]) => {
            if (arr.length === 0) return null;
            
            return (
              <div key={grupo} className="mb-10">
                <h2 className="text-xl font-bold mb-6 text-white/90 flex items-center gap-3">
                  {getIconForGroup(grupo)}
                  {grupo}
                </h2>

                <Carousel
                  items={arr}
                  label={`Carrusel de ${grupo}`}
                  renderItem={renderNewsCard}
                />
              </div>
            );
          })
        )}

        {/* Sin resultados */}
        {filtrarNoticias.length === 0 && !loading && (
          <p className="text-center text-gray-400 mt-10">
            No se encontraron noticias con esos criterios.
          </p>
        )}

        {/* Sentinel para scroll infinito (solo visible en móvil) */}
        {isMobile && <div ref={sentinelRef} className="h-10" />}
        </div>
      </div>
    </>
  );
}
