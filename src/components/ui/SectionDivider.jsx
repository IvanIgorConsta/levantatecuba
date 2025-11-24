// src/components/ui/SectionDivider.jsx
export default function SectionDivider({
  className = "py-6",
  thick = false // true = 2px, false = 1px
}) {
  return (
    <div aria-hidden="true" className={`w-full ${className}`}>
      {/* hr sólido con alto contraste; no depende de gradientes */}
      <hr
        className={`mx-auto max-w-6xl border-0 ${thick ? "h-[2px]" : "h-px"} bg-zinc-700/80`}
      />
    </div>
  );
}
