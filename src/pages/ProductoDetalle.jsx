// src/pages/ProductoDetalle.jsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
  ShoppingCart, 
  ArrowLeft, 
  Loader2, 
  Check, 
  Plus, 
  Minus,
  Package,
  Truck,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import { getProductByHandle } from '../lib/shopifyClient';

export default function ProductoDetalle() {
  const { handle } = useParams();
  const location = useLocation();
  const { addItem, open: openCart } = useCart(); // Hook del carrito global
  
  // Intentar usar producto desde state (si viene de la lista), pero siempre refetch
  const productFromState = location.state?.product || null;
  
  const [product, setProduct] = useState(productFromState);
  const [loading, setLoading] = useState(true); // Siempre cargar aunque venga de state
  const [error, setError] = useState(null);
  
  // Estados de selección
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  
  // Estados de UI
  const [selectedImage, setSelectedImage] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Helpers para canonización
  const canon = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replace("colour", "color")
      .replace("talla", "size")
      .replace("tamano", "size")
      .replace("tamaño", "size");

  const vcanon = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const toArrayValues = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) {
      if (v.length === 1 && typeof v[0] === 'string' && v[0].includes(',')) {
        return v[0].split(',').map(x => x.trim()).filter(Boolean);
      }
      return v.map(x => String(x).trim()).filter(Boolean);
    }
    if (typeof v === 'string') {
      return v.split(',').map(x => x.trim()).filter(Boolean);
    }
    return [];
  };

  const getOpt = (selectedOptions, key) => {
    if (!Array.isArray(selectedOptions)) return null;
    const canonKey = canon(key);
    for (const opt of selectedOptions) {
      if (canon(opt?.key || opt?.name || '') === canonKey) {
        return opt?.value || null;
      }
    }
    return null;
  };

  const findOptionByKey = (prod, key) => {
    const canonKey = canon(key);
    return (prod?.options || []).find((o) => canon(o?.key || o?.name || '') === canonKey);
  };

  // Cargar producto (siempre fetch directo por handle - resiliente en móvil/deep-link)
  useEffect(() => {
    let cancelled = false;
    
    const loadProduct = async () => {
      try {
        console.log('[ProductoDetalle] Cargando producto con handle:', handle);
        setLoading(true);
        setError(null);
        
        // Fetch directo por handle (funciona en móvil, deep-link, refresh)
        const fetchedProduct = await getProductByHandle(handle);
        
        if (cancelled) return;
        
        if (fetchedProduct) {
          console.log('[ProductoDetalle] ✅ Producto cargado:', fetchedProduct.title);
          setProduct(fetchedProduct);
          
          // Establecer color y talla iniciales
          const colorOpt = findOptionByKey(fetchedProduct, 'color');
          const sizeOpt = findOptionByKey(fetchedProduct, 'size');
          
          if (colorOpt) {
            const colors = toArrayValues(colorOpt.values);
            setSelectedColor(colors[0] || null);
          }
          
          if (sizeOpt) {
            const sizes = toArrayValues(sizeOpt.values);
            setSelectedSize(sizes[0] || null);
          }
        } else {
          setError('Producto no encontrado');
        }
      } catch (err) {
        if (cancelled) return;
        
        console.error('[ProductoDetalle] ❌ Error:', err);
        
        if (err.message === 'PRODUCT_NOT_FOUND') {
          setError('Producto no encontrado');
        } else {
          setError('Error al cargar el producto. Verifica tu conexión.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProduct();
    
    return () => { 
      cancelled = true; 
    };
  }, [handle]);

  // Construir galería de imágenes (ANTES de useEffect que lo usa)
  const allImages = useMemo(() => {
    if (!product) return [null];
    
    const images = [];
    
    // Imagen principal
    if (product.imageUrl || product.featuredImage?.url) {
      images.push(product.imageUrl || product.featuredImage.url);
    }
    
    // Imágenes de las variantes
    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach(variant => {
        const variantImg = variant.image?.url || variant.imageUrl;
        if (variantImg && !images.includes(variantImg)) {
          images.push(variantImg);
        }
      });
    }
    
    // Imágenes adicionales
    if (product.images?.edges) {
      product.images.edges.forEach(edge => {
        if (edge.node?.url && !images.includes(edge.node.url)) {
          images.push(edge.node.url);
        }
      });
    } else if (product.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        const url = img.url || img.src || img;
        if (url && !images.includes(url)) {
          images.push(url);
        }
      });
    }
    
    return images.length > 0 ? images : [null];
  }, [product]);

  // Calcular variante activa
  const activeVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    
    const match = product.variants.find(v => {
      const c = getOpt(v?.selectedOptions, 'color');
      const s = getOpt(v?.selectedOptions, 'size');
      const okColor = !selectedColor || vcanon(c || '') === vcanon(selectedColor);
      const okSize = !selectedSize || vcanon(s) === vcanon(selectedSize);
      return okColor && okSize;
    });
    
    return match || product.variants[0] || null;
  }, [product, selectedColor, selectedSize]);
  
  // Actualizar imagen cuando cambia la variante activa
  useEffect(() => {
    if (!activeVariant) return;
    
    const variantImageUrl = activeVariant.image?.url || activeVariant.imageUrl;
    
    if (variantImageUrl && allImages.length > 0) {
      const imageIndex = allImages.findIndex(img => img === variantImageUrl);
      if (imageIndex >= 0) {
        setSelectedImage(imageIndex);
      }
    }
  }, [activeVariant, allImages]);

  // Obtener precio
  const priceNumber = useMemo(() => {
    const v = activeVariant?.price?.amount || activeVariant?.price;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (product?.price) return parseFloat(product.price);
    if (product?.priceRange?.minVariantPrice?.amount) {
      return parseFloat(product.priceRange.minVariantPrice.amount);
    }
    return null;
  }, [activeVariant, product]);

  const priceText = priceNumber != null ? Number(priceNumber).toFixed(2) : null;
  const currency = product?.currencyCode || activeVariant?.price?.currencyCode || 'USD';

  // Agregar al carrito
  const handleAddToCart = () => {
    setIsAdding(true);
    
    const item = {
      productId: product.id,
      handle: product.handle,
      title: product.title,
      price: priceNumber,
      currency,
      image: activeVariant?.image?.url || activeVariant?.imageUrl || product.imageUrl || product.featuredImage?.url || '',
      quantity,
      selectedColor,
      selectedSize,
      variant: activeVariant
    };

    // Agregar al carrito global
    addItem(item);
    
    // Toast mejorado con información del producto
    toast.success(
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
          <Check size={24} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">¡Producto agregado!</p>
          <p className="text-sm text-gray-200">{product.title}</p>
          <p className="text-xs text-gray-300">
            {selectedColor && `Color: ${selectedColor}`}
            {selectedColor && selectedSize && ' • '}
            {selectedSize && `Talla: ${selectedSize}`}
          </p>
        </div>
      </div>,
      {
        duration: 3000,
        position: 'bottom-right',
        style: { 
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        },
        icon: null,
      }
    );
    
    setShowSuccess(true);
    
    // Abrir el drawer del carrito después de un breve delay
    setTimeout(() => {
      openCart();
    }, 800);
    
    setTimeout(() => {
      setIsAdding(false);
      setShowSuccess(false);
      setQuantity(1);
    }, 1500);
  };

  // Cambiar cantidad
  const incrementQuantity = () => {
    if (quantity < 10) setQuantity(quantity + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  // [Override] Títulos y descripciones personalizadas por producto
  const PRODUCT_OVERRIDES = {
    'camiseta-de-manga-corta-unisex': {
      title: 'T-Shirt unisex de manga corta',
      descriptionHtml: `
        <p>Esta T-Shirt está diseñada para ofrecer comodidad superior y una apariencia impecable durante todo el día. Su tejido suave y ligero proporciona un ajuste equilibrado, ideal tanto para uso casual como para actividades cotidianas.</p>
        <p><strong>Características técnicas:</strong></p>
        <ul>
          <li>100% algodón peinado e hilado en anillo</li>
          <li>Los tonos Heather incluyen mezcla de poliéster</li>
          <li>Peso del tejido: 142 g/m² (4.2 oz/yd²)</li>
          <li>Tela preencogida para mayor durabilidad</li>
          <li>Costuras laterales y tapeta de hombro a hombro</li>
          <li>Producto base fabricado en Nicaragua, México, Honduras o EE. UU.</li>
        </ul>
        <p><strong>Cumplimiento y garantía:</strong></p>
        <p>Este producto cumple con el Reglamento General de Seguridad de los Productos (GPSR) de la Unión Europea. Para consultas relacionadas con la seguridad del producto, puedes contactar a nuestro representante autorizado en gpsr@sindenventures.com o escribirnos a: Markou Evgenikou 11, Mesa Geitonia, 4002, Limassol, Cyprus.</p>
      `
    }
  };

  // Obtener override si existe para este producto
  const productOverride = PRODUCT_OVERRIDES[handle] || {};
  const displayTitle = productOverride.title || product?.title || 'Producto';
  
  // Sanitizar HTML de descripción (el backend ya formatea)
  const safeDescription = useMemo(() => {
    // Usar descripción override si existe, sino la del producto
    const html = productOverride.descriptionHtml || product?.descriptionHtml || product?.description || '';
    if (!html) return '<p class="text-zinc-400">Este producto no tiene descripción disponible.</p>';
    
    // Sanitizar HTML permitiendo solo tags seguros
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'ul', 'li', 'br', 'strong', 'em', 'b', 'i'],
      ALLOWED_ATTR: ['class']
    });
  }, [product, productOverride.descriptionHtml]);

  // Estados de carga y error
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-red-500 mx-auto mb-4" size={48} />
          <p className="text-zinc-400">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Package className="text-zinc-600 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-semibold text-white mb-2">
            ❌ Producto no encontrado
          </h2>
          <p className="text-zinc-400 mb-6">
            El producto que buscas no está disponible o no existe.
          </p>
          <Link
            to="/tienda"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const colorOpt = findOptionByKey(product, 'color');
  const sizeOpt = findOptionByKey(product, 'size');
  const colors = toArrayValues(colorOpt?.values);
  const sizes = toArrayValues(sizeOpt?.values);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
            Inicio
          </Link>
          <span className="text-zinc-600">/</span>
          <Link to="/tienda" className="text-zinc-400 hover:text-white transition-colors">
            Tienda
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-red-500">{product.title}</span>
        </nav>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Columna izquierda: Imágenes */}
          <div>
            {/* Imagen principal */}
            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 mb-4">
              {allImages[selectedImage] ? (
                <img
                  src={allImages[selectedImage]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingCart className="text-zinc-700" size={64} />
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square bg-zinc-900 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === idx 
                        ? 'border-red-500' 
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={`${product.title} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="text-zinc-700" size={24} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Columna derecha: Información del producto */}
          <div>
            {/* Botón Volver a la Tienda */}
            <div className="mb-6">
              <Link
                to="/tienda"
                className="inline-flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors font-medium text-sm group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Volver a la Tienda
              </Link>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold mb-4">
              {displayTitle}
            </h1>

            {/* Precio */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-bold text-red-500">
                ${priceText || '0.00'}
              </span>
              <span className="text-lg text-zinc-400">{currency}</span>
            </div>

            {/* Descripción */}
            <div 
              className="prose prose-invert max-w-none mb-8 text-zinc-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />

            {/* Selector de Color */}
            {colors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Color: <span className="text-white ml-2">{selectedColor}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        selectedColor === color
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-500/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Talla */}
            {sizes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Talla: <span className="text-white ml-2">{selectedSize}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-lg border-2 transition-all font-medium ${
                        selectedSize === size
                          ? 'bg-white border-white text-black'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-500/50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cantidad */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Cantidad</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-700">
                  <button
                    onClick={decrementQuantity}
                    className="p-3 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="px-6 py-2 text-white font-medium min-w-[80px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={incrementQuantity}
                    className="p-3 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Botón de compra */}
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                showSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {showSuccess ? (
                <>
                  <Check size={24} />
                  <span>¡Agregado al carrito!</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={24} />
                  <span>Agregar al carrito</span>
                </>
              )}
            </button>

            {/* Features */}
            <div className="mt-8 space-y-4 border-t border-zinc-800 pt-8">
              <div className="flex items-center gap-3 text-zinc-400">
                <Truck size={20} />
                <span>Envío a todo el mundo</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Shield size={20} />
                <span>Compra segura</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Package size={20} />
                <span>Producto de calidad garantizada</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de productos relacionados */}
        <div className="mt-16 pt-16 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">También te puede interesar</h2>
            <Link 
              to="/tienda"
              className="text-red-500 hover:text-red-400 transition-colors flex items-center gap-2"
            >
              Ver todos los productos
              <ArrowLeft className="rotate-180" size={20} />
            </Link>
          </div>
          
          <div className="bg-zinc-900/50 rounded-lg p-8 text-center">
            <p className="text-zinc-400">
              Próximamente agregaremos más productos relacionados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
