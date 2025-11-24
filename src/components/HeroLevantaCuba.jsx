import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useSpring,
  useMotionValue,
} from "framer-motion";

export default function HeroLevantaCuba() {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);

  // Scroll global
  const { scrollYProgress } = useScroll();

  // Parallax por scroll (más notorio)
  const bgScale = prefersReducedMotion ? 1 : useTransform(scrollYProgress, [0, 1], [1.02, 1.06]);
  const yFlag   = prefersReducedMotion ? 0 : useTransform(scrollYProgress, [0, 1], [-18, 18]);
  const yFire   = prefersReducedMotion ? 0 : useTransform(scrollYProgress, [0, 1], [-32, 32]);
  const ySym    = prefersReducedMotion ? 0 : useTransform(scrollYProgress, [0, 1], [-12, 12]);

  // Parallax por mouse (profundidad sin scroll)
  const [bounds, setBounds] = useState({ w: 1, h: 1, x: 0, y: 0 });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxS = useSpring(mx, { stiffness: 80, damping: 20 });
  const myS = useSpring(my, { stiffness: 80, damping: 20 });
  const pm = (m, f) => useTransform(m, v => v * f);

  const mFlagX = pm(mxS, -12), mFlagY = pm(myS, -8);
  const mFireX = pm(mxS,  18), mFireY = pm(myS,  14);
  const mSymX  = pm(mxS,  -8), mSymY  = pm(myS,  -6);

  function onPointerMove(e) {
    if (!ref.current || prefersReducedMotion) return;
    const r = ref.current.getBoundingClientRect();
    if (bounds.w !== r.width) setBounds({ w: r.width, h: r.height, x: r.left, y: r.top });
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    mx.set(px); my.set(py);
  }

  const fade = (d=0) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.7, delay: d } },
  });

  return (
    <section
      ref={ref}
      onPointerMove={onPointerMove}
      className="relative w-full overflow-hidden bg-black min-h-[88vh] md:min-h-[100vh]"
      aria-label="Levántate Cuba - Hero"
    >
      {/* Capa 1: fondo */}
      <motion.img
        src="/img/bg-texture-dark.png"
        alt="Fondo oscuro con textura"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover"
        style={{ scale: bgScale }}
        loading="eager"
        {...fade(0.05)}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.65))]" />

      {/* Capa 2: BANDERA como BACKGROUND (evita márgenes transparentes del PNG) */}
      <motion.div
        className="absolute z-20 select-none"
        style={{
          y: yFlag, x: mFlagX, translateY: mFlagY,
          left: "50%", top: "55%", transform: "translate(-50%, -50%)",
          width: "92vw", maxWidth: "1500px",
          height: "52vh",        // alto controlado para encuadrar
          backgroundImage: "url(/img/flag-cuba-transparent.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          // ¡Ajuste clave! mueve el motivo dentro del lienzo, ignorando los márgenes transparentes:
          backgroundPosition: "40% 50%", // prueba 35–45% horizontal si hace falta
          pointerEvents: "none",
        }}
        {...fade(0.12)}
        aria-hidden
      />

      {/* Capa 3: fuego */}
      <motion.div
        className="absolute z-30 select-none"
        style={{ y: yFire, x: mFireX, translateY: mFireY, right: "-2vw", bottom: "-2vh" }}
        {...fade(0.18)}
      >
        <img
          src="/img/fire-overlay.png"
          alt="Llamas envolventes"
          className="pointer-events-none w-[50vw] max-w-[980px]"
          loading="lazy"
          style={{ mixBlendMode: "screen", opacity: 0.9, filter: "drop-shadow(0 8px 24px rgba(255,90,0,0.22))" }}
        />
      </motion.div>

      {/* Capa 4: símbolos sutiles */}
      <motion.div
        className="absolute z-25 select-none"
        style={{ y: ySym, x: mSymX, translateY: mSymY, left: "50%", top: "64%", transform: "translateX(-50%)" }}
        {...fade(0.22)}
      >
        <img
          src="/img/symbols-overlay.png"
          alt="Siluetas simbólicas"
          className="pointer-events-none w-[84vw] max-w-[1350px] opacity-18"
          loading="lazy"
          style={{ filter: "blur(1px) contrast(104%)" }}
        />
      </motion.div>

      {/* Overlay inferior para legibilidad */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-32 bg-gradient-to-t from-black/65 to-transparent" />

      {/* Contenido */}
      <motion.div
        className="relative z-50 mx-auto flex min-h-[78vh] md:min-h-[100vh] max-w-5xl items-center justify-center px-6 text-center"
        {...fade(0.28)}
      >
        <div className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">LevántateCuba</h1>
          <p className="mt-3 text-base text-white/85 md:mt-4 md:text-lg">Voces libres. Verdad sin censura.</p>
          <a
            href="/romper"
            className="mt-6 inline-flex rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 md:px-6 md:text-base"
          >
            Conoce cómo ayudamos
          </a>
        </div>
      </motion.div>
    </section>
  );
}
