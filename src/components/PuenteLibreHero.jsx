// src/components/PuenteLibreHero.jsx
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ShieldCheck, Send, ShoppingBag } from "lucide-react";

const IMG_DESKTOP = "/img/puente-libre-hero-desktop.jpg";
const IMG_MOBILE = "/img/puente-libre-hero-mobile.jpg";

export default function PuenteLibreHero() {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Respeta preferencias de movimiento
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setPrefersReduced(m.matches);
    handler();
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, []);

  // Parallax/zoom muy sutil
  useEffect(() => {
    if (prefersReduced) return;

    let raf = 0;
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0..1 según visibilidad del bloque en viewport
      const p =
        1 -
        Math.min(
          Math.max((rect.top + rect.height * 0.4) / (vh + rect.height * 0.4), 0),
          1
        );
      setProgress(p);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [prefersReduced]);

  const scale = prefersReduced ? 1 : 1 + 0.08 * progress;
  const translateY = prefersReduced ? 0 : -8 * progress;

  return (
    <section
      ref={ref}
      className="w-full flex flex-col items-center text-center mt-0 pt-0 mb-8 md:mb-10"
      aria-label="Sección Puente Libre"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-4xl rounded-2xl border border-zinc-800/40 bg-zinc-900/40 p-0 shadow-xl backdrop-blur-md overflow-hidden"
      >
        <div className="relative min-h-[420px] md:min-h-[500px]">
          <picture
            className="absolute inset-0 block"
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: "center center",
              willChange: prefersReduced ? "auto" : "transform",
              transition: prefersReduced ? "none" : "transform 180ms ease-out",
            }}
          >
            <source media="(max-width: 767px)" srcSet={IMG_MOBILE} />
            <img
              src={IMG_DESKTOP}
              alt="Puente digital de datos conectando personas y ayuda"
              className="h-full w-full object-cover select-none pointer-events-none"
              loading="eager"
              fetchPriority="high"
            />
          </picture>

          {/* 🔧 Overlay más claro y cubre toda la tarjeta */}
          <div className="absolute inset-0 bg-black/55 md:bg-black/45" />

          {/* Contenido */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center h-full gap-6 px-6 py-8 md:px-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-2xl">
              Puente Libre
            </h2>

            <p className="text-gray-300 text-base md:text-lg mt-4 max-w-2xl leading-relaxed">
              Próximamente: una guía práctica para que los cubanos dentro de la
              isla aprendan a usar{" "}
              <span className="font-semibold text-white">criptomonedas</span>,
              acceder a productos y enviar ayuda desde cualquier parte del mundo.
            </p>

            <div className="mt-6">
              <Link
                to="/puente-libre"
                className="inline-flex items-center rounded-full px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white shadow-md hover:shadow-red-500/25 transition-all"
              >
                Cómo funciona →
              </Link>
            </div>

            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 ring-1 ring-white/10 mt-6"
              aria-label="Estado del módulo"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              En desarrollo activo
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tarjetas inferiores */}
      <div className="w-full max-w-5xl mt-6 md:mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
            <ShieldCheck className="mb-2 h-5 w-5 text-red-400" />
            <h3 className="text-white font-medium mb-1">Aprende sin riesgo</h3>
            <p className="text-zinc-400 text-sm">
              Guías claras para usar criptomonedas de forma segura.
            </p>
          </div>
          <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
            <Send className="mb-2 h-5 w-5 text-red-400" />
            <h3 className="text-white font-medium mb-1">Envía ayuda segura</h3>
            <p className="text-zinc-400 text-sm">
              Pasos simples para transferir valor a la isla.
            </p>
          </div>
          <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
            <ShoppingBag className="mb-2 h-5 w-5 text-red-400" />
            <h3 className="text-white font-medium mb-1">Acceso a productos</h3>
            <p className="text-zinc-400 text-sm">
              Compra desde fuera, recibe dentro de Cuba.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
