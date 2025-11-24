// src/components/Carousel.jsx
import { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * Carrusel horizontal responsivo para tablet/desktop
 * - Tablet (≥640px): 2 tarjetas por vista
 * - Desktop (≥1024px): 3 tarjetas por vista
 * - Navegación por páginas con flechas compactas
 * - Sin peek/filo al inicio ni al final
 */
const Carousel = ({ items, renderItem, label, gap = 24 }) => {
  const containerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const enableCarousel = items.length >= 3;

  const updateArrows = () => {
    if (!containerRef.current || !enableCarousel) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setShowPrev(scrollLeft > 2);
    setShowNext(scrollLeft < scrollWidth - clientWidth - 2);
  };

  // Detección inteligente de dirección de scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enableCarousel) return;

    // Desktop: detectar dirección del wheel
    const handleWheel = (e) => {
      const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      
      if (isHorizontalScroll) {
        // Movimiento horizontal → gestión en onWheel del contenedor
        return;
      }
      // Movimiento vertical → dejar pasar al documento
    };

    // Móvil/Tablet: detectar dirección del touch
    const handleTouchStart = (e) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const handleTouchMove = (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      
      const isHorizontalSwipe = deltaX > deltaY;
      
      if (isHorizontalSwipe) {
        // Swipe horizontal → permitir scroll del carrusel
        e.stopPropagation();
      }
      // Swipe vertical → dejar pasar al documento
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [enableCarousel]);

  useEffect(() => {
    if (!enableCarousel) return;
    updateArrows();
    
    const handleResize = () => updateArrows();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enableCarousel, items.length]);

  // Navegación por páginas
  const scroll = (direction) => {
    if (!containerRef.current) return;
    
    const el = containerRef.current;
    const currentScroll = el.scrollLeft;
    const pageWidth = el.clientWidth;
    const scrollWidth = el.scrollWidth;
    
    const currentPage = Math.round(currentScroll / pageWidth);
    const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    let targetScroll = targetPage * pageWidth;
    
    // Clampear al inicio/final
    targetScroll = Math.max(0, Math.min(targetScroll, scrollWidth - pageWidth));
    
    el.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  if (!enableCarousel) {
    // Grilla estática para < 3 ítems
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item._id || item.id}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="hidden sm:block relative overflow-visible">
      {/* Flecha izquierda */}
      {showPrev && (
        <button
          onClick={() => scroll('prev')}
          aria-label="Anterior"
          role="button"
          tabIndex={0}
          className="custom-arrow left-arrow"
        >
          <FaChevronLeft size={20} />
        </button>
      )}

      {/* Contenedor con scroll horizontal */}
      <div
        ref={containerRef}
        onScroll={updateArrows}
        role="region"
        aria-label={label}
        className="overflow-x-auto overflow-y-visible pl-6 pr-0 py-4 md:py-6 scroll-smooth [scrollbar-gutter:stable] hide-scrollbar relative"
        style={{ 
          touchAction: 'pan-y',
          overscrollBehavior: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: '24px',
          scrollPaddingRight: '0px',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 8px, black 100%)',
          askImage: 'linear-gradient(to right, transparent 0, black 8px, black 100%)'
        }}
      >
        <div className="flex gap-6 py-1">
          {items.map((item) => (
            <div
              key={item._id || item.id}
              className="flex-shrink-0 w-full sm:w-[calc((100%_-_24px)_/_2)] lg:w-[calc((100%_-_48px)_/_3)]"
              style={{
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always'
              }}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>

      {/* Flecha derecha */}
      {showNext && (
        <button
          onClick={() => scroll('next')}
          aria-label="Siguiente"
          role="button"
          tabIndex={0}
          className="custom-arrow right-arrow"
        >
          <FaChevronRight size={20} />
        </button>
      )}
    </div>
  );
};

export default Carousel;
