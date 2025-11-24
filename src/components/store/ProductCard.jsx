// src/components/store/ProductCard.jsx
import { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import PropTypes from 'prop-types';

export default function ProductCard({ product, onAddToCart }) {
  const variants = product?.variants || [];

  // helpers locales
  const canon = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replace("colour", "color")
      .replace("talla", "size")
      .replace("tamano", "size")
      .replace("tamaño", "size");

  // Canonizador para valores visibles (conserva espacios para etiquetas, pero compara canónicamente)
  const vcanon = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Normalizar values a array
  const toArrayValues = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) {
      // Si es array con un elemento tipo "S, M, L, XL", dividirlo
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

  // Buscar opción en selectedOptions por key o name canonizado
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

  // Detectar opciones Color/Size por clave canónica
  const colorOpt = findOptionByKey(product, 'color');
  const sizeOpt  = findOptionByKey(product, 'size');
  
  // Normalizar colors y sizes
  const colors = toArrayValues(colorOpt?.values);
  const sizes = toArrayValues(sizeOpt?.values);

  const [selectedColor, setSelectedColor] = useState(colors[0] || null);
  const [selectedSize,  setSelectedSize]  = useState(sizes[0]  || null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Detectar si las variantes tienen dimensión de talla
  const hasSizeDimensionInVariants = useMemo(
    () => variants.some(v => {
      const sv = getOpt(v?.selectedOptions, 'size');
      return !!sv && !/,/.test(String(sv)); // si trae "S, M, L, XL" => NO es dimensión real
    }),
    [variants]
  );

  // Lista de tallas disponibles para el color seleccionado (comparación canónica)
  const sizesForColor = useMemo(() => {
    if (!colorOpt || !sizeOpt || !selectedColor) return sizes;
    const selectedColorK = vcanon(selectedColor);

    const set = new Set(
      variants
        .filter(v => vcanon(getOpt(v?.selectedOptions, 'color') || '') === selectedColorK)
        .map(v => getOpt(v?.selectedOptions, 'size'))
        .filter(sv => sv && !/,/.test(String(sv))) // solo tallas válidas por variante
        .map(vcanon)
    );

    if (!hasSizeDimensionInVariants) return sizes;
    return sizes.filter(val => set.has(vcanon(val)));
  }, [variants, colorOpt, sizeOpt, selectedColor, sizes, hasSizeDimensionInVariants]);

  const isSizeAvailable = (val) => {
    if (!hasSizeDimensionInVariants) return true;
    return sizesForColor.some(v => vcanon(v) === vcanon(val));
  };

  const isColorAvailable = (val) =>
    variants.some(v => {
      const colorVal = getOpt(v?.selectedOptions, 'color');
      if (vcanon(colorVal || '') !== vcanon(val)) return false;
      const sizeVal = getOpt(v?.selectedOptions, 'size');
      if (!sizeVal || /,/.test(String(sizeVal))) return true; // sin talla real
      return vcanon(sizeVal) === vcanon(selectedSize);
    });

  // Asegurar que la talla seleccionada sea válida para el color actual
  useEffect(() => {
    if (!sizeOpt) return;
    const has = selectedSize && (sizesForColor || []).some(v => vcanon(v) === vcanon(selectedSize));
    if (!has) {
      const first = sizesForColor?.[0] ?? sizes?.[0] ?? null;
      setSelectedSize(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor, JSON.stringify(sizesForColor)]);

  const variantsByColor = useMemo(() => {
    const map = new Map();
    for (const v of variants) {
      const c = getOpt(v?.selectedOptions, 'color');
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(v);
    }
    return map;
  }, [variants]);

  const activeVariant = useMemo(() => {
    if (!variants.length) return null;
    const match = variants.find(v => {
      const c = getOpt(v?.selectedOptions, 'color');
      const s = getOpt(v?.selectedOptions, 'size');
      const okColor = !colorOpt || vcanon(c || '') === vcanon(selectedColor);
      const variantHasRealSize = !!s && !/,/.test(String(s));
      const okSize = !variantHasRealSize || vcanon(s) === vcanon(selectedSize);
      return okColor && okSize;
    });
    return match || variants[0] || null;
  }, [variants, selectedColor, selectedSize, colorOpt]);

  // Logs temporales para debug
  console.log('[CHK] sample selectedOptions=', variants?.[0]?.selectedOptions);
  console.log('[CHK] getOpt(color)=', getOpt(variants?.[0]?.selectedOptions,'color'),
              'getOpt(size)=', getOpt(variants?.[0]?.selectedOptions,'size'));
  console.log('[CHK] hasSizeDimensionInVariants=', hasSizeDimensionInVariants);
  console.log('[CHK] availability matrix:', variants.map(v => ({
    id: v.id,
    color: getOpt(v.selectedOptions,'color'),
    size: getOpt(v.selectedOptions,'size'),
    hasRealSize: !!getOpt(v.selectedOptions,'size') && !/,/.test(String(getOpt(v.selectedOptions,'size')))
  })));

  // Precio numérico seguro y texto formateado
  const priceNumber = useMemo(() => {
    const v = activeVariant?.price;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof product?.priceMin === 'number' && !Number.isNaN(product.priceMin)) return product.priceMin;
    const first = product?.variants?.[0]?.price;
    if (typeof first === 'number' && !Number.isNaN(first)) return first;
    return null;
  }, [activeVariant?.price, product?.priceMin, product?.variants]);

  const priceText = priceNumber != null ? Number(priceNumber).toFixed(2) : null;
  const currency = activeVariant?.currencyCode || product?.currencyCode || 'USD';

  const handleAddToCart = () => {
    setIsAdding(true);
    
    const item = {
      productId: product.id,
      title: product.title,
      price: priceNumber,
      image: (activeVariant?.imageUrl || product.image || product.imageUrl || ''),
      quantity,
      variant: activeVariant
    };
    
    onAddToCart(item);
    
    // Animación de feedback
    setTimeout(() => {
      setIsAdding(false);
      setQuantity(1);
    }, 500);
  };

  const incrementQuantity = () => {
    if (quantity < 10) setQuantity(quantity + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  // Placeholder para imágenes que no existen
  const currentImage = (activeVariant?.imageUrl || product.image || product.imageUrl || '');
  const imageSrc = currentImage?.startsWith('/img/') 
    ? `https://via.placeholder.com/400x400/1a1a1a/ef4444?text=${encodeURIComponent(product.title)}`
    : currentImage;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-red-500/50 transition-all duration-300 group">
      {/* Imagen del producto */}
      <div className="relative aspect-square bg-zinc-800 overflow-hidden">
        <img
          src={imageSrc}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = `https://via.placeholder.com/400x400/1a1a1a/ef4444?text=${encodeURIComponent(product.title)}`;
          }}
        />
        {product.featured && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            Destacado
          </div>
        )}
      </div>

      {/* Información del producto */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          {product.title}
        </h3>
        <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
          {product.description}
        </p>
        
        {/* Precio */}
        <div className="text-2xl font-bold text-red-500 mb-3">
          {priceText ? `${currency} ${priceText}` : 'Precio no disponible'}
        </div>

        {/* Selector de Color */}
        {colors.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-zinc-400 block mb-1">Color:</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => {
                const enabled = isColorAvailable(c);
                const active = vcanon(selectedColor) === vcanon(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (!enabled) return;
                      setSelectedColor(c);
                    }}
                    className={`px-3 py-1 text-sm rounded border transition-colors ${
                      active ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-red-500/50'
                    } ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!enabled}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selector de Talla */}
        {sizes.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-zinc-400 block mb-1">Talla:</label>
            <div className="flex flex-wrap gap-2">
              {sizes.map(s => {
                const enabled = isSizeAvailable(s);
                const active = vcanon(selectedSize) === vcanon(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (enabled) {
                        setSelectedSize(s);
                      }
                    }}
                    className={`px-3 py-1 text-sm rounded border transition-colors ${
                      active ? 'bg-zinc-200 text-black border-zinc-200' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-red-500/50'
                    } ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!enabled}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selector de cantidad */}
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs text-zinc-400">Cantidad:</label>
          <div className="flex items-center bg-zinc-800 rounded">
            <button
              onClick={decrementQuantity}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Disminuir cantidad"
            >
              <Minus size={16} />
            </button>
            <span className="px-3 py-1 text-white font-medium min-w-[40px] text-center">
              {quantity}
            </span>
            <button
              onClick={incrementQuantity}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Aumentar cantidad"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Botón agregar al carrito */}
        <button
          onClick={handleAddToCart}
          disabled={isAdding || (activeVariant && activeVariant.available === false)}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
            isAdding
              ? 'bg-green-500 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <ShoppingCart size={20} />
          <span>
            {isAdding ? '¡Agregado!' : 'Agregar al carrito'}
          </span>
        </button>
      </div>
    </div>
  );
}

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    featured: PropTypes.bool,
    currencyCode: PropTypes.string,
    priceMin: PropTypes.number,
    priceMax: PropTypes.number,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        key: PropTypes.string,
        values: PropTypes.arrayOf(PropTypes.string),
      })
    ),
    variants: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        price: PropTypes.number,
        currencyCode: PropTypes.string,
        available: PropTypes.bool,
        quantityAvailable: PropTypes.number,
        imageUrl: PropTypes.string,
        selectedOptions: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
            key: PropTypes.string,
            value: PropTypes.string,
          })
        ),
      })
    ),
  }).isRequired,
  onAddToCart: PropTypes.func.isRequired,
};