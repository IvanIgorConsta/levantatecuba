// src/components/DividerFade.jsx
// Separador tipo fade: degradado vertical oscuro para transiciones cinematográficas

export default function DividerFade({ className = "" }) {
  return (
    <div
      className={`w-full h-16 md:h-20 bg-gradient-to-b from-black/0 via-black/70 to-black ${className}`}
      aria-hidden="true"
    />
  );
}

// Versión invertida para transiciones de secciones claras a oscuras
export function DividerFadeReverse({ className = "" }) {
  return (
    <div
      className={`w-full h-16 md:h-20 bg-gradient-to-b from-black via-black/70 to-black/0 ${className}`}
      aria-hidden="true"
    />
  );
}
