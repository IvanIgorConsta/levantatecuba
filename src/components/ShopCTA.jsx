// src/components/ShopCTA.jsx
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, ArrowRight } from "lucide-react";
import PropTypes from "prop-types";

export default function ShopCTA({ variant = "default" }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    
    // Debug log para verificar que se monta
    const isMobile = window.innerWidth < 768;
    console.debug('[ShopCTA] Component mounted', { 
      variant, 
      isMobile, 
      windowWidth: window.innerWidth 
    });
    
    (async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE || 
                       window.__APP_CONFIG__?.SHOPIFY_API_BASE?.replace('/api/shopify', '') || 
                       'http://localhost:5000';
        
        const url = `${apiBase}/api/shopify/products`;
        
        console.debug('[ShopCTA] Fetching products from:', url);
        
        const res = await fetch(url, { 
          credentials: "include" 
        });
        
        console.debug('[ShopCTA] Fetch response:', res.status, res.statusText);
        
        if (!res.ok) {
          console.warn('[ShopCTA] Fetch failed:', res.status);
          return;
        }
        
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        
        console.debug('[ShopCTA] Products received:', list.length);
        
        if (!list.length) {
          console.warn('[ShopCTA] No products available');
          return;
        }

        // Buscar producto preferido o tomar el primero
        const preferred = list.find(p => p.handle === "camiseta-de-manga-corta-unisex") || list[0];
        
        if (alive) {
          setProduct(preferred);
          console.debug('[ShopCTA] ✅ Product set:', preferred?.title);
        }
      } catch (error) { 
        console.error('[ShopCTA] ❌ Error loading product:', error);
      } finally {
        if (alive) {
          setLoading(false);
          console.debug('[ShopCTA] Loading finished');
        }
      }
    })();
    return () => { alive = false; };
  }, [variant]);

  // Debug: mostrar estado de carga
  useEffect(() => {
    console.debug('[ShopCTA] State changed:', { 
      loading, 
      hasProduct: !!product,
      productTitle: product?.title 
    });
  }, [loading, product]);

  // ===== Imagen: normalización y selección de miniatura (hooks SIEMPRE antes de returns) =====
  function normalizeUrl(u) {
    if (!u) return "";
    const trimmed = String(u).trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("//")) return "https:" + trimmed;
    if (trimmed.startsWith("http://")) return trimmed.replace(/^http:\/\//i, "https://");
    return trimmed;
  }

  function pickProductThumb(p) {
    const candidates = [
      p?.featuredImage?.url,
      p?.imageUrl,
      p?.image,
      p?.images?.[0]?.url,
      p?.variants?.[0]?.image?.url,
      (p?.variants || []).find(v => v?.image?.url)?.image?.url,
    ].filter(Boolean);
    for (const c of candidates) {
      const n = normalizeUrl(c);
      if (n) return n;
    }
    return "";
  }

  const thumbInitial = useMemo(() => pickProductThumb(product), [product]);
  const [thumbSrc, setThumbSrc] = useState(thumbInitial);
  useEffect(() => { setThumbSrc(thumbInitial); }, [thumbInitial]);
  const handleThumbError = () => { setThumbSrc("/img/og-default.jpg"); };

  // Mostrar placeholder mientras carga (solo en compact para no afectar otras variantes)
  if (loading && variant === "compact") {
    return (
      <section className="mt-10 mb-8 rounded-xl border border-white/10 bg-white/5 p-4 md:p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-32 mb-2"></div>
        <div className="h-3 bg-white/5 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-[100px,1fr] gap-3">
          <div className="aspect-[4/3] bg-white/10 rounded-lg"></div>
          <div className="flex flex-col gap-2">
            <div className="h-4 bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-white/5 rounded w-20"></div>
          </div>
        </div>
      </section>
    );
  }

  // Fallback: si no hay producto, mostrar CTA genérico SIEMPRE visible (móvil y desktop)
  if (!product) {
    console.warn('[ShopCTA] ⚠️ No product available after loading');
    if (variant === "compact") {
      return (
        <section 
          aria-label="Apoya la causa" 
          className="mt-10 mb-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 md:p-5 w-full"
        >
          <div className="mb-4">
            <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-red-500">❤️</span>
              Apoya la causa
            </h3>
            <p className="text-xs md:text-sm text-white/60 mt-1">
              Tu compra nos ayuda a sostener la plataforma.
            </p>
          </div>
          <div className="grid grid-cols-[100px,1fr] sm:grid-cols-[120px,1fr] md:grid-cols-[140px,1fr] gap-3 md:gap-4">
            <div className="aspect-[4/3] w-full rounded-lg bg-white/10 border border-white/10 grid place-content-center">
              <ShoppingBag size={20} className="text-white/50" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm md:text-base font-semibold text-white mb-1 line-clamp-2">
                Descubre nuestros productos solidarios
              </p>
              <p className="text-xs md:text-sm text-white/60 mb-3">
                Visita la tienda para ver todos los artículos.
              </p>
              <div className="mt-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <Link 
                  to="/tienda" 
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm text-white font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Ver todos
                </Link>
              </div>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  // (hooks de imagen declarados arriba)

  const min = product?.priceRange?.minVariantPrice?.amount || product?.price || product?.priceMin;
  const currency = product?.priceRange?.minVariantPrice?.currencyCode || product?.currencyCode || "USD";
  const handle = product?.handle || "";

  // Renderizar versión compacta - VISIBLE EN TODOS LOS BREAKPOINTS
  if (variant === "compact") {
    return (
      <section 
        aria-label="Apoya la causa" 
        className="mt-10 mb-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 md:p-5 w-full"
      >
        {/* Header compacto */}
        <div className="mb-4">
          <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-red-500">❤️</span>
            Apoya la causa
          </h3>
          <p className="text-xs md:text-sm text-white/60 mt-1">
            Tu compra nos ayuda a sostener la plataforma.
          </p>
        </div>

        {/* Grid compacto - Responsive en todos los tamaños */}
        <div className="grid grid-cols-[100px,1fr] sm:grid-cols-[120px,1fr] md:grid-cols-[140px,1fr] gap-3 md:gap-4">
          {/* Miniatura - Siempre visible */}
          <Link to={`/tienda/${handle}`} className="block group flex-shrink-0">
            <div className="aspect-[4/3] w-full rounded-lg bg-white/10 border border-white/10 group-hover:border-red-500/50 transition-all duration-300 overflow-hidden">
              <img
                src={thumbSrc || "/img/og-default.jpg"}
                alt={product.title || "Producto solidario"}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={handleThumbError}
              />
            </div>
          </Link>

          {/* Info del producto - Siempre visible */}
          <div className="flex flex-col min-w-0">
            <Link 
              to={`/tienda/${handle}`} 
              className="text-sm md:text-base font-semibold text-white hover:text-red-500 hover:underline line-clamp-2 transition-colors mb-1"
            >
              {product.title}
            </Link>
            
            {/* Precio */}
            <div className="text-sm md:text-base text-white/90 font-medium mb-3">
              {min ? (
                <>
                  <span className="text-red-500 font-bold">${Number(min).toFixed(2)}</span>
                  <span className="text-white/50 text-xs ml-1">{currency}</span>
                </>
              ) : (
                <span className="text-white/50 text-xs">Precio no disponible</span>
              )}
            </div>

            {/* Botones - Stack en móvil, inline en desktop */}
            <div className="mt-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Link 
                to={`/tienda/${handle}`} 
                className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm text-white font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Ver producto
              </Link>
              <Link 
                to="/tienda" 
                className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm text-white/90 hover:text-white font-medium transition-all duration-200"
              >
                Ver todos
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const onQuickAdd = () => {
    try {
      // Emitir evento personalizado para sistemas de carrito que escuchen
      const ev = new CustomEvent("cart:add", {
        detail: { 
          productHandle: handle, 
          quantity: 1,
          product: product 
        },
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(ev);
    } catch { 
      /* no-op si no hay listener */ 
    }
  };

  // Detectar si podemos hacer quick add (opcional)
  const canQuickAdd = typeof window !== "undefined" && false; // Desactivado por defecto

  return (
    <section
      aria-label="Apoya la causa comprando merchandising"
      className="mt-12 mb-10 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm p-6 md:p-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-red-500">❤️</span>
            Apoya la causa
          </h3>
          <p className="text-zinc-400 text-sm md:text-base">
            Tu compra nos ayuda a sostener la plataforma y continuar luchando por la libertad.
          </p>
        </div>
      </div>

      {/* Producto destacado */}
      <div className="grid grid-cols-1 sm:grid-cols-[180px,1fr] gap-6">
        {/* Imagen del producto */}
        <Link to={`/tienda/${handle}`} className="block group">
          <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-zinc-800 border border-zinc-700 group-hover:border-red-500/50 transition-all duration-300">
            <img
              src={thumbSrc || "/img/og-default.jpg"}
              alt={product.title || "Producto solidario"}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="eager"
              fetchpriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={handleThumbError}
            />
          </div>
        </Link>

        {/* Información del producto */}
        <div className="flex flex-col">
          <Link 
            to={`/tienda/${handle}`} 
            className="text-xl font-bold text-white hover:text-red-500 transition-colors mb-2"
          >
            {product.title}
          </Link>
          
          {/* Precio */}
          <div className="text-white mb-4">
            {min ? (
              <>
                <span className="text-3xl font-bold text-red-500">
                  ${Number(min).toFixed(2)}
                </span>
                <span className="text-zinc-400 text-sm ml-2">{currency}</span>
              </>
            ) : (
              <span className="text-zinc-400">Precio no disponible</span>
            )}
          </div>

          {/* Descripción breve */}
          {product.description && (
            <p className="text-zinc-400 text-sm mb-6 line-clamp-2">
              {product.description}
            </p>
          )}

          {/* Botones de acción */}
          <div className="mt-auto flex flex-wrap gap-3">
            {/* Botón principal - Ver producto */}
            <Link
              to={`/tienda/${handle}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-6 py-3 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-red-600/20"
            >
              Ver producto
              <ArrowRight size={18} />
            </Link>

            {/* Botón secundario - Ver todos */}
            <Link
              to="/tienda"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 px-6 py-3 text-zinc-200 font-medium transition-all duration-200"
            >
              <ShoppingBag size={18} />
              Ver todos los productos
            </Link>

            {/* Botón opcional de agregar rápido (desactivado por defecto) */}
            {canQuickAdd && (
              <button
                type="button"
                onClick={onQuickAdd}
                className="inline-flex items-center justify-center rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 px-6 py-3 text-zinc-300 font-medium transition-all duration-200"
              >
                Agregar rápido
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje adicional */}
      <div className="mt-6 pt-6 border-t border-zinc-800">
        <p className="text-zinc-500 text-xs text-center">
          🛡️ Compra segura • Envío a todo el mundo • Productos de calidad garantizada
        </p>
      </div>
    </section>
  );
}

ShopCTA.propTypes = {
  variant: PropTypes.oneOf(["default", "compact"]),
};
