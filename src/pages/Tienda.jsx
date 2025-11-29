// src/pages/Tienda.jsx
import { useEffect, useState } from 'react';
import { ShoppingBag, Loader2, ExternalLink, Filter, ChevronRight, ArrowLeft, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listShopifyProducts } from '../lib/shopifyClient';
import { RUNTIME_CONFIG, isExternalStore } from '../lib/runtimeConfig';

export default function Tienda() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState(['Todos']);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isLoading, setIsLoading] = useState(true);

  // Cargar productos
  useEffect(() => {
    // Si STORE_URL apunta a OTRO origin, redirigir; si es el mismo, NO
    if (RUNTIME_CONFIG.STORE_URL && isExternalStore(RUNTIME_CONFIG.STORE_URL)) {
      console.log('[Tienda] Redirigiendo a tienda externa:', RUNTIME_CONFIG.STORE_URL);
      const timer = setTimeout(() => {
        window.location.href = RUNTIME_CONFIG.STORE_URL;
      }, 500);
      return () => clearTimeout(timer);
    }

    // Cargar productos desde Shopify
    (async () => {
      try {
        console.log('[Tienda FE] Iniciando carga de productos desde Shopify...');
        console.log('[Tienda FE] STORE_MODE:', RUNTIME_CONFIG.STORE_MODE);
        console.log('[Tienda FE] USE_SHOPIFY:', RUNTIME_CONFIG.USE_SHOPIFY);
        console.log('[Tienda FE] SHOPIFY_API_BASE:', RUNTIME_CONFIG.SHOPIFY_API_BASE);
        
        setIsLoading(true);
        
        const items = await listShopifyProducts(); // intenta siempre
        const arr = Array.isArray(items) ? items : [];
        
        console.log('[Tienda FE] Productos recibidos:', arr.length);
        if (arr.length > 0) {
          console.log('[Tienda FE] Primer producto:', {
            title: arr[0].title,
            price: arr[0].priceMin,
            currency: arr[0].currencyCode,
            imageUrl: arr[0].imageUrl,
            variants: arr[0].variants?.length || 0
          });
        } else {
          console.warn('[Tienda FE] ⚠️ No se recibieron productos - verifica:');
          console.warn('1. Que el backend esté corriendo en', RUNTIME_CONFIG.SHOPIFY_API_BASE);
          console.warn('2. Que las credenciales de Shopify en .env sean correctas');
          console.warn('3. Que haya productos activos en el canal Headless de Shopify');
        }
        
        setProducts(arr);
        setFilteredProducts(arr);
        
        // Construir categorías laxas
        const cats = ['Todos', ...new Set(arr.map(p => p.category).filter(Boolean))];
        setCategories(cats);
        
        console.info('[Tienda FE] ✅ Carga completada:', arr.length, 'productos');
      } catch (e) {
        console.error('[Tienda FE] ❌ Error cargando productos:', e?.message || e);
        console.error('[Tienda FE] Stack:', e?.stack);
        setProducts([]);
        setFilteredProducts([]);
        setCategories(['Todos']);
        toast.error('Error al cargar productos. Verifica la consola para más detalles.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Filtrar productos por categoría
  useEffect(() => {
    const visible = products.filter(p => 
      selectedCategory === 'Todos' ? true : (p.category || '').toLowerCase() === selectedCategory.toLowerCase()
    );
    setFilteredProducts(visible);
  }, [selectedCategory, products]);

  // Pantalla de redirección solo si URL es realmente externa
  if (RUNTIME_CONFIG.STORE_URL && isExternalStore(RUNTIME_CONFIG.STORE_URL)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
            <div className="relative bg-zinc-900 rounded-full p-6 inline-block border border-zinc-800">
              <ShoppingBag size={48} className="text-red-500" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            Redirigiendo a la tienda...
          </h1>
          
          <p className="text-zinc-400 mb-8">
            Estás siendo redirigido a nuestra tienda oficial.
            Si no eres redirigido automáticamente,{' '}
            <a 
              href={RUNTIME_CONFIG.STORE_URL}
              className="text-red-500 hover:text-red-400 underline inline-flex items-center gap-1"
            >
              haz clic aquí
              <ExternalLink size={14} />
            </a>
          </p>

          <div className="flex justify-center">
            <Loader2 className="animate-spin text-red-500" size={32} />
          </div>

          <div className="mt-8 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500">Redirigiendo a:</p>
            <p className="text-sm text-zinc-300 font-mono break-all">{RUNTIME_CONFIG.STORE_URL}</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar tienda con productos (o estado vacío)
  return (
    <div className="min-h-screen bg-transparent text-white">
      {/* Header moderno - mismo diseño que Noticias */}
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
          <span className="text-zinc-300">Tienda</span>
        </nav>

        {/* Title row */}
        <div className="flex items-center gap-3">
          {/* Ícono moderno */}
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
            <ShoppingBag className="w-5 h-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
          </span>

          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
            Tienda <span className="text-zinc-400">Oficial</span>
          </h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Banner de apoyo */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-white font-semibold mb-1">
                🛒 Apoya la causa
              </p>
              <p className="text-zinc-400 text-sm">
                Cada compra ayuda a sostener esta plataforma independiente.
              </p>
            </div>
            <Link
              to="/noticias"
              className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-red-600/20 whitespace-nowrap"
            >
              <Newspaper className="w-4 h-4 mr-2" />
              Ver noticias
            </Link>
          </div>
        </div>

        {/* Filtros de categoría */}
        {products.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-zinc-400" size={20} />
              <span className="text-zinc-400 text-sm">Filtrar por categoría:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-red-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {cat} ({cat === 'Todos' ? products.length : products.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase()).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid de productos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-red-500" size={48} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-3xl"></div>
              <ShoppingBag className="relative mx-auto text-zinc-600 mb-4" size={64} />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              🛍️ No hay productos disponibles aún
            </h2>
            <p className="text-zinc-400 text-lg max-w-md mx-auto">
              Estamos actualizando nuestro catálogo. Muy pronto tendremos productos exclusivos para ti.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="group relative">
                {/* Tarjeta del producto con link al detalle */}
                <Link 
                  to={`/tienda/${product.handle}`}
                  className="absolute inset-0 z-10"
                  aria-label={`Ver detalles de ${product.title}`}
                />
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-red-500/50 transition-all duration-300">
                  {/* Imagen */}
                  <div className="relative aspect-square bg-zinc-800 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="text-zinc-700" size={48} />
                      </div>
                    )}
                    {/* Badge de precio */}
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full">
                      <span className="text-lg font-bold">
                        ${product.priceMin || product.price || '0.00'}
                      </span>
                      <span className="text-xs ml-1 opacity-75">
                        {product.currencyCode || 'USD'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Info del producto */}
                  <div className="p-4 relative">
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                      {product.title}
                    </h3>
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                      {product.description ? product.description.slice(0, 100) + '...' : 'Sin descripción'}
                    </p>
                    
                    {/* Botón Ver Detalles con z-index mayor */}
                    <div className="relative z-20">
                      <Link
                        to={`/tienda/${product.handle}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver detalles
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}