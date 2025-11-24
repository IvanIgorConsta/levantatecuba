import { useCallback } from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useMemo } from "react";

export default function AshParticles() {
  const options = useMemo(() => ({
    fullScreen: { enable: false },
    particles: {
      number: {
        value: 150,
        density: { enable: true, area: 800 },
      },
      color: { value: ["#aaaaaa", "#cccccc", "#eeeeee", "#ff3e3e"] }, // Agrega un toque rojizo sutil
      shape: {
        type: "circle",
      },
      opacity: {
        value: 0.4,
        random: true,
        anim: { enable: true, speed: 0.4, opacity_min: 0.1, sync: false },
      },
      size: {
        value: { min: 1.5, max: 3.8 },
        random: true,
        anim: {
          enable: true,
          speed: 1,
          size_min: 1,
          sync: false,
        },
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: "top",
        random: true,
        straight: false,
        outModes: { default: "out" },
        attract: { enable: false },
      },
    },
    interactivity: {
      events: {
        onHover: { enable: false },
        onClick: { enable: false },
        resize: true,
      },
    },
    detectRetina: true,
    background: { color: "transparent" },
  }), []);

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      className="absolute inset-0 z-10 pointer-events-none"
      id="ashParticles"
      init={particlesInit}
      options={options}
    />
  );
}
